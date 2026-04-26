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
  bestRotation: number;
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
    hasAnchorCandidate: number;
    anchorFillRatio: number;
    centerBrightness: number;
    centerStd: number;
    centerSaturation: number;
    ringBrightness: number;
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

function getAnalysisScore(metrics: MarkerAnalysis["metrics"]) {
  const borderBonus =
    metrics.darkBorderSides === 4
      ? 260
      : metrics.darkBorderSides === 3
        ? 80
        : -120;
  const anchorCountBonus =
    metrics.darkCornerCount === 1
      ? 220
      : metrics.darkCornerCount === 0
        ? -140
        : -220;
  const brightCornerBonus =
    metrics.brightCornerCount >= 2
      ? 50
      : metrics.brightCornerCount === 1
        ? 10
        : -40;
  const anchorCandidateBonus = metrics.hasAnchorCandidate === 1 ? 120 : -120;
  const anchorSizePenalty =
    metrics.anchorFillRatio > 0.85
      ? 140
      : metrics.anchorFillRatio < 0.2
        ? 60
        : 0;
  const payloadPenalty = metrics.centerDarkRatio * 140 + anchorSizePenalty;

  return (
    borderBonus +
    anchorCountBonus +
    brightCornerBonus +
    anchorCandidateBonus +
    Math.min(80, metrics.anchorContrast * 2.5) +
    Math.min(80, metrics.centerSaturation * 0.8) +
    Math.min(60, metrics.centerStd) -
    payloadPenalty
  );
}

async function analyzeNormalizedImage(
  normalized: NitroImage,
  bestRotation: number
): Promise<MarkerAnalysis> {
  const raw = await normalized.toRawPixelDataAsync(false);
  const pixels = new Uint8Array(raw.buffer);
  const width = raw.width;
  const height = raw.height;
  const borderThickness = width * 0.09;
  const borderInset = width * 0.14;
  const cornerSize = width * 0.18;
  const anchorInset = width * 0.09;
  const anchorSize = width * 0.11;

  const topBorderRegion = {
    x: borderInset,
    y: 0,
    w: width - borderInset * 2,
    h: borderThickness,
  };
  const rightBorderRegion = {
    x: width - borderThickness,
    y: borderInset,
    w: borderThickness,
    h: height - borderInset * 2,
  };
  const bottomBorderRegion = {
    x: borderInset,
    y: height - borderThickness,
    w: width - borderInset * 2,
    h: borderThickness,
  };
  const leftBorderRegion = {
    x: 0,
    y: borderInset,
    w: borderThickness,
    h: height - borderInset * 2,
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
  const anchorDarkRatios = [
    sampleDarkRatio(
      pixels,
      width,
      height,
      raw.pixelFormat,
      {
        x: anchorInset,
        y: anchorInset,
        w: anchorSize,
        h: anchorSize,
      },
      120
    ),
    sampleDarkRatio(
      pixels,
      width,
      height,
      raw.pixelFormat,
      {
        x: width - anchorInset - anchorSize,
        y: anchorInset,
        w: anchorSize,
        h: anchorSize,
      },
      120
    ),
    sampleDarkRatio(
      pixels,
      width,
      height,
      raw.pixelFormat,
      {
        x: anchorInset,
        y: height - anchorInset - anchorSize,
        w: anchorSize,
        h: anchorSize,
      },
      120
    ),
    sampleDarkRatio(
      pixels,
      width,
      height,
      raw.pixelFormat,
      {
        x: width - anchorInset - anchorSize,
        y: height - anchorInset - anchorSize,
        w: anchorSize,
        h: anchorSize,
      },
      120
    ),
  ];
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
    topBorder < 220 && topBorderDarkRatio > 0.12,
    rightBorder < 220 && rightBorderDarkRatio > 0.12,
    bottomBorder < 220 && bottomBorderDarkRatio > 0.12,
    leftBorder < 220 && leftBorderDarkRatio > 0.12,
  ];
  const darkBorderSides = borderChecks.filter(Boolean).length;
  const sortedAnchorCorners = [...anchorCorners].sort((a, b) => a - b);
  const darkestCorner = sortedAnchorCorners[0] ?? 255;
  const secondDarkestCorner = sortedAnchorCorners[1] ?? darkestCorner;
  const validAnchorMin = 0.08;
  const validAnchorMax = 0.9;
  const sortedAnchorDarkRatios = [...anchorDarkRatios].sort((a, b) => b - a);
  const anchorFillRatio = sortedAnchorDarkRatios[0] ?? 0;
  const secondAnchorFillRatio = sortedAnchorDarkRatios[1] ?? 0;
  const anchorFillContrast = anchorFillRatio - secondAnchorFillRatio;
  const bestAnchorIndex = anchorDarkRatios.findIndex(
    (value) => value === anchorFillRatio
  );
  const darkCornerCount = anchorDarkRatios.filter(
    (value) => value >= validAnchorMin && value <= validAnchorMax
  ).length;
  const brightCornerCount = anchorCorners.filter(
    (value, index) => index !== bestAnchorIndex && value > 150
  ).length;
  const anchorContrast = secondDarkestCorner - darkestCorner;
  const hasAnchorCandidate =
    anchorFillRatio >= validAnchorMin &&
    anchorFillRatio <= validAnchorMax &&
    (anchorFillContrast >= 0.01 || darkestCorner < 210 || anchorContrast > 0.5)
      ? 1
      : 0;
  const centerVsRingDelta = center.meanBrightness - ring.meanBrightness;
  const coreMarkerMatch =
    darkBorderSides >= 4 &&
    center.meanSaturation > 45 &&
    center.brightnessStd > 18 &&
    (hasAnchorCandidate === 1 || anchorFillRatio >= validAnchorMin || darkestCorner < 210);
  const explicitWrongMarker =
    centerDarkRatio >= 0.16 ||
    center.meanSaturation < 32 ||
    center.brightnessStd < 14;

  const isMarkerLike =
    darkBorderSides >= 3 &&
    corners.some((value) => value < 150) &&
    center.meanBrightness > 85;
  const isDesiredMarker =
    isMarkerLike &&
    !explicitWrongMarker &&
    (
      coreMarkerMatch ||
      (
        darkBorderSides >= 4 &&
        center.meanSaturation > 45 &&
        center.brightnessStd > 18 &&
        (hasAnchorCandidate === 1 || anchorFillRatio >= validAnchorMin || darkestCorner < 210) &&
        centerVsRingDelta > -24
      )
    );

  let reason = "Marker not found inside the guide frame.";
  if (isDesiredMarker) {
    reason = "Marker 1-like pattern found in the captured guide area.";
  } else if (isMarkerLike) {
    if (explicitWrongMarker && centerDarkRatio >= 0.16) {
      reason = "Square found, but it contains too much solid dark content in the center.";
    } else if (explicitWrongMarker && center.meanSaturation < 32) {
      reason = "Square found, but the inner marker content is too plain to match the target marker.";
    } else if (explicitWrongMarker && center.brightnessStd < 14) {
      reason = "Square found, but the inner marker content lacks enough detail to match the target marker.";
    } else if (darkBorderSides < 4) {
      reason = "Square found, but not all four outer borders were confirmed.";
    } else if (hasAnchorCandidate !== 1) {
      reason = "Square found, but the anchor corner was not strong enough to identify reliably.";
    } else if (coreMarkerMatch) {
      reason = "Marker 1-like pattern found in the captured guide area.";
    } else if (anchorContrast <= 1.5) {
      reason = "Square found, but the anchor corner was not distinct enough.";
    } else if (center.meanSaturation <= 32 || center.brightnessStd <= 14) {
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
    centerCropFilePath: "",
    bestRotation,
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
      hasAnchorCandidate,
      anchorFillRatio,
      centerBrightness: center.meanBrightness,
      centerStd: center.brightnessStd,
      centerSaturation: center.meanSaturation,
      ringBrightness: ring.meanBrightness,
      centerDarkRatio,
    },
    reason,
  };
}

export async function analyzeMarkerImage(image: NitroImage): Promise<MarkerAnalysis> {
  const cropSize = Math.floor(Math.min(image.width, image.height) * 0.56);
  const startX = Math.floor((image.width - cropSize) / 2);
  const startY = Math.floor((image.height - cropSize) / 2);
  const cropped = await image.cropAsync(startX, startY, startX + cropSize, startY + cropSize);

  const rotationCandidates = [0, 45, 90, 135, 180, 225, 270, 315];
  let bestAnalysis: MarkerAnalysis | null = null;
  let bestImage: NitroImage | null = null;
  let bestScore = -Infinity;

  for (const rotation of rotationCandidates) {
    const rotated =
      rotation === 0 ? cropped : await cropped.rotateAsync(rotation, false);
    const normalized = await rotated.resizeAsync(NORMALIZED_SIZE, NORMALIZED_SIZE);
    const analysis = await analyzeNormalizedImage(normalized, rotation);
    const score = getAnalysisScore(analysis.metrics);

    if (score > bestScore) {
      bestScore = score;
      bestAnalysis = analysis;
      bestImage = normalized;
    }
  }

  if (!bestAnalysis || !bestImage) {
    throw new Error("Unable to analyze the captured marker image.");
  }

  const centerCropFilePath = await bestImage.saveToTemporaryFileAsync("jpg", 85);

  return {
    ...bestAnalysis,
    centerCropFilePath,
  };
}

export async function analyzeCapturedMarker(filePath: string): Promise<MarkerAnalysis> {
  const image = await Images.loadFromFileAsync(normalizeFilePath(filePath));
  return analyzeMarkerImage(image);
}
