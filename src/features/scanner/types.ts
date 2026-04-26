export type DetectionState = "scanning" | "detected" | "captured";

export interface DetectedBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ScannerOverlayState {
  detectionState: DetectionState;
  capturedCount: number;
  detectedBox: DetectedBox | null;
  statusMessage: string;
}
