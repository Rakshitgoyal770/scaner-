import { useMemo, useRef, useState } from "react";
import type { Image as NitroImage } from "react-native-nitro-image";
import {
  Camera,
  type CameraRef,
  useCameraDevice,
  useCameraPermission,
} from "react-native-vision-camera";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { analyzeMarkerImage } from "../src/features/scanner/analyzeCapturedMarker";
import { useMarkerScanner } from "../src/features/scanner/useMarkerScanner";

const GUIDE_SIZE = 260;

function normalizeUri(filePath: string) {
  return filePath.startsWith("file://") ? filePath : `file://${filePath}`;
}

export default function CameraScreen() {
  const permission = useCameraPermission();
  const cameraRef = useRef<CameraRef>(null);
  const [isFacingBack, setIsFacingBack] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisSummary, setAnalysisSummary] = useState(
    "Align the desired marker inside the guide frame, then capture a stable preview snapshot."
  );
  const [cropPreviewUri, setCropPreviewUri] = useState<string | null>(null);
  const [metricLine, setMetricLine] = useState<string | null>(null);
  const device = useCameraDevice(isFacingBack ? "back" : "front");
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

  async function handleCaptureAndAnalyze() {
    if (isAnalyzing) {
      return;
    }

    if (!cameraRef.current) {
      setAnalysisSummary("Camera preview is not ready yet. Try again in a second.");
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
      setCropPreviewUri(normalizeUri(result.centerCropFilePath));
      setMetricLine(
        `Borders ${result.metrics.darkBorderSides}/4 | Dark corners ${result.metrics.darkCornerCount} | Center saturation ${result.metrics.centerSaturation.toFixed(
          1
        )}`
      );

      if (result.isDesiredMarker) {
        completeCapture(centeredGuideBox);
      } else if (result.isMarkerLike) {
        previewCandidate(centeredGuideBox);
      } else {
        resetOverlay();
      }

      setAnalysisSummary(result.reason);
    } catch (error) {
      resetOverlay();
      setCropPreviewUri(null);
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
    setMetricLine(null);
    setAnalysisSummary(
      "Align the desired marker inside the guide frame, then capture a stable preview snapshot."
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
        ref={cameraRef}
        style={StyleSheet.absoluteFillObject}
        device={device}
        isActive
        onError={(error) => {
          setAnalysisSummary(`Camera error: ${error.message}`);
        }}
      />

      <View style={styles.topPanel}>
        <Text style={styles.title}>Marker Scanner</Text>
        <Text style={styles.subtitle}>
          This version uses a preview snapshot instead of the photo output
          session, which avoids the native bind crash and still lets us analyze
          the marker inside the guide frame.
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
          {isAnalyzing ? "Analyzing preview snapshot..." : statusMessage}
        </Text>
      </View>

      <View style={styles.bottomPanel}>
        <View style={styles.infoPill}>
          <Text style={styles.infoPillText}>
            State: {detectionState} | Captured: {capturedCount} / 20
          </Text>
        </View>

        <View style={styles.resultCard}>
          <Text style={styles.resultLabel}>Latest analysis</Text>
          <Text style={styles.resultText}>{analysisSummary}</Text>
          {metricLine ? <Text style={styles.metricText}>{metricLine}</Text> : null}
          {cropPreviewUri ? (
            <View style={styles.previewRow}>
              <Image source={{ uri: cropPreviewUri }} style={styles.previewThumb} />
              <Text style={styles.previewCaption}>
                Guide crop used for marker validation after the snapshot was taken.
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.controlsRow}>
          <Pressable
            style={[styles.primaryButton, isAnalyzing ? styles.buttonDisabled : null]}
            onPress={handleCaptureAndAnalyze}
            disabled={isAnalyzing}
          >
            <Text style={styles.primaryButtonText}>
              {isAnalyzing ? "Analyzing..." : "Capture & Analyze"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.controlsRow}>
          <Pressable style={styles.secondaryButton} onPress={handleReset}>
            <Text style={styles.secondaryButtonText}>Reset</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => setIsFacingBack((current) => !current)}
          >
            <Text style={styles.secondaryButtonText}>
              {isFacingBack ? "Front" : "Rear"}
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
    alignItems: "center",
    gap: 10,
  },
  previewThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: "#ffffff",
  },
  previewCaption: {
    flex: 1,
    color: "#d1d5db",
    fontSize: 12,
    lineHeight: 18,
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
  },
});
