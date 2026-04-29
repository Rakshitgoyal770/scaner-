import { Images } from "react-native-nitro-image";
import type { Image as NitroImage } from "react-native-nitro-image";
import { getPixel, lum } from "./markerPixelUtils";

export async function saveGrayscalePreview(image: NitroImage) {
  const raw = await image.toRawPixelDataAsync(false);
  const source = new Uint8Array(raw.buffer);
  const grayscale = new Uint8Array(raw.width * raw.height * 4);

  for (let y = 0; y < raw.height; y += 1) {
    for (let x = 0; x < raw.width; x += 1) {
      const offset = (y * raw.width + x) * 4;
      const gray = Math.round(lum(getPixel(source, raw.width, x, y, raw.pixelFormat)));
      grayscale[offset] = gray;
      grayscale[offset + 1] = gray;
      grayscale[offset + 2] = gray;
      grayscale[offset + 3] = 255;
    }
  }

  const grayscaleImage = await Images.loadFromRawPixelDataAsync(
    {
      buffer: grayscale.buffer as ArrayBuffer,
      width: raw.width,
      height: raw.height,
      pixelFormat: "RGBA",
    },
    false
  );

  return grayscaleImage.saveToTemporaryFileAsync("jpg", 85);
}
