from pathlib import Path

from PIL import Image as PILImage, ImageOps
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "Assignment-Approach.pdf"
REFERENCE_DIR = ROOT / "assets" / "marker-references"
RESULTS_DIR = ROOT / "assets" / "marker-results"

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
        "signal": "Accepted despite tilt",
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


def build_styles():
    base = getSampleStyleSheet()
    return {
        "Title": ParagraphStyle(
            "Title",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=26,
            textColor=colors.black,
            spaceAfter=10,
            alignment=TA_LEFT,
        ),
        "Heading": ParagraphStyle(
            "Heading",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=18,
            textColor=colors.black,
            spaceBefore=10,
            spaceAfter=6,
        ),
        "Body": ParagraphStyle(
            "Body",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=10.5,
            leading=15,
            textColor=colors.black,
            spaceAfter=5,
        ),
        "Meta": ParagraphStyle(
            "Meta",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#444444"),
            spaceAfter=4,
        ),
        "Small": ParagraphStyle(
            "Small",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=11,
            textColor=colors.black,
            spaceAfter=2,
        ),
    }


STYLES = build_styles()


def bullet(text: str) -> Paragraph:
    return Paragraph(f"• {text}", STYLES["Body"])


def ensure_result_images():
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    result_rows = []

    for case in RESULT_CASES:
        source = REFERENCE_DIR / case["filename"]
        grayscale = RESULTS_DIR / f"{case['key']}-grayscale.png"

        with PILImage.open(source) as image:
            gray = ImageOps.grayscale(image)
            gray.save(grayscale)

        result_rows.append(
            {
                **case,
                "source": source,
                "grayscale": grayscale,
            }
        )

    return result_rows


def build_results_table(result_rows):
    rows = [
        [
            Paragraph("<b>Case</b>", STYLES["Body"]),
            Paragraph("<b>Reference</b>", STYLES["Body"]),
            Paragraph("<b>Grayscale</b>", STYLES["Body"]),
            Paragraph("<b>Expected Result</b>", STYLES["Body"]),
        ]
    ]

    for row in result_rows:
        rows.append(
            [
                Paragraph(row["label"], STYLES["Small"]),
                Image(str(row["source"]), width=28 * mm, height=28 * mm),
                Image(str(row["grayscale"]), width=28 * mm, height=28 * mm),
                Paragraph(f"{row['expected']}<br/>{row['signal']}", STYLES["Small"]),
            ]
        )

    table = Table(rows, colWidths=[40 * mm, 34 * mm, 34 * mm, 58 * mm], repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eaeaea")),
                ("GRID", (0, 0), (-1, -1), 0.6, colors.HexColor("#bbbbbb")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (1, 1), (2, -1), "CENTER"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return table


def build_story():
    result_rows = ensure_result_images()
    story = []

    story.append(Paragraph("Alemeno Internship Assignment: Saner", STYLES["Title"]))
    story.append(Paragraph("Project summary, workflow, results, and achievements", STYLES["Meta"]))
    story.append(Spacer(1, 4))

    story.append(Paragraph("1. Summary", STYLES["Heading"]))
    story.append(
        Paragraph(
            "Saner is an Android React Native marker-scanning app built for the Alemeno internship assignment. "
            "It captures a camera snapshot, isolates the marker region, normalizes the output to 300x300, validates "
            "the border and anchor structure, and stores accepted markers in the app gallery.",
            STYLES["Body"],
        )
    )
    for line in [
        "Built with React Native, Expo, and react-native-vision-camera.",
        "Targets Android and was tested through a native Android build flow.",
        "Designed to accept the provided correct markers and reject the provided incorrect markers.",
        "Uses a structured scanner pipeline instead of matching one specific center illustration.",
    ]:
        story.append(bullet(line))

    story.append(Paragraph("2. Detailed Explanation", STYLES["Heading"]))
    story.append(
        Paragraph(
            "The core challenge was not only finding a square on screen, but finding the correct square reliably when "
            "the marker is rotated, slightly off-center, or visually noisy. Earlier heuristic versions were hard to "
            "maintain, so the scanner was reorganized into smaller modules and the final logic was centered around "
            "three structural cues: the border, the corner anchor, and the normalized marker crop.",
            STYLES["Body"],
        )
    )
    for line in [
        "The capture flow is snapshot-based, which keeps the implementation simple and stable on a real device.",
        "A blob-first crop reduces the amount of irrelevant background sent into the analyzer.",
        "Ring-based border detection is more rotation-tolerant than checking four rigid strips alone.",
        "Corner-anchor logic distinguishes valid corner anchors from oversized or misplaced dark blocks.",
        "The processed output remains fixed at 300x300 to satisfy the assignment requirement exactly.",
    ]:
        story.append(bullet(line))

    story.append(Paragraph("3. Workflow", STYLES["Heading"]))
    for line in [
        "Open the camera preview.",
        "Align the candidate marker inside the guide frame.",
        "Tap Capture & Analyze.",
        "Capture a native snapshot.",
        "Apply guide crop and dark-blob tightening.",
        "Normalize the cropped marker to 300x300.",
        "Run ring-border analysis and corner-anchor analysis.",
        "If valid, store the processed crop in the accepted gallery.",
    ]:
        story.append(bullet(line))

    story.append(Paragraph("4. Results", STYLES["Heading"]))
    story.append(
        Paragraph(
            "The following reference cases were used as the practical result baseline. The grayscale column is included "
            "to show that the detector is primarily structure-driven rather than dependent on the full original color image.",
            STYLES["Body"],
        )
    )
    story.append(build_results_table(result_rows))

    story.append(Paragraph("5. Achievements", STYLES["Heading"]))
    for line in [
        "Created a working Android marker scanner with native camera capture.",
        "Built a reusable scanner core split into small, human-readable files.",
        "Generated exact 300x300 processed outputs.",
        "Produced a release APK for device installation.",
        "Documented a visual validation baseline with both original and grayscale reference images.",
    ]:
        story.append(bullet(line))

    story.append(Paragraph("6. Main Files", STYLES["Heading"]))
    for line in [
        "app/camera.tsx: camera UI, capture flow, and gallery.",
        "app/marker-debug.tsx: reference sample browsing screen.",
        "src/features/scanner/analyzeCapturedMarker.ts: public scanner API.",
        "src/features/scanner/markerAnalyzerCore.ts: blob crop, normalized analysis, and scoring.",
        "src/features/scanner/markerPixelUtils.ts: pixel sampling helpers.",
        "src/features/scanner/markerPreview.ts: grayscale preview generation.",
        "src/features/scanner/markerAnalysis.types.ts: shared types and constants.",
    ]:
        story.append(bullet(line))

    story.append(Paragraph("7. Limitations and Future Improvement", STYLES["Heading"]))
    for line in [
        "The scanner is snapshot-based rather than a continuous frame-processor detector.",
        "The detector is still heuristic and tuned to the provided marker family.",
        "A full perspective-warp pipeline could improve extreme-angle robustness further.",
    ]:
        story.append(bullet(line))

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
        title="Alemeno Internship Assignment - Saner",
        author="Rakshit Goyal",
    )
    doc.build(build_story())
    print(OUTPUT)


if __name__ == "__main__":
    main()
