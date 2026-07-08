import * as faceapi from 'face-api.js';

/**
 * Detects blink by measuring Eye Aspect Ratio (EAR).
 * A blink occurs when EAR drops below threshold momentarily.
 * 
 * EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
 * where p1-p6 are the 6 landmarks of each eye.
 */

const EAR_THRESHOLD = 0.22; // Below this = eye closed
const BLINK_FRAMES = 2; // Need at least 2 consecutive frames with closed eyes

export class LivenessDetector {
  constructor() {
    this.closedFrames = 0;
    this.blinkDetected = false;
    this.checksPerformed = 0;
  }

  reset() {
    this.closedFrames = 0;
    this.blinkDetected = false;
    this.checksPerformed = 0;
  }

  /**
   * Check a video frame for blink.
   * Returns: { blinkDetected: boolean, ear: number }
   */
  async checkFrame(videoElement) {
    if (!videoElement || videoElement.readyState !== 4) {
      return { blinkDetected: this.blinkDetected, ear: null };
    }

    try {
      const detection = await faceapi
        .detectSingleFace(videoElement)
        .withFaceLandmarks();

      if (!detection) {
        return { blinkDetected: this.blinkDetected, ear: null };
      }

      const landmarks = detection.landmarks;
      const leftEye = landmarks.getLeftEye();
      const rightEye = landmarks.getRightEye();

      const leftEAR = computeEAR(leftEye);
      const rightEAR = computeEAR(rightEye);
      const avgEAR = (leftEAR + rightEAR) / 2;

      this.checksPerformed++;

      if (avgEAR < EAR_THRESHOLD) {
        this.closedFrames++;
      } else {
        // Eyes open after being closed = blink completed
        if (this.closedFrames >= BLINK_FRAMES) {
          this.blinkDetected = true;
        }
        this.closedFrames = 0;
      }

      return { blinkDetected: this.blinkDetected, ear: avgEAR };
    } catch (err) {
      return { blinkDetected: this.blinkDetected, ear: null };
    }
  }

  isConfirmed() {
    return this.blinkDetected;
  }
}

function computeEAR(eyePoints) {
  // eye points: [p1, p2, p3, p4, p5, p6]
  // p1 = left corner, p4 = right corner
  // p2, p3 = top, p5, p6 = bottom
  if (eyePoints.length < 6) return 0.3; // Default open

  const p1 = eyePoints[0];
  const p2 = eyePoints[1];
  const p3 = eyePoints[2];
  const p4 = eyePoints[3];
  const p5 = eyePoints[4];
  const p6 = eyePoints[5];

  const vertical1 = distance(p2, p6);
  const vertical2 = distance(p3, p5);
  const horizontal = distance(p1, p4);

  if (horizontal === 0) return 0.3;
  return (vertical1 + vertical2) / (2 * horizontal);
}

function distance(p1, p2) {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}
