window.p5 = require("p5");
require("p5/lib/addons/p5.sound");
import { mediaPipe } from "./poseModelMediaPipe";
import { initializeCamCapture } from "./cameraUtils";
import { getMappedLandmarks } from "./landmarksHandler";
import { averageLandmarkPosition, pulse } from "./utils";
import soundURL from "../assets/sounds/wind_01.mp3";
import videoURL from "../assets/videos/bhuvarloka_01.mp4";

new p5((sk) => {
  // Media elements
  let cam;
  let audio;
  let video;
  let isAudioLoaded = false;
  let isVideoLoaded = false;
  let isStarted = false;

  // Hand tracking
  let prevHandX = null;
  let handVelSmooth = 0;
  let playbackSmooth = 1;
  let smoothedHandX = null;
  let smoothedHandY = null;

  // History buffers for smoothing
  const handXHistory = [];
  const handYHistory = [];
  const historySize = 5; // Number of frames to average over

  // Settings
  const avgPos = averageLandmarkPosition(0.05);

  function smoothValue(history, newValue) {
    history.push(newValue);
    if (history.length > historySize) {
      history.shift(); // Remove the oldest value if history exceeds size
    }
    return history.reduce((sum, val) => sum + val, 0) / history.length;
  }

  function updateAudio(handX) {
    if (!isAudioLoaded || !audio) return;

    if (prevHandX !== null && isFinite(prevHandX)) {
      const velocity = handX - prevHandX;
      handVelSmooth = 0.8 * handVelSmooth + 0.2 * velocity;
      const absVel = Math.abs(handVelSmooth);

      // Update rate
      const rate = sk.map(absVel, 10, 40, 1, 3);
      const clampedRate = sk.constrain(rate, 1, 1.5);
      if (isFinite(clampedRate)) {
        audio.rate(clampedRate);
      } else {
        audio.rate(1);
      }

      // Update volume
      const vol = sk.map(absVel, 0, 20, 0, 3);
      const clampedVol = sk.constrain(vol, 0.08, 3);
      if (isFinite(clampedVol)) {
        audio.setVolume(clampedVol);
      } else {
        audio.setVolume(0.05);
      }
    }
  }

  function updateVideo(handX) {
    if (!isVideoLoaded || !video) return;

    const duration = video.duration();
    if (!duration) return;

    // Update video time based on hand position
    const time = sk.map(handX, 200, sk.width - 200, 0, duration);
    video.time(time);
  }

  sk.preload = () => {
    audio = sk.loadSound(soundURL, () => {
      isAudioLoaded = true;
    });

    video = sk.createVideo(videoURL, () => {
      isVideoLoaded = true;
      video.hide();
    });
  };

  sk.setup = () => {
    sk.createCanvas(sk.windowWidth, sk.windowHeight);
    sk.colorMode(sk.HSL, 360, 100, 100);
    sk.background(0);
    cam = initializeCamCapture(sk, mediaPipe);

    sk.keyPressed = () => {
      if (sk.keyCode === 32 && !isStarted && isAudioLoaded && isVideoLoaded) {
        isStarted = true;
        audio.loop();
        video.loop();
      }
    };
  };

  sk.draw = () => {
    if (!isStarted) {
      sk.background(0);
      sk.fill(255);
      sk.textAlign(sk.CENTER, sk.CENTER);
      sk.textSize(32);
      sk.text("PRESS SPACE BAR TO START", sk.width / 2, sk.height / 2);
      return;
    }

    if (isVideoLoaded) {
      sk.image(video, 0, 0, sk.width, sk.height);
    }

    const landmarks = getMappedLandmarks(sk, mediaPipe, cam, [18, 20]);
    const hasValidLandmarks =
      isFinite(landmarks.LM18X) &&
      isFinite(landmarks.LM18Y) &&
      isFinite(landmarks.LM20X) &&
      isFinite(landmarks.LM20Y);

    if (hasValidLandmarks) {
      // Calculate hand position
      const rawHandX =
        (avgPos("RPX", landmarks.LM18X) + avgPos("RIX", landmarks.LM20X)) / 2;
      const rawHandY =
        (avgPos("RPY", landmarks.LM18Y) + avgPos("RIY", landmarks.LM20Y)) / 2;

      // Smooth hand positions
      smoothedHandX = smoothValue(handXHistory, rawHandX);
      smoothedHandY = smoothValue(handYHistory, rawHandY);

      if (isStarted) {
        updateAudio(smoothedHandX);
        updateVideo(smoothedHandX);
      }

      prevHandX = smoothedHandX;

      // Draw mini camera view
      sk.push();
      sk.image(
        cam,
        sk.width - cam.scaledWidth / 12 - 24,
        sk.height - cam.scaledHeight / 12 - 24,
        cam.scaledWidth / 12,
        cam.scaledHeight / 12
      );
      sk.pop();

      // Draw hand indicator
      sk.noFill();
      sk.stroke(0, 100, 50);
      sk.strokeWeight(3);
      let sizePulse = pulse(sk, 20, 36, 2000);
      sk.ellipse(smoothedHandX, smoothedHandY, sizePulse, sizePulse);
    } else {
      prevHandX = null;
      handVelSmooth = 0;
      playbackSmooth = 1;
    }
  };
});
