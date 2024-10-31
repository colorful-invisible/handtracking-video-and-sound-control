// VELOCITY-BASED SOUND PLAYBACK RATE, VOLUME CONTROL / VIDEO CONTROL WITH SMOOTH TRANSITIONS

window.p5 = require("p5");
require("p5/lib/addons/p5.sound");
import { mediaPipe } from "./poseModelMediaPipe";
import { initializeCamCapture } from "./cameraUtils";
import { getMappedLandmarks } from "./landmarksHandler";
import { averageLandmarkPosition } from "./utils";
import soundURL from "../assets/sounds/wind_01.mp3";
import videoURL from "../assets/videos/sunset_01.mp4";

new p5((sk) => {
  let camFeed;
  let sound;
  let soundLoaded = false;
  let video;
  let videoLoaded = false;
  let prevHandX = null;
  let smoothedHandVelocity = 0;
  let smoothedPlaybackRate = 0; // Initialize smoothed playback rate

  // ---- SETTINGS ---- //
  const avgPos = averageLandmarkPosition(20);

  sk.preload = () => {
    sound = sk.loadSound(soundURL, () => {
      soundLoaded = true;
      sound.loop();
    });
  };

  sk.setup = () => {
    sk.createCanvas(sk.windowWidth, sk.windowHeight);
    sk.colorMode(sk.HSL, 360, 100, 100);
    sk.background(0);
    camFeed = initializeCamCapture(sk, mediaPipe);

    // Load and set up the video
    video = sk.createVideo(videoURL, () => {
      videoLoaded = true;
      video.hide(); // Hide the DOM element
      video.loop();
      video.play(); // Start playing
      video.elt.playbackRate = 1; // Start with normal playback rate
    });
  };

  sk.draw = () => {
    // Draw the video on the canvas
    if (videoLoaded) {
      sk.image(video, 0, 0, sk.width, sk.height);
    }

    const landmarksIndex = [16, 18, 20];
    const landmarks = getMappedLandmarks(
      sk,
      mediaPipe,
      camFeed,
      landmarksIndex
    );

    // Check if all required landmarks are available and finite
    const requiredLandmarksExist =
      isFinite(landmarks.LM16X) &&
      isFinite(landmarks.LM16Y) &&
      isFinite(landmarks.LM18X) &&
      isFinite(landmarks.LM18Y) &&
      isFinite(landmarks.LM20X) &&
      isFinite(landmarks.LM20Y);

    if (requiredLandmarksExist) {
      // Get averaged positions for smoother tracking
      const rightWristX = avgPos("RWX", landmarks.LM16X);
      const rightWristY = avgPos("RWY", landmarks.LM16Y);
      const rightPinkyX = avgPos("RPX", landmarks.LM18X);
      const rightPinkyY = avgPos("RPY", landmarks.LM18Y);
      const rightIndexX = avgPos("RIX", landmarks.LM20X);
      const rightIndexY = avgPos("RIY", landmarks.LM20Y);

      const rightHandX = (rightWristX + rightPinkyX + rightIndexX) / 3;
      const rightHandY = (rightWristY + rightPinkyY + rightIndexY) / 3;

      // Sound control based on hand velocity
      if (soundLoaded) {
        if (prevHandX !== null && isFinite(prevHandX)) {
          const handVelocity = rightHandX - prevHandX;

          // Smooth the hand velocity
          smoothedHandVelocity =
            0.8 * smoothedHandVelocity + 0.2 * handVelocity;

          // Calculate the absolute value of smoothed hand velocity
          const absHandVelocity = Math.abs(smoothedHandVelocity);

          // Map hand velocity to playback rate
          const playbackRate = sk.map(
            absHandVelocity,
            5,
            40, // Adjust the max velocity threshold as needed
            1,
            3
          );

          // Clamp the playback rate
          const clampedRate = sk.constrain(playbackRate, 1, 3);

          if (isFinite(clampedRate)) {
            sound.rate(clampedRate);
          } else {
            sound.rate(1); // Default to normal speed if clampedRate is not finite
          }

          // Map the absolute hand velocity to volume
          const volume = sk.map(
            absHandVelocity,
            0,
            20, // Velocity threshold for maximum volume (adjust as needed)
            0,
            3
          );

          // Clamp the volume between 0.05 and 3
          const clampedVolume = sk.constrain(volume, 0.05, 3);

          if (isFinite(clampedVolume)) {
            sound.setVolume(clampedVolume);
          } else {
            sound.setVolume(0.05);
          }
        }

        if (!sound.isPlaying()) {
          sound.play();
        }
      }

      // Video control based on hand movement
      if (videoLoaded) {
        const videoDuration = video.duration();
        if (videoDuration) {
          // Map hand X position to video time
          const videoTime = sk.map(rightHandX, 0, sk.width, 0, videoDuration);
          video.time(videoTime);

          // Determine if the hand is moving
          const handVelocity = rightHandX - prevHandX;
          const absHandVelocity = Math.abs(handVelocity);

          // Map hand movement to desired playback rate
          const minPlaybackRate = 0.1; // Minimum supported playback rate
          const maxPlaybackRate = 1; // Normal playback rate

          const targetPlaybackRate = sk.map(
            absHandVelocity,
            0,
            20, // Adjust this threshold based on desired sensitivity
            minPlaybackRate,
            maxPlaybackRate
          );

          const clampedTargetRate = sk.constrain(
            targetPlaybackRate,
            minPlaybackRate,
            maxPlaybackRate
          );

          // Smoothly adjust the playback rate towards the target rate
          smoothedPlaybackRate =
            0.9 * smoothedPlaybackRate + 0.1 * clampedTargetRate;

          // Ensure playback rate is within supported range
          const finalPlaybackRate = sk.constrain(
            smoothedPlaybackRate,
            minPlaybackRate,
            maxPlaybackRate
          );

          // Set the video's playback rate
          if (isFinite(finalPlaybackRate)) {
            video.elt.playbackRate = finalPlaybackRate;
          } else {
            video.elt.playbackRate = 1; // Default to normal speed
          }
        }
      }

      prevHandX = rightHandX;

      // Visual feedback (draw an ellipse at the hand position)
      sk.fill(120, 100, 50);
      sk.noStroke();
      sk.ellipse(rightHandX, rightHandY, 20, 20);
    } else {
      // Reset variables if hand landmarks are not detected
      prevHandX = null;
      smoothedHandVelocity = 0;
      smoothedPlaybackRate = 0;
    }
  };
});
