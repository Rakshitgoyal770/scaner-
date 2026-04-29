import type { Image as NitroImage } from "react-native-nitro-image";
import type { MarkerAnalysis } from "./markerAnalysis.types";
import { NORMALIZED_SIZE } from "./markerAnalysis.types";
import {
  clamp,
  getPixel,
  lum,
  sampleDarkRatio,
  sampleRegion,
  sampleRingBand,
} from "./markerPixelUtils";
import { saveGrayscalePreview } from "./markerPreview";

export function getAnalysisScore(metrics: MarkerAnalysis["metrics"]) {
  const borderBonus =
    metrics.outerRingDarkRatio > 0.22 && metrics.innerRingDarkRatio < 0.28
      ? 260
      : metrics.outerRingDarkRatio > 0.14
        ? 60
        : -120;

  const continuityBonus = Math.min(60, metrics.outerRingContinuity * 80);

  const anchorCountBonus =
    metrics.darkCornerCount === 1 ? 220
    : metrics.darkCornerCount === 0 ? -140
    : -220;

  const brightCornerBonus =
    metrics.brightCornerCount >= 2 ? 50
    : metrics.brightCornerCount === 1 ? 10
    : -40;

  const anchorCandidateBonus = metrics.hasAnchorCandidate === 1 ? 120 : -120;

  const anchorSizePenalty =
    metrics.anchorFillRatio > 0.88 ? 300
    : metrics.anchorFillRatio < 0.04 ? 200
    : 0;

  return (
    borderBonus +
    continuityBonus +
    anchorCountBonus +
    brightCornerBonus +
    anchorCandidateBonus +
    Math.min(80, metrics.anchorContrast * 2.5) -
    anchorSizePenalty
  );
}

export async function analyzeNormalizedImage(
  normalized: NitroImage,
  bestRotation: number
): Promise<MarkerAnalysis> {
  const raw = await normalized.toRawPixelDataAsync(false);
  const pixels = new Uint8Array(raw.buffer);
  const width = raw.width;
  const height = raw.height;
  const pixelFormat = raw.pixelFormat;

  const centerSample = sampleRegion(pixels, width, height, pixelFormat, {
    x: width * 0.35,
    y: height * 0.35,
    w: width * 0.30,
    h: height * 0.30,
  });
  const whiteLevel = centerSample.meanBrightness;
  const darkThreshold = clamp(whiteLevel * 0.52, 55, 145);

  const outerRing = sampleRingBand(pixels, width, height, pixelFormat, 0.04, 0.14, darkThreshold);
  const innerRing = sampleRingBand(pixels, width, height, pixelFormat, 0.18, 0.14, darkThreshold);

  const hasSolidBorder =
    outerRing.darkRatio > 0.22 &&
    outerRing.continuity > 0.22 &&
    innerRing.darkRatio < 0.30;

  const darkBorderSides = hasSolidBorder ? 4 : 0;
  const anchorInset = Math.floor(width * 0.16);
  const anchorSize = Math.floor(width * 0.15);

  const cornerRegions = [
    { x: anchorInset, y: anchorInset, w: anchorSize, h: anchorSize },
    { x: width - anchorInset - anchorSize, y: anchorInset, w: anchorSize, h: anchorSize },
    { x: anchorInset, y: height - anchorInset - anchorSize, w: anchorSize, h: anchorSize },
    { x: width - anchorInset - anchorSize, y: height - anchorInset - anchorSize, w: anchorSize, h: anchorSize },
  ];

  const cornerDarkRatios = cornerRegions.map((region) =>
    sampleDarkRatio(pixels, width, height, pixelFormat, region, darkThreshold)
  );
  const cornerBrightness = cornerRegions.map((region) =>
    sampleRegion(pixels, width, height, pixelFormat, region).meanBrightness
  );

  const darkCornerCount = cornerDarkRatios.filter((ratio) => ratio > 0.34).length;
  const clearCornerCount = cornerDarkRatios.filter((ratio) => ratio < 0.18).length;

  const sortedRatios = [...cornerDarkRatios].sort((a, b) => b - a);
  const anchorFillRatio = sortedRatios[0] ?? 0;
  const secondFillRatio = sortedRatios[1] ?? 0;
  const anchorFillContrast = anchorFillRatio - secondFillRatio;

  const sortedBright = [...cornerBrightness].sort((a, b) => a - b);
  const darkestCorner = sortedBright[0] ?? 255;
  const secondDarkestCorner = sortedBright[1] ?? darkestCorner;
  const anchorContrast = secondDarkestCorner - darkestCorner;

  const bestAnchorIndex = cornerDarkRatios.indexOf(anchorFillRatio);
  const brightCornerCount = cornerBrightness.filter(
    (value, index) => index !== bestAnchorIndex && value > whiteLevel * 0.62
  ).length;

  const validAnchor =
    anchorFillRatio >= 0.32 &&
    anchorFillRatio <= 0.88 &&
    anchorFillContrast >= 0.10 &&
    anchorContrast > 6;

  const hasAnchorCandidate = validAnchor ? 1 : 0;

  const center = sampleRegion(pixels, width, height, pixelFormat, {
    x: width * 0.28,
    y: height * 0.28,
    w: width * 0.44,
    h: height * 0.44,
  });
  const centerDarkRatio = sampleDarkRatio(
    pixels,
    width,
    height,
    pixelFormat,
    {
      x: width * 0.28,
      y: height * 0.28,
      w: width * 0.44,
      h: height * 0.44,
    },
    darkThreshold
  );

  const isMarkerLike = hasSolidBorder && darkCornerCount >= 1;
  const isDesiredMarker =
    whiteLevel >= 80 &&
    hasSolidBorder &&
    darkCornerCount === 1 &&
    clearCornerCount >= 2 &&
    hasAnchorCandidate === 1;

  let reason = "Correct Marker";
  if (!isDesiredMarker) {
    if (whiteLevel < 80) {
      reason = "Environment too dark";
    } else if (!hasSolidBorder) {
      if (outerRing.continuity < 0.22) {
        reason = "Border appears dotted or broken";
      } else if (outerRing.darkRatio <= 0.22) {
        reason = `Incomplete border (ring dark ratio ${outerRing.darkRatio.toFixed(2)})`;
      } else {
        reason = "Interior too noisy just inside border";
      }
    } else if (darkCornerCount === 0) {
      reason = "No anchor corner found";
    } else if (darkCornerCount > 1) {
      reason = `Wrong anchor count: ${darkCornerCount} dark corners (need exactly 1)`;
    } else if (clearCornerCount < 2) {
      reason = `Only ${clearCornerCount} clear corners (need >= 2)`;
    } else if (anchorFillRatio > 0.88) {
      reason = "Anchor square is oversized";
    } else if (anchorFillContrast < 0.10) {
      reason = "Anchor not distinct from other corners";
    } else {
      reason = "Anchor pattern too weak";
    }
  }

  return {
    isMarkerLike,
    isDesiredMarker,
    centerCropFilePath: "",
    processedMarkerFilePath: "",
    grayscalePreviewFilePath: "",
    bestRotation,
    metrics: {
      outerRingDarkRatio: outerRing.darkRatio,
      outerRingContinuity: outerRing.continuity,
      innerRingDarkRatio: innerRing.darkRatio,
      darkBorderSides,
      darkestCorner,
      darkCornerCount,
      brightCornerCount,
      anchorContrast,
      hasAnchorCandidate,
      anchorFillRatio,
      topBorder: outerRing.darkRatio,
      rightBorder: outerRing.darkRatio,
      bottomBorder: outerRing.darkRatio,
      leftBorder: outerRing.darkRatio,
      topBorderDarkRatio: outerRing.darkRatio,
      rightBorderDarkRatio: outerRing.darkRatio,
      bottomBorderDarkRatio: outerRing.darkRatio,
      leftBorderDarkRatio: outerRing.darkRatio,
      centerBrightness: center.meanBrightness,
      centerStd: center.brightnessStd,
      centerSaturation: center.meanSaturation,
      ringBrightness: innerRing.darkRatio,
      centerDarkRatio,
    },
    reason,
  };
}

export async function blobCrop(image: NitroImage): Promise<NitroImage> {
  const raw = await image.toRawPixelDataAsync(false);
  const pixels = new Uint8Array(raw.buffer);
  const { width, height } = raw;
  const threshold = 90;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (lum(getPixel(pixels, width, x, y, raw.pixelFormat)) < threshold) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0 || maxX - minX < width * 0.05) {
    return image;
  }

  const blobWidth = maxX - minX;
  const blobHeight = maxY - minY;

  if (blobWidth < width * 0.08 || blobHeight < height * 0.08) {
    return image;
  }

  const padding = Math.round(Math.max(blobWidth, blobHeight) * 0.20);
  return image.cropAsync(
    clamp(minX - padding, 0, width - 1),
    clamp(minY - padding, 0, height - 1),
    clamp(maxX + padding, 0, width),
    clamp(maxY + padding, 0, height)
  );
}

export async function analyzeMarkerImage(image: NitroImage): Promise<MarkerAnalysis> {
  const cropSize = Math.floor(Math.min(image.width, image.height) * 0.60);
  const startX = Math.floor((image.width - cropSize) / 2);
  const startY = Math.floor((image.height - cropSize) / 2);
  const guideCrop = await image.cropAsync(startX, startY, startX + cropSize, startY + cropSize);

  const blobbed = await blobCrop(guideCrop);
  const preSized = await blobbed.resizeAsync(NORMALIZED_SIZE, NORMALIZED_SIZE);

  const rotationCandidates = [0, 90, 180, 270];
  let bestAnalysis: MarkerAnalysis | null = null;
  let bestImage: NitroImage | null = null;
  let bestScore = -Infinity;

  for (const rotation of rotationCandidates) {
    const rotated = rotation === 0 ? preSized : await preSized.rotateAsync(rotation, false);
    const analysis = await analyzeNormalizedImage(rotated, rotation);
    const score = getAnalysisScore(analysis.metrics);

    if (score > bestScore) {
      bestScore = score;
      bestAnalysis = analysis;
      bestImage = rotated;
    }
  }

  if (!bestAnalysis || !bestImage) {
    throw new Error("Unable to analyze the captured marker image.");
  }

  const centerCropFilePath = await bestImage.saveToTemporaryFileAsync("jpg", 85);
  const grayscalePreviewFilePath = await saveGrayscalePreview(bestImage);

  return {
    ...bestAnalysis,
    centerCropFilePath,
    processedMarkerFilePath: centerCropFilePath,
    grayscalePreviewFilePath,
  };
}
