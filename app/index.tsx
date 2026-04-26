import { useRouter } from "expo-router";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>Vision Camera Setup</Text>
          <Text style={styles.title}>Custom Marker Scanner</Text>
          <Text style={styles.subtitle}>
            This project is the new native-ready base for real marker detection.
            It uses React Native Vision Camera so we can move toward frame
            processors, contour detection, and perspective correction.
          </Text>
        </View>

        <View style={styles.points}>
          <Text style={styles.point}>Marker 1 as the target marker</Text>
          <Text style={styles.point}>Live camera preview with native stack</Text>
          <Text style={styles.point}>Ready for contour detection pipeline</Text>
          <Text style={styles.point}>Foundation for orientation correction</Text>
        </View>

        <Pressable
          style={styles.primaryButton}
          onPress={() => router.push("/camera")}
        >
          <Text style={styles.primaryButtonText}>Open Camera</Text>
        </Pressable>

        <Pressable
          style={styles.secondaryButton}
          onPress={() => router.push("/marker-debug")}
        >
          <Text style={styles.secondaryButtonText}>Open Marker Debug</Text>
        </Pressable>
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
    justifyContent: "center",
    padding: 24,
    gap: 24,
    backgroundColor: "#000000",
  },
  hero: {
    gap: 12,
  },
  kicker: {
    color: "#8b8b8b",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    color: "#ffffff",
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
  },
  subtitle: {
    color: "#b3b3b3",
    fontSize: 16,
    lineHeight: 24,
  },
  points: {
    gap: 10,
    padding: 18,
    borderWidth: 1,
    borderColor: "#1f1f1f",
    borderRadius: 16,
    backgroundColor: "#0a0a0a",
  },
  point: {
    color: "#e4e4e7",
    fontSize: 15,
    lineHeight: 22,
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: "#ffffff",
  },
  primaryButtonText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    backgroundColor: "#0a0a0a",
  },
  secondaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
});
