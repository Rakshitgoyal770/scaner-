import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DetectedBox, DetectionState, ScannerOverlayState } from "./types";

function getStatusMessage(
  detectionState: DetectionState,
  capturedCount: number
): string {
  if (detectionState === "detected") {
    return "Marker detected - hold still";
  }

  if (detectionState === "captured") {
    return `Captured ${capturedCount} / 20`;
  }

  return "Searching for marker...";
}

export function useMarkerScanner() {
  const [detectionState, setDetectionState] =
    useState<DetectionState>("scanning");
  const [capturedCount, setCapturedCount] = useState(0);
  const [detectedBox, setDetectedBox] = useState<DetectedBox | null>(null);
  const captureTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureScheduledRef = useRef(false);
  const pauseUntilRef = useRef(0);

  const clearTimers = useCallback(() => {
    if (captureTimeoutRef.current) {
      clearTimeout(captureTimeoutRef.current);
      captureTimeoutRef.current = null;
    }

    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }

    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  const overlayState = useMemo<ScannerOverlayState>(
    () => ({
      detectionState,
      capturedCount,
      detectedBox,
      statusMessage: getStatusMessage(detectionState, capturedCount),
    }),
    [capturedCount, detectedBox, detectionState]
  );
  const previewCandidate = useCallback((box: DetectedBox): void => {
    if (Date.now() < pauseUntilRef.current || captureScheduledRef.current) {
      return;
    }

    setDetectedBox(box);
    setDetectionState("detected");

    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }

    previewTimeoutRef.current = setTimeout(() => {
      if (captureScheduledRef.current) {
        return;
      }

      setDetectedBox(null);
      setDetectionState("scanning");
      previewTimeoutRef.current = null;
    }, 250);
  }, []);

  const onMarkerFound = useCallback((box: DetectedBox): void => {
    if (Date.now() < pauseUntilRef.current) {
      return;
    }

    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }

    setDetectedBox(box);
    setDetectionState((current) =>
      current === "captured" ? current : "detected"
    );

    if (captureScheduledRef.current) {
      return;
    }

    captureScheduledRef.current = true;
    clearTimers();

    captureTimeoutRef.current = setTimeout(() => {
      setCapturedCount((current) => current + 1);
      setDetectionState("captured");

      resetTimeoutRef.current = setTimeout(() => {
        captureScheduledRef.current = false;
        setDetectedBox(null);
        setDetectionState("scanning");
      }, 1200);
    }, 600);
  }, [clearTimers]);

  const completeCapture = useCallback((box: DetectedBox): void => {
    clearTimers();
    captureScheduledRef.current = false;
    pauseUntilRef.current = Date.now() + 1200;
    setDetectedBox(box);
    setCapturedCount((current) => current + 1);
    setDetectionState("captured");

    resetTimeoutRef.current = setTimeout(() => {
      setDetectedBox(null);
      setDetectionState("scanning");
    }, 1200);
  }, [clearTimers]);

  const resetOverlay = useCallback((): void => {
    clearTimers();
    captureScheduledRef.current = false;
    pauseUntilRef.current = Date.now() + 1200;
    setDetectedBox(null);
    setDetectionState("scanning");
  }, [clearTimers]);

  return {
    ...overlayState,
    previewCandidate,
    onMarkerFound,
    completeCapture,
    resetOverlay,
  };
}

