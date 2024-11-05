// ---- SINOIDAL PULSE
// -------------------
function pulse(sk, min, max, time) {
  const mid = (min + max) / 2;
  const amplitude = (max - min) / 2;
  const t = sk.millis();
  return amplitude * sk.sin((sk.TWO_PI * t) / time) + mid;
}

// ---- AVERAGE LANDMARK POSITION FOR SMOOTHING
// --------------------------------------------
// Usage on index.js:
// const avgPos = averageLandmarkPosition(2);
// const noseX = avgPos("NX", landmarks.LM0X);
// const noseY = avgPos("NY", landmarks.LM0Y);

function averageLandmarkPosition(alpha = 0.2) {
  const positionHistory = {};

  return (key, newValue) => {
    if (!(key in positionHistory)) {
      positionHistory[key] = newValue;
    } else {
      positionHistory[key] =
        alpha * newValue + (1 - alpha) * positionHistory[key];
    }
    return positionHistory[key];
  };
}

export { averageLandmarkPosition, pulse };
