import { Images } from "react-native-nitro-image";
import type { Image as NitroImage } from "react-native-nitro-image";
import type { MarkerAnalysis } from "./markerAnalysis.types";
import { analyzeMarkerImage as analyzeMarkerImageCore } from "./markerAnalyzerCore";
import { normalizeFilePath } from "./markerPixelUtils";

export type { MarkerAnalysis } from "./markerAnalysis.types";

export async function analyzeMarkerImage(image: NitroImage): Promise<MarkerAnalysis> {
  return analyzeMarkerImageCore(image);
}

export async function analyzeCapturedMarker(filePath: string): Promise<MarkerAnalysis> {
  const image = await Images.loadFromFileAsync(normalizeFilePath(filePath));
  return analyzeMarkerImageCore(image);
}
