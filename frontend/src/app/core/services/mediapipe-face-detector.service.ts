import { Injectable } from '@angular/core';
import { FilesetResolver, FaceDetector, Detection } from '@mediapipe/tasks-vision';
import { FaceBoundingBox, FaceCropMatchRequest } from './face-attendance.service';

export interface DetectedFaceItem {
  index: number;
  score: number;
  box: FaceBoundingBox;
  cropBase64: string;
}

@Injectable({
  providedIn: 'root'
})
export class MediaPipeFaceDetectorService {
  private detector: FaceDetector | null = null;
  private initializingPromise: Promise<FaceDetector> | null = null;

  async initDetector(): Promise<FaceDetector> {
    if (this.detector) return this.detector;
    if (this.initializingPromise) return this.initializingPromise;

    this.initializingPromise = (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        this.detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite',
            delegate: 'GPU'
          },
          runningMode: 'IMAGE',
          minDetectionConfidence: 0.45
        });

        return this.detector;
      } catch (err) {
        console.warn('GPU delegate failed for MediaPipe. Falling back to CPU...', err);
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        this.detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite',
            delegate: 'CPU'
          },
          runningMode: 'IMAGE',
          minDetectionConfidence: 0.45
        });

        return this.detector;
      }
    })();

    return this.initializingPromise;
  }

  async detectAndCropFaces(
    imageSource: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
    photoIndex = 1
  ): Promise<DetectedFaceItem[]> {
    const detector = await this.initDetector();
    const detectionsResult = detector.detect(imageSource);

    const width = imageSource instanceof HTMLVideoElement ? imageSource.videoWidth : imageSource.width;
    const height = imageSource instanceof HTMLVideoElement ? imageSource.videoHeight : imageSource.height;

    const items: DetectedFaceItem[] = [];

    // Create helper canvas for cropping
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = width;
    sourceCanvas.height = height;
    const ctx = sourceCanvas.getContext('2d');
    if (!ctx) return [];

    ctx.drawImage(imageSource, 0, 0, width, height);

    const detections = detectionsResult.detections || [];
    for (let i = 0; i < detections.length; i++) {
      const d = detections[i];
      if (!d.boundingBox) continue;

      const bb = d.boundingBox;
      const score = d.categories && d.categories.length > 0 ? d.categories[0].score : 0.9;

      // Add 20% margin to bounding box for ArcFace alignment
      const marginX = bb.width * 0.2;
      const marginY = bb.height * 0.2;

      const cropX = Math.max(0, bb.originX - marginX);
      const cropY = Math.max(0, bb.originY - marginY);
      const cropW = Math.min(width - cropX, bb.width + marginX * 2);
      const cropH = Math.min(height - cropY, bb.height + marginY * 2);

      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = cropW;
      cropCanvas.height = cropH;
      const cropCtx = cropCanvas.getContext('2d');

      if (cropCtx) {
        cropCtx.drawImage(
          sourceCanvas,
          cropX,
          cropY,
          cropW,
          cropH,
          0,
          0,
          cropW,
          cropH
        );

        const cropBase64 = cropCanvas.toDataURL('image/jpeg', 0.92);

        items.push({
          index: i + 1,
          score: Math.round(score * 100) / 100,
          box: {
            x: Math.round(bb.originX),
            y: Math.round(bb.originY),
            width: Math.round(bb.width),
            height: Math.round(bb.height)
          },
          cropBase64: cropBase64
        });
      }
    }

    return items;
  }
}
