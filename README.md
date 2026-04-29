# Saner

Android marker-scanning assignment app built with React Native and Expo.

## What the app does

- opens a native Android camera preview
- captures a photo snapshot for each scan
- crops the guide area and tightens around the darkest marker blob
- normalizes the marker to exactly `300x300`
- validates the marker using ring-based border detection and corner-anchor analysis
- keeps up to 20 accepted marker crops in the in-app gallery

## Main files

- `app/camera.tsx`: camera screen, capture flow, gallery, debug metrics
- `app/marker-debug.tsx`: sample-image debug screen
- `src/features/scanner/analyzeCapturedMarker.ts`: public scanner API
- `src/features/scanner/markerAnalyzerCore.ts`: blob crop, normalized analysis, scoring
- `src/features/scanner/markerPixelUtils.ts`: low-level pixel sampling helpers
- `src/features/scanner/markerPreview.ts`: grayscale debug preview generation
- `src/features/scanner/markerAnalysis.types.ts`: scanner types and constants

## Run locally

```bash
npm install
npx expo run:android
```

## Build APK

Debug APK:

```bash
cd android
gradlew assembleDebug
```

Release APK:

```bash
cd android
gradlew assembleRelease
```

The release APK is generated at:

`android/app/build/outputs/apk/release/app-release.apk`

## Notes

- the current scanner is snapshot-based, not a continuous frame-processor detector
- the processed output size is fixed to `300x300` to match the assignment requirement
- camera format selection prefers roughly `2560x2560` and aims to stay inside the required `2000-3000` range

## Reference Cases

These are the manual sanity-check outcomes currently used as the visual baseline for the assignment:

- correct marker with a clear corner anchor should be accepted with:
  - `Borders 4/4`
  - `Dark corners 1`
  - reason close to `Correct Marker`
- rotated correct markers should still be accepted
- incorrect marker with an oversized corner block should be rejected with a reason close to:
  - `Anchor square is oversized`
- incorrect marker with a center square instead of a corner anchor should be rejected with a reason close to:
  - `No anchor corner found`

The screenshots shared during validation showed these specific expected examples:

- correct dog marker: accepted
- correct pig marker: accepted
- rotated correct dog/fox-style marker: accepted
- incorrect oversized-anchor marker: rejected
- incorrect center-square marker: rejected

When tuning the detector, these cases should remain stable before changing thresholds further.
