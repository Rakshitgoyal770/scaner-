from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "Rakshit_Goyal_Submission_Cover.pdf"

GITHUB_REPO = "https://github.com/Rakshitgoyal770/scaner-.git"
DETAIL_PDF = "Assignment-Approach.pdf"
FINAL_PDF = "Rakshit_Goyal_Alemeno_Submission.pdf"
APK_NAME = "Saner-release.apk"


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
            fontSize=10.5,
            leading=15,
            textColor=colors.black,
            spaceAfter=4,
        ),
        "Small": ParagraphStyle(
            "Small",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#444444"),
            spaceAfter=3,
        ),
    }


STYLES = build_styles()


def bullet(text: str) -> Paragraph:
    return Paragraph(f"• {text}", STYLES["Body"])


def main():
    story = []
    story.append(Paragraph("Rakshit Goyal - Alemeno Submission Cover", STYLES["Title"]))
    story.append(Paragraph("Final deliverables list", STYLES["Small"]))
    story.append(Spacer(1, 4))

    story.append(Paragraph("Summary", STYLES["Heading"]))
    story.append(
        Paragraph(
            "This document is the cover sheet for the Alemeno internship assignment submission. "
            "The complete submission package contains the GitHub repository, the detailed project PDF, "
            "the final submission PDF, and the Android APK.",
            STYLES["Body"],
        )
    )

    story.append(Paragraph("Deliverables", STYLES["Heading"]))
    table = Table(
        [
            ["Item", "Details"],
            ["GitHub Repository", f'<link href="{GITHUB_REPO}">{GITHUB_REPO}</link>'],
            ["Detailed Project PDF", DETAIL_PDF],
            ["Final Submission PDF", FINAL_PDF],
            ["Android APK", APK_NAME],
        ],
        colWidths=[46 * mm, 120 * mm],
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eeeeee")),
                ("GRID", (0, 0), (-1, -1), 0.6, colors.HexColor("#bbbbbb")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(table)

    story.append(Paragraph("What to upload", STYLES["Heading"]))
    for line in [
        "Upload this cover PDF.",
        "Upload the final submission PDF with screenshots and results.",
        "Upload the detailed project PDF if submitting documents separately.",
        "Upload the Android APK file for installation/testing.",
        "Keep the GitHub repository public and accessible.",
    ]:
        story.append(bullet(line))

    story.append(Paragraph("Note", STYLES["Heading"]))
    story.append(
        Paragraph(
            "If the submission is made through Google Drive, this cover PDF can be placed in the shared folder "
            "alongside the APK and the two PDFs. If the submission is made as a single PDF, this cover sheet can "
            "be the first document and the GitHub repository link should remain clickable.",
            STYLES["Body"],
        )
    )

    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title="Rakshit Goyal Submission Cover",
        author="Rakshit Goyal",
    )
    doc.build(story)
    print(OUTPUT)


if __name__ == "__main__":
    main()
