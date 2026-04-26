import { Images } from "react-native-nitro-image";
import type { Image as NitroImage } from "react-native-nitro-image";

type PixelFormat =
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
  metrics: {
    topBorder: number;
    rightBorder: number;
    bottomBorder: number;
    leftBorder: number;
    topBorderDarkRatio: number;
    rightBorderDarkRatio: number;
    bottomBorderDarkRatio: number;
    leftBorderDarkRatio: number;
    darkBorderSides: number;
    darkestCorner: number;
    darkCornerCount: number;
    brightCornerCount: number;
    anchorContrast: number;
    centerBrightness: number;
    centerStd: number;
    centerSaturation: number;
    ringBrightness: number;
    warningRedness: number;
    centerDarkRatio: number;
  };
  reason: string;
}

interface RgbPixel {
  r: number;
  g: number;
  b: number;
}

const NORMALIZED_SIZE = 320;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeFilePath(filePath: string) {
  return filePath.startsWith("file://") ? filePath : `file://${filePath}`;
}

function getChannelOrder(pixelFormat: PixelFormat) {
  switch (pixelFormat) {
    case "BGRA":
    case "BGRX":
    case "BGR":
      return { r: 2, g: 1, b: 0, bytesPerPixel: pixelFormat === "BGR" ? 3 : 4 };
    case "ARGB":
    case "XRGB":
      return { r: 1, g: 2, b: 3, bytesPerPixel: 4 };
    case "ABGR":
    case "XBGR":
      return { r: 3, g: 2, b: 1, bytesPerPixel: 4 };
    case "RGBA":
    case "RGBX":
      return { r: 0, g: 1, b: 2, bytesPerPixel: 4 };
    case "RGB":
    case "unknown":
    default:
      return { r: 0, g: 1, b: 2, bytesPerPixel: 3 };
  }
}

function getPixel(
  pixels: Uint8Array,
  width: number,
  x: number,
  y: number,
  pixelFormat: PixelFormat
): RgbPixel {
  const { r, g, b, bytesPerPixel } = getChannelOrder(pixelFormat);
  const offset = (y * width + x) * bytesPerPixel;

  return {
    r: pixels[offset + r] ?? 0,
    g: pixels[offset + g] ?? 0,
    b: pixels[offset + b] ?? 0,
  };
}

function luminance({ r, g, b }: RgbPixel) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function saturation({ r, g, b }: RgbPixel) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  if (max === 0) {
    return 0;
  }

  return ((max - min) / max) * 255;
}

function redness({ r, g, b }: RgbPixel) {
  return r - (g + b) / 2;
}

function sampleRegion(
  pixels: Uint8Array,
  width: number,
  height: number,
  pixelFormat: PixelFormat,
  region: { x: number; y: number; w: number; h: number }
) {
  const startX = clamp(Math.floor(region.x), 0, width - 1);
  const startY = clamp(Math.floor(region.y), 0, height - 1);
  const endX = clamp(Math.ceil(region.x + region.w), startX + 1, width);
  const endY = clamp(Math.ceil(region.y + region.h), startY + 1, height);

  let brightnessSum = 0;
  let brightnessSqSum = 0;
  let saturationSum = 0;
  let count = 0;

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const pixel = getPixel(pixels, width, x, y, pixelFormat);
      const pixelBrightness = luminance(pixel);

      brightnessSum += pixelBrightness;
      brightnessSqSum += pixelBrightness * pixelBrightness;
      saturationSum += saturation(pixel);
      count += 1;
    }
  }

  const meanBrightness = count > 0 ? brightnessSum / count : 0;
  const variance =
    count > 0 ? Math.max(0, brightnessSqSum / count - meanBrightness * meanBrightness) : 0;

  return {
    meanBrightness,
    brightnessStd: Math.sqrt(variance),
    meanSaturation: count > 0 ? saturationSum / count : 0,
  };
}

function sampleRedness(
  pixels: Uint8Array,
  width: number,
  height: number,
  pixelFormat: PixelFormat,
  region: { x: number; y: number; w: number; h: number }
) {
  const startX = clamp(Math.floor(region.x), 0, width - 1);
  const startY = clamp(Math.floor(region.y), 0, height - 1);
  const endX = clamp(Math.ceil(region.x + region.w), startX + 1, width);
  const endY = clamp(Math.ceil(region.y + region.h), startY + 1, height);

  let sum = 0;
  let count = 0;

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      sum += redness(getPixel(pixels, width, x, y, pixelFormat));
      count += 1;
    }
  }

  return count > 0 ? sum / count : 0;
}

function sampleDarkRatio(
  pixels: Uint8Array,
  width: number,
  height: number,
  pixelFormat: PixelFormat,
  region: { x: number; y: number; w: number; h: number },
  threshold: number
) {
  const startX = clamp(Math.floor(region.x), 0, width - 1);
  const startY = clamp(Math.floor(region.y), 0, height - 1);
  const endX = clamp(Math.ceil(region.x + region.w), startX + 1, width);
  const endY = clamp(Math.ceil(region.y + region.h), startY + 1, height);

  let darkCount = 0;
  let count = 0;

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      if (luminance(getPixel(pixels, width, x, y, pixelFormat)) < threshold) {
        darkCount += 1;
      }
      count += 1;
    }
  }

  return count > 0 ? darkCount / count : 0;
}

export async function analyzeMarkerImage(image: NitroImage): Promise<MarkerAnalysis> {
  const cropSize = Math.floor(Math.min(image.width, image.height) * 0.56);
  const startX = Math.floor((image.width - cropSize) / 2);
  const startY = Math.floor((image.height - cropSize) / 2);
  const cropped = await image.cropAsync(startX, startY, startX + cropSize, startY + cropSize);
  const normalized = await cropped.resizeAsync(NORMALIZED_SIZE, NORMALIZED_SIZE);
  const raw = await normalized.toRawPixelDataAsync(false);
  const pixels = new Uint8Array(raw.buffer);
  const width = raw.width;
  const height = raw.height;
  const borderThickness = width * 0.14;
  const cornerSize = width * 0.2;
  const anchorInset = width * 0.12;
  const anchorSize = width * 0.16;

  const topBorderRegion = {
    x: width * 0.08,
    y: 0,
    w: width * 0.84,
    h: borderThickness,
  };
  const rightBorderRegion = {
    x: width - borderThickness,
    y: height * 0.08,
    w: borderThickness,
    h: height * 0.84,
  };
  const bottomBorderRegion = {
    x: width * 0.08,
    y: height - borderThickness,
    w: width * 0.84,
    h: borderThickness,
  };
  const leftBorderRegion = {
    x: 0,
    y: height * 0.08,
    w: borderThickness,
    h: height * 0.84,
  };
  const topBorderStats = sampleRegion(
    pixels,
    width,
    height,
    raw.pixelFormat,
    topBorderRegion
  );
  const rightBorderStats = sampleRegion(
    pixels,
    width,
    height,
    raw.pixelFormat,
    rightBorderRegion
  );
  const bottomBorderStats = sampleRegion(
    pixels,
    width,
    height,
    raw.pixelFormat,
    bottomBorderRegion
  );
  const leftBorderStats = sampleRegion(
    pixels,
    width,
    height,
    raw.pixelFormat,
    leftBorderRegion
  );
  const topBorder = topBorderStats.meanBrightness;
  const rightBorder = rightBorderStats.meanBrightness;
  const bottomBorder = bottomBorderStats.meanBrightness;
  const leftBorder = leftBorderStats.meanBrightness;
  const topBorderDarkRatio = sampleDarkRatio(
    pixels,
    width,
    height,
    raw.pixelFormat,
    topBorderRegion,
    145
  );
  const rightBorderDarkRatio = sampleDarkRatio(
    pixels,
    width,
    height,
    raw.pixelFormat,
    rightBorderRegion,
    145
  );
  const bottomBorderDarkRatio = sampleDarkRatio(
    pixels,
    width,
    height,
    raw.pixelFormat,
    bottomBorderRegion,
    145
  );
  const leftBorderDarkRatio = sampleDarkRatio(
    pixels,
    width,
    height,
    raw.pixelFormat,
    leftBorderRegion,
    145
  );
  const center = sampleRegion(pixels, width, height, raw.pixelFormat, {
    x: width * 0.25,
    y: height * 0.25,
    w: width * 0.5,
    h: height * 0.5,
  });
  const ring = sampleRegion(pixels, width, height, raw.pixelFormat, {
    x: width * 0.14,
    y: height * 0.14,
    w: width * 0.72,
    h: height * 0.72,
  });
  const corners = [
    sampleRegion(pixels, width, height, raw.pixelFormat, {
      x: width * 0.04,
      y: height * 0.04,
      w: cornerSize,
      h: cornerSize,
    }).meanBrightness,
    sampleRegion(pixels, width, height, raw.pixelFormat, {
      x: width - cornerSize - width * 0.04,
      y: height * 0.04,
      w: cornerSize,
      h: cornerSize,
    }).meanBrightness,
    sampleRegion(pixels, width, height, raw.pixelFormat, {
      x: width * 0.04,
      y: height - cornerSize - height * 0.04,
      w: cornerSize,
      h: cornerSize,
    }).meanBrightness,
    sampleRegion(pixels, width, height, raw.pixelFormat, {
      x: width - cornerSize - width * 0.04,
      y: height - cornerSize - height * 0.04,
      w: cornerSize,
      h: cornerSize,
    }).meanBrightness,
  ];
  const anchorCorners = [
    sampleRegion(pixels, width, height, raw.pixelFormat, {
      x: anchorInset,
      y: anchorInset,
      w: anchorSize,
      h: anchorSize,
    }).meanBrightness,
    sampleRegion(pixels, width, height, raw.pixelFormat, {
      x: width - anchorInset - anchorSize,
      y: anchorInset,
      w: anchorSize,
      h: anchorSize,
    }).meanBrightness,
    sampleRegion(pixels, width, height, raw.pixelFormat, {
      x: anchorInset,
      y: height - anchorInset - anchorSize,
      w: anchorSize,
      h: anchorSize,
    }).meanBrightness,
    sampleRegion(pixels, width, height, raw.pixelFormat, {
      x: width - anchorInset - anchorSize,
      y: height - anchorInset - anchorSize,
      w: anchorSize,
      h: anchorSize,
    }).meanBrightness,
  ];
  const warningRedness = sampleRedness(pixels, width, height, raw.pixelFormat, {
    x: width * 0.62,
    y: height * 0.62,
    w: width * 0.24,
    h: height * 0.24,
  });
  const centerDarkRatio = sampleDarkRatio(
    pixels,
    width,
    height,
    raw.pixelFormat,
    {
      x: width * 0.3,
      y: height * 0.3,
      w: width * 0.4,
      h: height * 0.4,
    },
    85
  );

  const borderChecks = [
    topBorder < 185 && topBorderDarkRatio > 0.28,
    rightBorder < 185 && rightBorderDarkRatio > 0.28,
    bottomBorder < 185 && bottomBorderDarkRatio > 0.28,
    leftBorder < 185 && leftBorderDarkRatio > 0.28,
  ];
  const darkBorderSides = borderChecks.filter(Boolean).length;
  const darkCornerCount = anchorCorners.filter((value) => value < 120).length;
  const brightCornerCount = anchorCorners.filter((value) => value > 165).length;
  const darkestCorner = Math.min(...anchorCorners);
  const secondDarkestCorner =
    [...anchorCorners].sort((a, b) => a - b)[1] ?? darkestCorner;
  const anchorContrast = secondDarkestCorner - darkestCorner;
  const centerVsRingDelta = center.meanBrightness - ring.meanBrightness;

  const isMarkerLike =
    darkBorderSides >= 3 &&
    corners.some((value) => value < 150) &&
    center.meanBrightness > 85;
  const isDesiredMarker =
    isMarkerLike &&
    darkBorderSides >= 4 &&
    darkCornerCount >= 1 &&
    darkCornerCount <= 1 &&
    brightCornerCount >= 1 &&
    anchorContrast > 10 &&
    center.meanSaturation > 18 &&
    center.brightnessStd > 22 &&
    centerVsRingDelta > -24 &&
    warningRedness < 22 &&
    centerDarkRatio < 0.16;

  let reason = "Marker not found inside the guide frame.";
  if (isDesiredMarker) {
    reason = "Marker 1-like pattern found in the captured guide area.";
  } else if (isMarkerLike) {
    if (darkBorderSides < 4) {
      reason = "Square found, but not all four outer borders were confirmed.";
    } else if (darkCornerCount !== 1) {
      reason = "Square found, but the inset anchor check did not isolate exactly one dark corner.";
    } else if (anchorContrast <= 10) {
      reason = "Square found, but the anchor corner was not distinct enough.";
    } else if (warningRedness >= 22) {
      reason = "Square found, but it contains a red warning-like mark in the lower-right.";
    } else if (centerDarkRatio >= 0.16) {
      reason = "Square found, but it contains too much solid dark content in the center.";
    } else if (center.meanSaturation <= 18 || center.brightnessStd <= 22) {
      reason = "Square found, but the inner marker content looked too plain.";
    } else {
      reason = "Marker-like square found, but the inner content did not match strongly enough.";
    }
  } else if (darkBorderSides < 3) {
    reason = "The guide area did not contain a strong dark square border.";
  } else if (darkestCorner >= 130) {
    reason = "The guide area did not show a strong dark anchor corner.";
  } else if (brightCornerCount < 2) {
    reason = "The guide area did not show the expected single-corner anchor pattern.";
  } else if (center.meanBrightness <= 70) {
    reason = "The guide area was too dark or too noisy to analyze clearly.";
  }

  const centerCropFilePath = await normalized.saveToTemporaryFileAsync("jpg", 85);

  return {
    isMarkerLike,
    isDesiredMarker,
    centerCropFilePath,
    metrics: {
      topBorder,
      rightBorder,
      bottomBorder,
      leftBorder,
      topBorderDarkRatio,
      rightBorderDarkRatio,
      bottomBorderDarkRatio,
      leftBorderDarkRatio,
      darkBorderSides,
      darkestCorner,
      darkCornerCount,
      brightCornerCount,
      anchorContrast,
      centerBrightness: center.meanBrightness,
      centerStd: center.brightnessStd,
      centerSaturation: center.meanSaturation,
      ringBrightness: ring.meanBrightness,
      warningRedness,
      centerDarkRatio,
    },
    reason,
  };
}

export async function analyzeCapturedMarker(filePath: string): Promise<MarkerAnalysis> {
  const image = await Images.loadFromFileAsync(normalizeFilePath(filePath));
  return analyzeMarkerImage(image);
}
