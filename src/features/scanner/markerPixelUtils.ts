import type { PixelFormat, RgbPixel } from "./markerAnalysis.types";

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeFilePath(path: string) {
  return path.startsWith("file://") ? path : `file://${path}`;
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
    default:
      return { r: 0, g: 1, b: 2, bytesPerPixel: 3 };
  }
}

export function getPixel(
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

export function lum({ r, g, b }: RgbPixel) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function sat({ r, g, b }: RgbPixel) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  return max === 0 ? 0 : ((max - min) / max) * 255;
}

export function sampleRegion(
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
      const pixelBrightness = lum(pixel);
      brightnessSum += pixelBrightness;
      brightnessSqSum += pixelBrightness * pixelBrightness;
      saturationSum += sat(pixel);
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

export function sampleDarkRatio(
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
      if (lum(getPixel(pixels, width, x, y, pixelFormat)) < threshold) {
        darkCount += 1;
      }
      count += 1;
    }
  }

  return count > 0 ? darkCount / count : 0;
}

export function sampleRingBand(
  pixels: Uint8Array,
  width: number,
  height: number,
  pixelFormat: PixelFormat,
  insetRatio: number,
  widthRatio: number,
  threshold: number
): { darkRatio: number; continuity: number } {
  const xStart = Math.floor(width * insetRatio);
  const xInner = Math.floor(width * (insetRatio + widthRatio));
  const yStart = Math.floor(height * insetRatio);
  const yInner = Math.floor(height * (insetRatio + widthRatio));
  const xRight = width - xInner;
  const yBottom = height - yInner;

  let dark = 0;
  let count = 0;
  let transitions = 0;
  let prev = false;

  function sample(x: number, y: number) {
    const isDark = lum(getPixel(pixels, width, x, y, pixelFormat)) < threshold;
    if (isDark) {
      dark += 1;
    }
    if (isDark !== prev) {
      transitions += 1;
    }
    prev = isDark;
    count += 1;
  }

  for (let y = yStart; y < yInner; y += 1) {
    for (let x = xStart; x < width - xStart; x += 1) {
      sample(x, y);
    }
  }
  for (let y = yBottom; y < height - yStart; y += 1) {
    for (let x = xStart; x < width - xStart; x += 1) {
      sample(x, y);
    }
  }
  for (let y = yInner; y < yBottom; y += 1) {
    for (let x = xStart; x < xInner; x += 1) {
      sample(x, y);
    }
  }
  for (let y = yInner; y < yBottom; y += 1) {
    for (let x = xRight; x < width - xStart; x += 1) {
      sample(x, y);
    }
  }

  return {
    darkRatio: count > 0 ? dark / count : 0,
    continuity: count > 0 ? 1 - transitions / count : 0,
  };
}
