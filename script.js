const body = document.body;
const lines = [...document.querySelectorAll('.line')];
const strikeTarget = document.getElementById('strikeTarget');
const typedBlue = document.getElementById('typedBlue');
const typedCursor = document.getElementById('typedCursor');
const logo = document.querySelector('.logo');

const maxStep = 3;
const typedPhrase = ' feels awesome to use.';
const logoTransitionMs = 900;
const lineTransitionMs = 520;
const wheelTriggerThreshold = 90;
const wheelCooldownMs = 800;

let launched = false;
let currentStep = 0;
let stepLocked = false;
let touchStartY = null;
let activeLineIndex = -1;
let finalAnimationToken = 0;
let wheelAccumulator = 0;
let wheelResetTimer = null;
let wheelCooldownUntil = 0;
let wheelDirection = 0;
let launchStarted = false;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function setVisibleLine(index, direction = 1) {
  if (activeLineIndex === index) {
    return;
  }

  if (index < 0) {
    lines.forEach((line) => {
      line.classList.remove('is-visible');
      line.style.transition = '';
      line.style.opacity = '';
      line.style.transform = '';
      line.style.removeProperty('--exit-shift');
    });
    activeLineIndex = -1;
    return;
  }

  if (activeLineIndex >= 0) {
    const previousLine = lines[activeLineIndex];
    previousLine.classList.remove('is-visible');
    previousLine.style.transition = `opacity ${lineTransitionMs}ms ease, transform ${lineTransitionMs}ms ease`;
    previousLine.style.opacity = '0';
    previousLine.style.transform = direction > 0 ? 'translateY(-110%)' : 'translateY(110%)';
    setTimeout(() => {
      previousLine.style.transition = '';
      previousLine.style.opacity = '';
      previousLine.style.transform = '';
    }, lineTransitionMs);
  }

  if (index >= 0) {
    const incomingLine = lines[index];
    incomingLine.classList.remove('is-visible');
    incomingLine.style.transition = 'none';
    incomingLine.style.opacity = '0';
    incomingLine.style.transform = direction > 0 ? 'translateY(110%)' : 'translateY(-110%)';

    // Commit the starting point before animating to final position.
    void incomingLine.offsetHeight;

    incomingLine.classList.add('is-visible');
    incomingLine.style.transition = `opacity ${lineTransitionMs}ms ease, transform ${lineTransitionMs}ms ease`;
    incomingLine.style.opacity = '1';
    incomingLine.style.transform = 'translateY(0)';

    setTimeout(() => {
      incomingLine.style.transition = '';
      incomingLine.style.opacity = '';
      incomingLine.style.transform = '';
    }, lineTransitionMs);
  }

  activeLineIndex = index;
}

function resetFinalLine() {
  strikeTarget.style.setProperty('--strike-progress', '0');
  typedBlue.textContent = '';
  typedCursor.classList.remove('is-active');
  typedCursor.style.opacity = '';
  typedCursor.style.animation = '';
}

function animateFinalLine() {
  finalAnimationToken += 1;
  const token = finalAnimationToken;
  const strikeDuration = 80;
  const typeDuration = 1200;
  const cursorDelayAfterStrike = 240;
  const blinkCount = 3;
  const blinkHalfCycleMs = 500;
  const preTypingBlinkDuration = blinkCount * blinkHalfCycleMs * 2;
  const cursorStart = strikeDuration + cursorDelayAfterStrike;
  const typingStart = cursorStart + preTypingBlinkDuration;
  const start = performance.now();

  function frame(now) {
    if (token !== finalAnimationToken) {
      return;
    }

    const elapsed = now - start;

    const strikeProgress = clamp(elapsed / strikeDuration, 0, 1);
    strikeTarget.style.setProperty('--strike-progress', String(strikeProgress));

    if (elapsed <= cursorStart) {
      typedBlue.textContent = '';
      typedCursor.style.opacity = '0';
      typedCursor.style.animation = 'none';
    } else if (elapsed <= typingStart) {
      typedBlue.textContent = '';
      const blinkElapsed = elapsed - cursorStart;
      const blinkPhase = Math.floor(blinkElapsed / blinkHalfCycleMs) % 2;
      typedCursor.style.opacity = blinkPhase === 0 ? '1' : '0';
      typedCursor.style.animation = 'none';
    } else {
      const typingElapsed = elapsed - typingStart;
      const typingProgress = clamp(typingElapsed / typeDuration, 0, 1);
      const charCount = Math.round(typedPhrase.length * typingProgress);

      typedBlue.textContent = typedPhrase.slice(0, charCount);
      typedCursor.style.opacity = typingProgress < 1 ? '1' : '0';
      typedCursor.style.animation = 'none';
    }

    if (elapsed < typingStart + typeDuration) {
      requestAnimationFrame(frame);
    }
  }

  requestAnimationFrame(frame);
}

function renderStep(direction = 1) {
  if (!launched) {
    setVisibleLine(-1, direction);
    resetFinalLine();
    return;
  }

  if (currentStep < 2) {
    finalAnimationToken += 1;
    setVisibleLine(currentStep, direction);
    resetFinalLine();
    return;
  }

  setVisibleLine(2, direction);

  if (currentStep === 2) {
    finalAnimationToken += 1;
    resetFinalLine();
    return;
  }

  resetFinalLine();
  animateFinalLine();
}

function moveStep(direction) {
  if (!launched || stepLocked) {
    return false;
  }

  const nextStep = clamp(currentStep + direction, 0, maxStep);

  if (nextStep === currentStep) {
    return false;
  }

  currentStep = nextStep;
  stepLocked = true;
  renderStep(direction);

  setTimeout(() => {
    stepLocked = false;
  }, lineTransitionMs);

  return true;
}

window.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault();

    const now = performance.now();
    if (now < wheelCooldownUntil) {
      return;
    }

    const delta = event.deltaY;
    if (Math.abs(delta) < 2) {
      return;
    }

    const gestureDirection = delta > 0 ? 1 : -1;
    if (wheelDirection !== gestureDirection) {
      wheelDirection = gestureDirection;
      wheelAccumulator = 0;
    }

    wheelAccumulator += Math.abs(delta);

    if (wheelResetTimer) {
      clearTimeout(wheelResetTimer);
    }
    wheelResetTimer = setTimeout(() => {
      wheelAccumulator = 0;
      wheelDirection = 0;
      wheelResetTimer = null;
    }, 140);

    if (wheelAccumulator < wheelTriggerThreshold) {
      return;
    }

    const moved = moveStep(wheelDirection);
    wheelAccumulator = 0;
    wheelDirection = 0;

    if (moved) {
      wheelCooldownUntil = performance.now() + wheelCooldownMs;
    }
  },
  { passive: false }
);

window.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown' || event.key === 'PageDown' || event.key === ' ') {
    event.preventDefault();
    moveStep(1);
  }

  if (event.key === 'ArrowUp' || event.key === 'PageUp') {
    event.preventDefault();
    moveStep(-1);
  }
});

window.addEventListener(
  'touchstart',
  (event) => {
    touchStartY = event.changedTouches[0].clientY;
  },
  { passive: true }
);

window.addEventListener(
  'touchend',
  (event) => {
    if (touchStartY == null) {
      return;
    }

    const endY = event.changedTouches[0].clientY;
    const delta = touchStartY - endY;
    touchStartY = null;

    if (Math.abs(delta) < 18) {
      return;
    }

    moveStep(delta > 0 ? 1 : -1);
  },
  { passive: true }
);

function startLaunchSequence() {
  if (launchStarted) {
    return;
  }

  launchStarted = true;

  setTimeout(() => {
    body.classList.add('logo-docked');
    setTimeout(() => {
      launched = true;
      renderStep();
    }, logoTransitionMs);
  }, 500);
}

function initLaunchSequence() {
  const beginAfterPaint = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(startLaunchSequence);
    });
  };

  if (logo && !logo.complete) {
    logo.addEventListener('load', beginAfterPaint, { once: true });
    return;
  }

  beginAfterPaint();
}

initLaunchSequence();

window.addEventListener('load', renderStep);
