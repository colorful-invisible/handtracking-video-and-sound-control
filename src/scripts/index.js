window.p5 = require("p5");
require("p5/lib/addons/p5.sound");
import { mediaPipe } from "./poseModelMediaPipe";
import { initializeCamCapture } from "./cameraUtils";
import { getMappedLandmarks } from "./landmarksHandler";
import { averageLandmarkPosition } from "./utils";
import soundURL from "../assets/sounds/les-gens.mp3";
import videoURL from "../assets/videos/sunset_02.mp4";

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

  // Settings
  const avgPos = averageLandmarkPosition(20);

  function updateAudio(handX) {
    if (!isAudioLoaded || !audio) return;

    if (prevHandX !== null && isFinite(prevHandX)) {
      const velocity = handX - prevHandX;
      handVelSmooth = 0.8 * handVelSmooth + 0.2 * velocity;
      const absVel = Math.abs(handVelSmooth);

      // Update rate
      const rate = sk.map(absVel, 5, 40, 1, 3); // 5 is the starting point of velocity change
      const clampedRate = sk.constrain(rate, 1, 3);
      if (isFinite(clampedRate)) {
        audio.rate(clampedRate);
      } else {
        audio.rate(1);
      }

      // Update volume
      const vol = sk.map(absVel, 0, 20, 0, 3);
      const clampedVol = sk.constrain(vol, 0.05, 3);
      if (isFinite(clampedVol)) {
        audio.setVolume(clampedVol);
      } else {
        audio.setVolume(0.05);
      }
    }

    if (!audio.isPlaying()) {
      audio.play();
    }
  }

  function updateVideo(handX) {
    if (!isVideoLoaded || !video) return;

    const duration = video.duration();
    if (!duration) return;

    // Update video time based on hand position
    const time = sk.map(handX, 0, sk.width, 0, duration);
    video.time(time);

    // Update playback rate with momentum
    const velocity = handX - prevHandX;
    const absVel = Math.abs(velocity);

    const minRate = 0.1;
    const maxRate = 1;
    const targetRate = sk.map(absVel, 0, 40, minRate, maxRate);
    const clampedTarget = sk.constrain(targetRate, minRate, maxRate);

    playbackSmooth = 0.95 * playbackSmooth + 0.05 * clampedTarget;
    const finalRate = sk.constrain(playbackSmooth, minRate, maxRate);

    if (isFinite(finalRate)) {
      video.elt.playbackRate = finalRate;
    } else {
      video.elt.playbackRate = 1;
    }
  }

  sk.preload = () => {
    audio = sk.loadSound(soundURL, () => {
      isAudioLoaded = true;
    });
  };

  sk.setup = () => {
    sk.createCanvas(sk.windowWidth, sk.windowHeight);
    sk.colorMode(sk.HSL, 360, 100, 100);
    sk.background(0);
    cam = initializeCamCapture(sk, mediaPipe);

    video = sk.createVideo(videoURL, () => {
      isVideoLoaded = true;
      video.hide();
    });

    sk.keyPressed = () => {
      if (sk.keyCode === 32 && !isStarted && isAudioLoaded && isVideoLoaded) {
        isStarted = true;
        audio.loop();
        video.loop();
        video.play();
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

    const landmarks = getMappedLandmarks(sk, mediaPipe, cam, [16, 18, 20]);
    const hasValidLandmarks =
      isFinite(landmarks.LM16X) &&
      isFinite(landmarks.LM16Y) &&
      isFinite(landmarks.LM18X) &&
      isFinite(landmarks.LM18Y) &&
      isFinite(landmarks.LM20X) &&
      isFinite(landmarks.LM20Y);

    if (hasValidLandmarks) {
      // Calculate hand position
      const handX =
        (avgPos("RWX", landmarks.LM16X) +
          avgPos("RPX", landmarks.LM18X) +
          avgPos("RIX", landmarks.LM20X)) /
        3;

      const handY =
        (avgPos("RWY", landmarks.LM16Y) +
          avgPos("RPY", landmarks.LM18Y) +
          avgPos("RIY", landmarks.LM20Y)) /
        3;

      if (isStarted) {
        updateAudio(handX);
        updateVideo(handX);
      }

      prevHandX = handX;

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
      sk.fill(120, 100, 100);
      sk.noStroke();
      sk.ellipse(handX, handY, 20, 20);
    } else {
      prevHandX = null;
      handVelSmooth = 0;
      playbackSmooth = 1;
    }
  };
});
