from pathlib import Path

from PIL import Image as PILImage, ImageOps
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "Rakshit_Goyal_Alemeno_Submission.pdf"
REFERENCE_DIR = ROOT / "assets" / "marker-references"
RESULTS_DIR = ROOT / "assets" / "marker-results"
SCREENSHOT_DIR = ROOT / "assets" / "submission-screenshots"

GITHUB_REPO = "https://github.com/Rakshitgoyal770/scaner-.git"
APK_NAME = "Saner-release.apk"
APK_SOURCE = Path(r"C:\AVRUN\android\app\build\outputs\apk\release\app-release.apk")
APPROACH_PDF = ROOT / "Assignment-Approach.pdf"

RESULT_CASES = [
    {
        "key": "Marker1-TestImage1-Correct",
        "filename": "Marker1-TestImage1-Correct.jpg",
        "label": "Correct pig marker",
        "expected": "Accepted",
        "signal": "Borders 4/4, Dark corners 1",
    },
    {
        "key": "Marker1-TestImage2-Correct",
        "filename": "Marker1-TestImage2-Correct.jpg",
        "label": "Correct dog marker",
        "expected": "Accepted",
        "signal": "Borders 4/4, Dark corners 1",
    },
    {
        "key": "Marker1-TestImage3-Correct",
        "filename": "Marker1-TestImage3-Correct.jpg",
        "label": "Rotated correct marker",
        "expected": "Accepted",
        "signal": "Accepted despite rotation",
    },
    {
        "key": "Marker1-TestImage5-Incorrect",
        "filename": "Marker1-TestImage5-Incorrect.jpg",
        "label": "Incorrect center-square marker",
        "expected": "Rejected",
        "signal": "No anchor corner found",
    },
    {
        "key": "Marker1-TestImage6-Incorrect",
        "filename": "Marker1-TestImage6-Incorrect.jpg",
        "label": "Incorrect oversized-anchor marker",
        "expected": "Rejected",
        "signal": "Anchor square is oversized",
    },
]

SCREENSHOT_FILES = [SCREENSHOT_DIR / f"screen-{index:02d}.jpeg" for index in range(1, 13)]


def build_styles():
    base = getSampleStyleSheet()
    return {
        "Title": ParagraphStyle(
            "Title",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=21,
            leading=25,
            textColor=colors.black,
            alignment=TA_LEFT,
            spaceAfter=8,
        ),
        "Heading": ParagraphStyle(
            "Heading",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=13.5,
            leading=17,
            textColor=colors.black,
            spaceBefore=10,
            spaceAfter=5,
        ),
        "Body": ParagraphStyle(
            "Body",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=10.2,
            leading=14.5,
            textColor=colors.black,
            spaceAfter=4,
        ),
        "Small": ParagraphStyle(
            "Small",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8.2,
            leading=10.5,
            textColor=colors.black,
            spaceAfter=2,
        ),
        "Meta": ParagraphStyle(
            "Meta",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=13,
            textColor=colors.HexColor("#444444"),
            spaceAfter=3,
        ),
    }


STYLES = build_styles()


def bullet(text: str) -> Paragraph:
    return Paragraph(f"• {text}", STYLES["Body"])


def ensure_result_images():
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    rows = []
    for case in RESULT_CASES:
        source = REFERENCE_DIR / case["filename"]
        grayscale = RESULTS_DIR / f"{case['key']}-grayscale.png"
        with PILImage.open(source) as image:
            ImageOps.grayscale(image).save(grayscale)
        rows.append({**case, "source": source, "grayscale": grayscale})
    return rows


def build_results_table(rows):
    table_rows = [[
        Paragraph("<b>Case</b>", STYLES["Body"]),
        Paragraph("<b>Reference</b>", STYLES["Body"]),
        Paragraph("<b>Grayscale</b>", STYLES["Body"]),
        Paragraph("<b>Expected</b>", STYLES["Body"]),
    ]]
    for row in rows:
        table_rows.append([
            Paragraph(row["label"], STYLES["Small"]),
            Image(str(row["source"]), width=27 * mm, height=27 * mm),
            Image(str(row["grayscale"]), width=27 * mm, height=27 * mm),
            Paragraph(f"{row['expected']}<br/>{row['signal']}", STYLES["Small"]),
        ])

    table = Table(table_rows, colWidths=[39 * mm, 32 * mm, 32 * mm, 62 * mm], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eeeeee")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#bdbdbd")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 1), (2, -1), "CENTER"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return table


def build_screenshot_table():
    rows = []
    current = []

    for index, screenshot in enumerate(SCREENSHOT_FILES, start=1):
      if screenshot.exists():
        current.append(
            Table(
                [
                    [Image(str(screenshot), width=48 * mm, height=88 * mm)],
                    [Paragraph(f"Device test screen {index:02d}", STYLES["Small"])],
                ],
                colWidths=[52 * mm],
            )
        )

      if len(current) == 3:
        rows.append(current)
        current = []

    if current:
        while len(current) < 3:
            current.append(Paragraph("", STYLES["Small"]))
        rows.append(current)

    table = Table(rows, colWidths=[56 * mm, 56 * mm, 56 * mm])
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return table


def build_story():
    result_rows = ensure_result_images()
    story = []

    story.append(Paragraph("Rakshit Goyal - Alemeno Assignment Submission", STYLES["Title"]))
    story.append(Paragraph("Project: Saner", STYLES["Meta"]))
    story.append(Paragraph("This document is the final submission summary with implementation details, workflow, results, and deliverables.", STYLES["Meta"]))
    story.append(Spacer(1, 4))

    story.append(Paragraph("1. Summary", STYLES["Heading"]))
    story.append(Paragraph(
        "Saner is an Android React Native marker-scanning app built for the Alemeno internship assignment. "
        "It captures a camera snapshot, isolates the marker region, normalizes the output to exactly 300x300, "
        "validates the marker using border and anchor structure, and stores accepted results in the app gallery.",
        STYLES["Body"],
    ))
    for line in [
        "React Native + Expo Android application.",
        "Native camera preview and snapshot-based capture flow.",
        "Exact 300x300 processed output.",
        "Accepts correct markers and rejects incorrect reference markers.",
        "Stores up to 20 accepted markers in the UI.",
    ]:
        story.append(bullet(line))

    story.append(Paragraph("2. Deliverables", STYLES["Heading"]))
    story.append(Paragraph(
        f'GitHub Repository: <link href="{GITHUB_REPO}">{GITHUB_REPO}</link>',
        STYLES["Body"],
    ))
    story.append(Paragraph(
        f"Release APK file: {APK_NAME}",
        STYLES["Body"],
    ))
    if APK_SOURCE.exists():
        story.append(Paragraph(
            f"APK built locally from: {APK_SOURCE}",
            STYLES["Small"],
        ))
    if APPROACH_PDF.exists():
        story.append(Paragraph(
            f"Detailed approach PDF included separately as: {APPROACH_PDF.name}",
            STYLES["Body"],
        ))

    story.append(Paragraph("3. Detailed Explanation", STYLES["Heading"]))
    story.append(Paragraph(
        "The scanner was designed around structure rather than artwork recognition. The important cues are the marker border, "
        "the corner anchor, and a stable normalized crop. Earlier experimentation produced a large single analyzer file, "
        "so the final version was refactored into smaller scanner modules to make the implementation easier to read and tune.",
        STYLES["Body"],
    ))
    for line in [
        "Blob-first crop reduces irrelevant background before scoring.",
        "Ring-based border detection is more tolerant to rotation than relying only on four rigid strips.",
        "Corner-anchor analysis distinguishes a valid anchor from oversized or misplaced dark blocks.",
        "Grayscale previews are generated for debugging and result inspection.",
        "The output remains exactly 300x300 for assignment compliance.",
    ]:
        story.append(bullet(line))

    story.append(Paragraph("4. Workflow", STYLES["Heading"]))
    for line in [
        "Open the camera preview.",
        "Align the marker inside the guide frame.",
        "Tap Capture & Analyze.",
        "Capture a native snapshot.",
        "Crop the guide area and tighten around the darkest marker blob.",
        "Normalize the marker to 300x300.",
        "Run border and anchor validation.",
        "If valid, store the processed result in the accepted marker gallery.",
    ]:
        story.append(bullet(line))

    story.append(Paragraph("5. Results", STYLES["Heading"]))
    story.append(Paragraph(
        "The following table shows the manual reference baseline used during validation. Each case includes the raw reference image and a grayscale representation, since the detector is intended to be driven mainly by structure instead of color alone.",
        STYLES["Body"],
    ))
    story.append(build_results_table(result_rows))

    story.append(Paragraph("6. Achievements", STYLES["Heading"]))
    for line in [
        "Created a working Android scanner app with native camera capture.",
        "Built and tested a release APK for installation on a real device.",
        "Implemented exact 300x300 processed outputs.",
        "Refactored the scanner core into smaller, more human-readable files.",
        "Documented a clear visual baseline with original and grayscale results.",
    ]:
        story.append(bullet(line))

    story.append(Paragraph("7. Main Files", STYLES["Heading"]))
    for line in [
        "app/camera.tsx: camera UI, capture flow, gallery, and metrics.",
        "app/marker-debug.tsx: sample-image debug browsing screen.",
        "src/features/scanner/analyzeCapturedMarker.ts: public scanner entry point.",
        "src/features/scanner/markerAnalyzerCore.ts: blob crop, normalized analysis, scoring.",
        "src/features/scanner/markerPixelUtils.ts: pixel sampling helpers.",
        "src/features/scanner/markerPreview.ts: grayscale preview generation.",
        "src/features/scanner/markerAnalysis.types.ts: shared types and constants.",
    ]:
        story.append(bullet(line))

    story.append(Paragraph("8. Notes and Limitations", STYLES["Heading"]))
    for line in [
        "The current scanner is snapshot-based instead of continuous frame-processor detection.",
        "The detector is heuristic and tuned for the provided marker family.",
        "A fuller perspective-warp step could improve extreme-angle robustness further.",
    ]:
        story.append(bullet(line))

    story.append(Paragraph("9. Final Device Testing Screenshots", STYLES["Heading"]))
    story.append(Paragraph(
        "The following screenshots were captured during final on-device testing. They show additional live-screen runs and object-testing scenarios beyond the reference-case summary table above.",
        STYLES["Body"],
    ))
    story.append(build_screenshot_table())

    return story


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title="Rakshit Goyal Alemeno Submission",
        author="Rakshit Goyal",
    )
    doc.build(build_story())
    print(OUTPUT)


if __name__ == "__main__":
    main()
