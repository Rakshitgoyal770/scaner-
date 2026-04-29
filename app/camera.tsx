import { useEffect, useMemo, useRef, useState } from "react";
import type { Image as NitroImage } from "react-native-nitro-image";
import {
  Camera,
  type CameraRef,
  useCameraDevice,
  useCameraPermission,
} from "react-native-vision-camera";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { analyzeMarkerImage } from "../src/features/scanner/analyzeCapturedMarker";
import { useMarkerScanner } from "../src/features/scanner/useMarkerScanner";

const GUIDE_SIZE = 260;
const CAPTURE_LIMIT = 20;

interface CapturedMarkerItem {
  id: string;
  uri: string;
  accepted: boolean;
}

interface CameraFormatCandidate {
  photoWidth?: number;
  photoHeight?: number;
  videoWidth?: number;
  videoHeight?: number;
}

function normalizeUri(filePath: string) {
  return filePath.startsWith("file://") ? filePath : `file://${filePath}`;
}

export default function CameraScreen() {
  const permission = useCameraPermission();
  const cameraRef = useRef<CameraRef>(null);
  const [isFacingBack, setIsFacingBack] = useState(true);
  const [isPreviewReady, setIsPreviewReady] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisSummary, setAnalysisSummary] = useState(
    "Align the marker inside the guide frame, then capture a stable preview snapshot."
  );
  const [cropPreviewUri, setCropPreviewUri] = useState<string | null>(null);
  const [grayscalePreviewUri, setGrayscalePreviewUri] = useState<string | null>(null);
  const [metricLine, setMetricLine] = useState<string | null>(null);
  const [capturedMarkers, setCapturedMarkers] = useState<CapturedMarkerItem[]>([]);
  const device = useCameraDevice(isFacingBack ? "back" : "front");
  const deviceWithFormats = device as (typeof device & { formats?: CameraFormatCandidate[] }) | undefined;
  const format = useMemo(() => {
    if (!deviceWithFormats?.formats?.length) {
      return undefined;
    }

    const targetSize = 2560;
    const pickMetric = (candidate: CameraFormatCandidate) => {
      const width = candidate.photoWidth ?? candidate.videoWidth ?? 0;
      const height = candidate.photoHeight ?? candidate.videoHeight ?? 0;
      const distance = Math.abs(width - targetSize) + Math.abs(height - targetSize);
      const inRange =
        width >= 2000 &&
        width <= 3000 &&
        height >= 2000 &&
        height <= 3000;

      return {
        width,
        height,
        distance,
        inRange,
      };
    };

    const sorted = [...deviceWithFormats.formats].sort((left, right) => {
      const a = pickMetric(left);
      const b = pickMetric(right);

      if (a.inRange !== b.inRange) {
        return a.inRange ? -1 : 1;
      }

      return a.distance - b.distance;
    });

    return sorted[0];
  }, [deviceWithFormats]);
  const {
    detectionState,
    capturedCount,
    detectedBox,
    statusMessage,
    previewCandidate,
    completeCapture,
    resetOverlay,
  } = useMarkerScanner();
  const guideIsActive = detectedBox !== null || detectionState !== "scanning";
  const centeredGuideBox = useMemo(
    () => ({
      x: 0,
      y: 0,
      w: GUIDE_SIZE,
      h: GUIDE_SIZE,
    }),
    []
  );
  const isComplete = capturedMarkers.length >= CAPTURE_LIMIT;

  useEffect(() => {
    if (!format) {
      return;
    }

    const width = format.photoWidth ?? format.videoWidth ?? 0;
    const height = format.photoHeight ?? format.videoHeight ?? 0;
    const valid =
      width >= 2000 &&
      width <= 3000 &&
      height >= 2000 &&
      height <= 3000;

    console.log(
      `Camera format: ${width}x${height} - ${valid ? "valid" : "out of range"}`
    );
  }, [format]);

  async function handleCaptureAndAnalyze() {
    if (isAnalyzing || isComplete) {
      return;
    }

    if (!cameraRef.current || !isPreviewReady) {
      setAnalysisSummary("Camera preview is still starting. Wait for the live feed, then try again.");
      return;
    }

    let snapshot: NitroImage | null = null;

    try {
      setIsAnalyzing(true);
      setAnalysisSummary("Capturing preview snapshot...");
      setMetricLine(null);

      snapshot = await cameraRef.current.takeSnapshot();

      setAnalysisSummary("Analyzing captured guide area...");

      const result = await analyzeMarkerImage(snapshot);
      const guideCropUri = normalizeUri(result.centerCropFilePath);
      const grayscaleUri = normalizeUri(result.grayscalePreviewFilePath);

      setCropPreviewUri(guideCropUri);
      setGrayscalePreviewUri(grayscaleUri);
      setMetricLine(
        `Borders ${result.metrics.darkBorderSides}/4 | Dark corners ${result.metrics.darkCornerCount} | Center saturation ${result.metrics.centerSaturation.toFixed(
          1
        )} | Rotation ${result.bestRotation} deg`
      );

      if (result.isDesiredMarker) {
        completeCapture(centeredGuideBox);
        setCapturedMarkers((current) => {
          if (current.length >= CAPTURE_LIMIT) {
            return current;
          }

          return [
            ...current,
            {
              id: `${Date.now()}-${current.length}`,
              uri: guideCropUri,
              accepted: true,
            },
          ];
        });
      } else if (result.isMarkerLike) {
        previewCandidate(centeredGuideBox);
      } else {
        resetOverlay();
      }

      setAnalysisSummary(result.reason);
    } catch (error) {
      resetOverlay();
      setCropPreviewUri(null);
      setGrayscalePreviewUri(null);
      setMetricLine(null);
      setAnalysisSummary(
        error instanceof Error
          ? `Capture failed: ${error.message}`
          : "Capture failed while analyzing the preview snapshot."
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleReset() {
    resetOverlay();
    setCropPreviewUri(null);
    setGrayscalePreviewUri(null);
    setMetricLine(null);
    setCapturedMarkers([]);
    setAnalysisSummary(
      "Align the marker inside the guide frame, then capture a stable preview snapshot."
    );
  }

  if (!permission) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Wait while checking camera permission...</Text>
      </View>
    );
  }

  if (!permission.hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Camera access is required</Text>
        <Pressable style={styles.permissionButton} onPress={permission.requestPermission}>
          <Text style={styles.permissionButtonText}>Grant permission</Text>
        </Pressable>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Looking for camera device...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        {...({
          ref: cameraRef,
          style: StyleSheet.absoluteFillObject,
          device,
          isActive: true,
          format,
          photo: true,
          onPreviewStarted: () => {
            setIsPreviewReady(true);
            setAnalysisSummary(
              "Align the marker inside the guide frame, then capture a stable preview snapshot."
            );
          },
          onPreviewStopped: () => {
            setIsPreviewReady(false);
          },
          onError: (error: Error) => {
            setIsPreviewReady(false);
            setAnalysisSummary(`Camera error: ${error.message}`);
          },
        } as any)}
      />

      <View style={styles.topPanel}>
        <Text style={styles.title}>Marker Scanner</Text>
        <Text style={styles.subtitle}>
          This build validates the centered guide crop directly, checks the border
          and anchor pattern across several rotations, and collects up to 20 accepted markers.
        </Text>
      </View>

      <View style={styles.overlay}>
        <View style={styles.scanFrame}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>

        <View
          style={[
            styles.guideResultFrame,
            guideIsActive ? styles.guideResultFrameVisible : null,
            detectionState === "captured" ? styles.guideResultFrameCaptured : null,
          ]}
        />

        <Text
          style={[
            styles.statusText,
            detectionState === "detected" ? styles.statusTextActive : null,
            detectionState === "captured" ? styles.statusTextCaptured : null,
          ]}
        >
          {isAnalyzing ? "Analyzing preview snapshot..." : isComplete ? "20 / 20 captured" : statusMessage}
        </Text>
      </View>

      <View style={styles.bottomPanel}>
        <View style={styles.infoPill}>
          <Text style={styles.infoPillText}>
            Accepted: {capturedMarkers.length} / {CAPTURE_LIMIT}
          </Text>
        </View>

        <View style={styles.resultCard}>
          <Text style={styles.resultLabel}>Latest analysis</Text>
          <Text style={styles.resultText}>{analysisSummary}</Text>
          {metricLine ? <Text style={styles.metricText}>{metricLine}</Text> : null}
          {cropPreviewUri ? (
            <View style={styles.previewRow}>
              <View style={styles.previewBlock}>
                <Image source={{ uri: cropPreviewUri }} style={styles.previewThumb} />
                <Text style={styles.previewTitle}>Guide Crop</Text>
              </View>
              {grayscalePreviewUri ? (
                <View style={styles.previewBlock}>
                  <Image source={{ uri: grayscalePreviewUri }} style={styles.previewThumb} />
                  <Text style={styles.previewTitle}>Grayscale</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.galleryCard}>
          <Text style={styles.resultLabel}>Accepted markers</Text>
          {capturedMarkers.length === 0 ? (
            <Text style={styles.emptyGalleryText}>
              Accepted markers will appear here as the target marker is validated.
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.galleryRow}>
                {capturedMarkers.map((marker, index) => (
                  <View key={marker.id} style={styles.galleryItem}>
                    <Image source={{ uri: marker.uri }} style={styles.galleryThumb} />
                    <Text style={styles.galleryLabel}>{index + 1}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </View>

        <View style={styles.controlsRow}>
          <Pressable
            style={[
              styles.primaryButton,
              isAnalyzing || isComplete || !isPreviewReady ? styles.buttonDisabled : null,
            ]}
            onPress={handleCaptureAndAnalyze}
            disabled={isAnalyzing || isComplete || !isPreviewReady}
          >
            <Text style={styles.primaryButtonText}>
              {isComplete
                ? "Capture Complete"
                : isAnalyzing
                  ? "Analyzing..."
                  : !isPreviewReady
                    ? "Waiting For Preview..."
                    : "Capture & Analyze"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.controlsRow}>
          <Pressable style={styles.secondaryButton} onPress={handleReset}>
            <Text style={styles.secondaryButtonText}>Reset Session</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => setIsFacingBack((current) => !current)}
          >
            <Text style={styles.secondaryButtonText}>
              {isFacingBack ? "Front Camera" : "Rear Camera"}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#000000",
  },
  text: {
    color: "#ffffff",
    fontSize: 16,
    textAlign: "center",
  },
  permissionButton: {
    marginTop: 16,
    minHeight: 48,
    minWidth: 180,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.24)",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  permissionButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  topPanel: {
    position: "absolute",
    top: 58,
    left: 18,
    right: 18,
    zIndex: 2,
    borderRadius: 18,
    backgroundColor: "rgba(0, 0, 0, 0.58)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    padding: 16,
    gap: 6,
  },
  title: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
  },
  subtitle: {
    color: "#c8c8c8",
    fontSize: 13,
    lineHeight: 18,
  },
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scanFrame: {
    width: GUIDE_SIZE,
    height: GUIDE_SIZE,
    position: "absolute",
  },
  corner: {
    position: "absolute",
    width: 24,
    height: 24,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: "#ffffff",
    borderRadius: 3,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: "#ffffff",
    borderRadius: 3,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: "#ffffff",
    borderRadius: 3,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: "#ffffff",
    borderRadius: 3,
  },
  guideResultFrame: {
    width: GUIDE_SIZE,
    height: GUIDE_SIZE,
    position: "absolute",
    borderWidth: 2,
    borderRadius: 12,
    borderColor: "#00e676",
    backgroundColor: "rgba(0, 230, 118, 0.08)",
    opacity: 0,
  },
  guideResultFrameVisible: {
    opacity: 1,
  },
  guideResultFrameCaptured: {
    borderWidth: 3,
  },
  statusText: {
    position: "absolute",
    bottom: 160,
    color: "rgba(255,255,255,0.76)",
    fontSize: 14,
    fontWeight: "600",
  },
  statusTextActive: {
    color: "#00e676",
  },
  statusTextCaptured: {
    color: "#00e676",
  },
  bottomPanel: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 28,
    gap: 12,
    zIndex: 2,
  },
  infoPill: {
    alignSelf: "center",
    borderRadius: 999,
    backgroundColor: "rgba(0, 0, 0, 0.58)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  infoPillText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  resultCard: {
    gap: 8,
    borderRadius: 16,
    backgroundColor: "rgba(0, 0, 0, 0.62)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    padding: 14,
  },
  galleryCard: {
    gap: 10,
    borderRadius: 16,
    backgroundColor: "rgba(0, 0, 0, 0.62)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    padding: 14,
  },
  resultLabel: {
    color: "#9ca3af",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  resultText: {
    color: "#ffffff",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  metricText: {
    color: "#b7f7cf",
    fontSize: 12,
    lineHeight: 18,
  },
  previewRow: {
    flexDirection: "row",
    gap: 12,
  },
  previewBlock: {
    gap: 6,
    alignItems: "center",
  },
  previewThumb: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: "#ffffff",
  },
  previewTitle: {
    color: "#d1d5db",
    fontSize: 11,
    fontWeight: "600",
  },
  emptyGalleryText: {
    color: "#d1d5db",
    fontSize: 12,
    lineHeight: 18,
  },
  galleryRow: {
    flexDirection: "row",
    gap: 10,
  },
  galleryItem: {
    gap: 6,
    alignItems: "center",
  },
  galleryThumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: "#ffffff",
  },
  galleryLabel: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  controlsRow: {
    flexDirection: "row",
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#000000",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryButton: {
    flex: 1,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.24)",
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
});
