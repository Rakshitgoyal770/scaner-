import { useState } from "react";
import {
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const samples = [
  {
    id: "correct-1",
    label: "Correct 1",
    expected: "Correct",
    source: require("../assets/marker-debug/marker1-correct-1.jpg"),
    rect: { x: 0.358, y: 0.358, w: 0.282, h: 0.282 },
    note: "Anchor appears near top-left.",
    metrics: {
      aspect: 1,
      fill: 0.985,
      innerStd: 57.9,
      innerSaturation: 51.3,
      cornerMeans: [44.3, 255, 255, 253.1],
    },
  },
  {
    id: "correct-2",
    label: "Correct 2",
    expected: "Correct",
    source: require("../assets/marker-debug/marker1-correct-2.jpg"),
    rect: { x: 0.302, y: 0.302, w: 0.396, h: 0.396 },
    note: "Rotated marker. Anchor is not in the top-left.",
    metrics: {
      aspect: 1,
      fill: 0.507,
      innerStd: 92.5,
      innerSaturation: 34.3,
      cornerMeans: [242, 236.9, 235.5, 229.3],
    },
  },
  {
    id: "correct-3",
    label: "Correct 3",
    expected: "Correct",
    source: require("../assets/marker-debug/marker1-correct-3.jpg"),
    rect: { x: 0.358, y: 0.358, w: 0.282, h: 0.282 },
    note: "Anchor appears near bottom-right.",
    metrics: {
      aspect: 1,
      fill: 0.985,
      innerStd: 72,
      innerSaturation: 88.2,
      cornerMeans: [255, 255, 255, 84.3],
    },
  },
  {
    id: "incorrect-4",
    label: "Incorrect 4",
    expected: "Incorrect",
    source: require("../assets/marker-debug/marker1-incorrect-4.jpg"),
    rect: { x: 0.358, y: 0.358, w: 0.282, h: 0.282 },
    note: "Looks marker-like, but the inner content is wrong.",
    metrics: {
      aspect: 1,
      fill: 0.985,
      innerStd: 83,
      innerSaturation: 1,
      cornerMeans: [22.7, 255, 255, 197.6],
    },
  },
];

const PREVIEW_SIZE = 320;

function analyzeSample(sample: (typeof samples)[number]) {
  const { aspect, fill, innerStd, innerSaturation, cornerMeans } = sample.metrics;

  const nearSquare = aspect >= 0.8 && aspect <= 1.2;
  const contentPresent = innerSaturation > 10;
  const anchorInCorner = cornerMeans.some((value) => value < 95);
  const likelyRotatedMarker = fill < 0.7;
  const likelyCorrect =
    nearSquare && contentPresent && (anchorInCorner || likelyRotatedMarker);

  return {
    nearSquare,
    contentPresent,
    anchorInCorner,
    likelyRotatedMarker,
    likelyCorrect,
    verdict: likelyCorrect ? "Correct-like" : "Incorrect-like",
  };
}

export default function MarkerDebugScreen() {
  const [index, setIndex] = useState(0);
  const sample = samples[index];
  const analysis = analyzeSample(sample);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>Offline Marker Debug</Text>
          <Text style={styles.title}>{sample.label}</Text>
          <Text style={styles.subtitle}>
            This screen uses bundled assignment images so we can validate the
            detector against known samples before turning live detection back on.
          </Text>
        </View>

        <View style={styles.previewCard}>
          <View style={styles.previewFrame}>
            <Image source={sample.source} style={styles.image} resizeMode="contain" />
            <View
              style={[
                styles.detectedBox,
                {
                  left: sample.rect.x * PREVIEW_SIZE,
                  top: sample.rect.y * PREVIEW_SIZE,
                  width: sample.rect.w * PREVIEW_SIZE,
                  height: sample.rect.h * PREVIEW_SIZE,
                },
              ]}
            />
          </View>
          <Text style={styles.caption}>
            Expected result: {sample.expected} | Auto result: {analysis.verdict}
          </Text>
          <Text style={styles.note}>{sample.note}</Text>
        </View>

        <View style={styles.infoPanel}>
          <Text style={styles.infoText}>
            The green frame here is the square region the current contour-based
            detector should be finding.
          </Text>
          <Text style={styles.infoText}>
            If this box looks right but live detection fails, the issue is in
            the camera/worklet path, not the marker geometry.
          </Text>
        </View>

        <View style={styles.rulesPanel}>
          <Text style={styles.rulesTitle}>Rule Breakdown</Text>
          <Text style={styles.ruleText}>
            Near-square contour: {analysis.nearSquare ? "PASS" : "FAIL"}
          </Text>
          <Text style={styles.ruleText}>
            Inner content present: {analysis.contentPresent ? "PASS" : "FAIL"}
          </Text>
          <Text style={styles.ruleText}>
            Dark anchor in a corner: {analysis.anchorInCorner ? "PASS" : "FAIL"}
          </Text>
          <Text style={styles.ruleText}>
            Rotated marker fallback:{" "}
            {analysis.likelyRotatedMarker ? "PASS" : "FAIL"}
          </Text>
          <Text style={styles.ruleSummary}>
            Coarse classifier: {analysis.verdict}
          </Text>
        </View>

        <View style={styles.controls}>
          <Pressable
            style={[styles.button, index === 0 ? styles.buttonDisabled : null]}
            disabled={index === 0}
            onPress={() => setIndex((current) => Math.max(0, current - 1))}
          >
            <Text style={styles.buttonText}>Previous</Text>
          </Pressable>
          <Pressable
            style={[
              styles.button,
              index === samples.length - 1 ? styles.buttonDisabled : null,
            ]}
            disabled={index === samples.length - 1}
            onPress={() =>
              setIndex((current) => Math.min(samples.length - 1, current + 1))
            }
          >
            <Text style={styles.buttonText}>Next</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#000000",
  },
  content: {
    flex: 1,
    padding: 20,
    gap: 20,
    backgroundColor: "#000000",
  },
  hero: {
    gap: 8,
  },
  kicker: {
    color: "#8b8b8b",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  title: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: "#b3b3b3",
    fontSize: 15,
    lineHeight: 22,
  },
  previewCard: {
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#1f1f1f",
    borderRadius: 20,
    backgroundColor: "#0a0a0a",
    padding: 16,
  },
  previewFrame: {
    width: PREVIEW_SIZE,
    height: PREVIEW_SIZE,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  detectedBox: {
    position: "absolute",
    borderWidth: 3,
    borderRadius: 8,
    borderColor: "#00e676",
    backgroundColor: "rgba(0, 230, 118, 0.08)",
  },
  caption: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  note: {
    color: "#b3b3b3",
    fontSize: 14,
    textAlign: "center",
  },
  infoPanel: {
    gap: 8,
    borderWidth: 1,
    borderColor: "#1f1f1f",
    borderRadius: 16,
    backgroundColor: "#0a0a0a",
    padding: 16,
  },
  infoText: {
    color: "#e4e4e7",
    fontSize: 14,
    lineHeight: 21,
  },
  rulesPanel: {
    gap: 8,
    borderWidth: 1,
    borderColor: "#1f1f1f",
    borderRadius: 16,
    backgroundColor: "#0a0a0a",
    padding: 16,
  },
  rulesTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  ruleText: {
    color: "#d4d4d8",
    fontSize: 14,
    lineHeight: 20,
  },
  ruleSummary: {
    color: "#00e676",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 4,
  },
  controls: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    flex: 1,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#ffffff",
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: "#000000",
    fontSize: 15,
    fontWeight: "800",
  },
});
