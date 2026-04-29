export type PixelFormat =
  | "ARGB"
  | "BGRA"
  | "ABGR"
  | "RGBA"
  | "XRGB"
  | "BGRX"
  | "XBGR"
  | "RGBX"
  | "RGB"
  | "BGR"
  | "unknown";

export interface MarkerAnalysis {
  isMarkerLike: boolean;
  isDesiredMarker: boolean;
  centerCropFilePath: string;
  processedMarkerFilePath: string;
  grayscalePreviewFilePath: string;
  bestRotation: number;
  metrics: {
    outerRingDarkRatio: number;
    outerRingContinuity: number;
    innerRingDarkRatio: number;
    darkBorderSides: number;
    darkestCorner: number;
    darkCornerCount: number;
    brightCornerCount: number;
    anchorContrast: number;
    hasAnchorCandidate: number;
    anchorFillRatio: number;
    topBorder: number;
    rightBorder: number;
    bottomBorder: number;
    leftBorder: number;
    topBorderDarkRatio: number;
    rightBorderDarkRatio: number;
    bottomBorderDarkRatio: number;
    leftBorderDarkRatio: number;
    centerBrightness: number;
    centerStd: number;
    centerSaturation: number;
    ringBrightness: number;
    centerDarkRatio: number;
  };
  reason: string;
}

export interface RgbPixel {
  r: number;
  g: number;
  b: number;
}

export const NORMALIZED_SIZE = 300;
