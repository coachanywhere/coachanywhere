#!/usr/bin/env python3
"""
================================================================================
CoachAnywhere — Coach Invitation Card Generator (Amber/Gold treatment)
================================================================================
Generates 4 print-ready coach invitation cards (one per COACH-XXXX code) as a
single A4 PDF, ready for your local printer.

LAYOUT (same as athlete card, amber/gold colours):
  Front: Logo across the top
         "You're Invited" headline on the left (white + amber)
         QR code on the right
         COACH-XXXX code in monospace under the QR
         Deep amber/black gradient background

  Back:  Top accent stripe (amber gradient)
         "Scan for your exclusive invite to CoachAnywhere"
         "Elite coaching, anytime, anywhere"
         Handwriting space (3 lines)
         Founder signature at bottom

USAGE:
  1. Mint your 4 coach codes in the admin panel first.
  2. Export from Supabase:
       SELECT code FROM pilot_codes
       WHERE used_at IS NULL AND code_type = 'coach'
       ORDER BY created_at;
  3. Replace the CODES list below.
  4. Make sure logo-cropped.png is in the same folder.
  5. Run: python coach-card-generator.py
  6. Output: coach-invitation-cards.pdf

DEPENDENCIES (install once):
  pip install reportlab qrcode Pillow
================================================================================
"""

import os
import io
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.utils import ImageReader
import qrcode
from PIL import Image

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION — EDIT THESE
# ═══════════════════════════════════════════════════════════════════════════════

# Your 4 coach codes from Supabase (2 active + 2 backups).
CODES = [
    "COACH-A7K2",   # → Geoff
    "COACH-B3M9",   # → Kyle
    "COACH-C5N1",   # ← backup 1
    "COACH-D8P4",   # ← backup 2
]

# Optional: personalise the back of each card with the recipient's name.
# Map COACH-XXXX → "Name" (or leave None to skip personalisation).
# Order should match CODES above.
RECIPIENT_NAMES = [
    "Geoff",
    "Kyle",
    None,           # backup card — no name
    None,           # backup card — no name
]

QR_URL_TEMPLATE = "https://app.coachanywhere247.com/pilot-coaches.html?code={code}"

FOUNDER_NAME = "Kane Oakley"
LOGO_PATH    = "logo-cropped.png"
OUTPUT_PDF   = "coach-invitation-cards.pdf"

# ═══════════════════════════════════════════════════════════════════════════════
# CARD DIMENSIONS — Business card 85 × 55mm
# ═══════════════════════════════════════════════════════════════════════════════

CARD_W = 85 * mm
CARD_H = 55 * mm
PAGE_W, PAGE_H = A4
MARGIN_X = (PAGE_W - 2 * CARD_W) / 2
MARGIN_Y_TOP = 20 * mm
GAP_Y = 8 * mm

# Amber/gold palette
DEEP_BLACK = HexColor("#0d0805")
DEEP_AMBER = HexColor("#3a1d05")
MID_AMBER  = HexColor("#7a3a0a")
AMBER      = HexColor("#d97706")
AMBER_LT   = HexColor("#fbbf24")
GOLD       = HexColor("#facc15")
TEXT_GREY  = HexColor("#374151")
MUTED      = HexColor("#6b7280")
LIGHT_GREY = HexColor("#cbd5e1")


def make_qr_image(url: str, size_px: int = 400) -> Image.Image:
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=12,
        border=1,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    return img.resize((size_px, size_px), Image.LANCZOS)


def draw_amber_gradient(c: canvas.Canvas, x: float, y: float, w: float, h: float):
    """Black at top → deep amber at bottom."""
    n_strips = 40
    for i in range(n_strips):
        ratio = i / n_strips
        r = 0x0d + (0x3a - 0x0d) * ratio
        g = 0x08 + (0x1d - 0x08) * ratio
        b = 0x05 + (0x05 - 0x05) * ratio
        c.setFillColorRGB(r / 255, g / 255, b / 255)
        strip_y = y + (h * (n_strips - i - 1) / n_strips)
        strip_h = h / n_strips + 0.5
        c.rect(x, strip_y, w, strip_h, fill=1, stroke=0)


def draw_card_front(c: canvas.Canvas, x: float, y: float, code: str):
    """Front: logo top, You're Invited left, QR right, code under QR — AMBER variant."""

    # Background gradient
    draw_amber_gradient(c, x, y, CARD_W, CARD_H)

    # Logo across the top
    if os.path.exists(LOGO_PATH):
        logo = Image.open(LOGO_PATH).convert("RGBA")
        # Black background → transparent
        data = list(logo.getdata())
        new_data = [
            (0, 0, 0, 0) if (p[0] < 30 and p[1] < 30 and p[2] < 30) else p
            for p in data
        ]
        logo.putdata(new_data)

        buf = io.BytesIO()
        logo.save(buf, format="PNG")
        buf.seek(0)
        logo_reader = ImageReader(buf)

        target_w = CARD_W - 16 * mm
        aspect = logo.size[0] / logo.size[1]
        target_h = target_w / aspect
        max_h = 7 * mm
        if target_h > max_h:
            target_h = max_h
            target_w = target_h * aspect

        logo_x = x + (CARD_W - target_w) / 2
        logo_y = y + CARD_H - target_h - 4 * mm
        c.drawImage(logo_reader, logo_x, logo_y,
                    width=target_w, height=target_h, mask='auto',
                    preserveAspectRatio=True)

    # Thin divider under logo (amber)
    c.setStrokeColor(AMBER_LT)
    c.setLineWidth(0.3)
    c.line(x + 8 * mm, y + CARD_H - 13 * mm,
           x + CARD_W - 8 * mm, y + CARD_H - 13 * mm)

    # "You're Invited" headline
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(x + 5 * mm, y + CARD_H - 24 * mm, "You're")

    c.setFillColor(AMBER_LT)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(x + 5 * mm, y + CARD_H - 32 * mm, "Invited")

    # Small "FOUNDING COACH" sub-line so the recipient knows it's the coach card
    c.setFillColor(GOLD)
    c.setFont("Helvetica-Bold", 6)
    c.drawString(x + 5 * mm, y + CARD_H - 36 * mm, "FOUNDING COACH")

    # QR code on the right
    qr_url = QR_URL_TEMPLATE.format(code=code)
    qr_img = make_qr_image(qr_url, size_px=400)
    qr_buf = io.BytesIO()
    qr_img.save(qr_buf, format="PNG")
    qr_buf.seek(0)
    qr_reader = ImageReader(qr_buf)

    qr_size = 22 * mm
    qr_x = x + CARD_W - qr_size - 5 * mm
    qr_y = y + CARD_H - 14 * mm - qr_size

    pad = 1 * mm
    c.setFillColor(white)
    c.roundRect(qr_x - pad, qr_y - pad,
                qr_size + 2 * pad, qr_size + 2 * pad,
                1 * mm, fill=1, stroke=0)
    c.drawImage(qr_reader, qr_x, qr_y, width=qr_size, height=qr_size)

    # Code under QR
    c.setFillColor(AMBER_LT)
    c.setFont("Courier-Bold", 7)
    c.drawCentredString(qr_x + qr_size / 2,
                        qr_y - 3 * mm,
                        code)


def draw_card_back(c: canvas.Canvas, x: float, y: float, recipient: str = None):
    """Back: tagline, optional personalised greeting, handwriting space, footer."""

    c.setFillColor(white)
    c.rect(x, y, CARD_W, CARD_H, fill=1, stroke=0)

    # Top accent stripe — amber gradient (3 bands)
    stripe_h = 2 * mm
    c.setFillColor(MID_AMBER)
    c.rect(x, y + CARD_H - stripe_h, CARD_W * 0.4, stripe_h, fill=1, stroke=0)
    c.setFillColor(AMBER)
    c.rect(x + CARD_W * 0.4, y + CARD_H - stripe_h, CARD_W * 0.3, stripe_h, fill=1, stroke=0)
    c.setFillColor(AMBER_LT)
    c.rect(x + CARD_W * 0.7, y + CARD_H - stripe_h, CARD_W * 0.3, stripe_h, fill=1, stroke=0)

    # Tagline copy
    c.setFillColor(TEXT_GREY)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(x + 5 * mm, y + CARD_H - 10 * mm, "Scan for your")
    c.drawString(x + 5 * mm, y + CARD_H - 14 * mm, "exclusive invite to")

    # CoachAnywhere brand split — same as athlete card but on white
    c.setFillColor(DEEP_BLACK)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(x + 5 * mm, y + CARD_H - 22 * mm, "Coach")
    coach_w = c.stringWidth("Coach", "Helvetica-Bold", 13)
    c.setFillColor(AMBER)
    c.drawString(x + 5 * mm + coach_w, y + CARD_H - 22 * mm, "Anywhere")

    # Sub-tagline
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7)
    c.drawString(x + 5 * mm, y + CARD_H - 27 * mm,
                 "Elite coaching, anytime, anywhere.")

    # Handwriting area — personalised greeting if name given
    label_y = y + CARD_H - 35 * mm
    c.setFillColor(LIGHT_GREY)
    c.setFont("Helvetica-Bold", 5)
    if recipient:
        c.drawString(x + 5 * mm, label_y, f"FOR {recipient.upper()} — A NOTE:")
    else:
        c.drawString(x + 5 * mm, label_y, "A NOTE FOR YOU:")

    # Three handwriting lines
    c.setStrokeColor(LIGHT_GREY)
    c.setLineWidth(0.3)
    for i in range(3):
        line_y = label_y - 3 * mm - i * 3.5 * mm
        c.line(x + 5 * mm, line_y, x + CARD_W - 5 * mm, line_y)

    # Footer
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 5.5)
    c.drawString(x + 5 * mm, y + 3 * mm, f"— {FOUNDER_NAME}, Founder")
    c.drawRightString(x + CARD_W - 5 * mm, y + 3 * mm, "coachanywhere247.com")


def draw_cut_marks(c: canvas.Canvas, x: float, y: float, w: float, h: float):
    c.setStrokeColor(black)
    c.setLineWidth(0.15)
    mark = 2 * mm
    gap = 0.5 * mm
    for cx, cy in [(x, y), (x + w, y), (x, y + h), (x + w, y + h)]:
        if cx == x:
            c.line(cx - mark - gap, cy, cx - gap, cy)
        else:
            c.line(cx + gap, cy, cx + mark + gap, cy)
        if cy == y:
            c.line(cx, cy - mark - gap, cx, cy - gap)
        else:
            c.line(cx, cy + gap, cx, cy + mark + gap)


def generate_pdf():
    if not os.path.exists(LOGO_PATH):
        print(f"⚠ Warning: {LOGO_PATH} not found.")

    if len(CODES) != len(RECIPIENT_NAMES):
        print("⚠ CODES and RECIPIENT_NAMES must have the same length.")
        return

    c = canvas.Canvas(OUTPUT_PDF, pagesize=A4)
    c.setTitle("CoachAnywhere — Coach Invitation Cards")
    c.setAuthor("CoachAnywhere")

    cards_per_page = 2
    total_pages = (len(CODES) + cards_per_page - 1) // cards_per_page

    for page_idx in range(total_pages):
        start = page_idx * cards_per_page

        for row_idx in range(cards_per_page):
            idx = start + row_idx
            if idx >= len(CODES): break

            code = CODES[idx]
            name = RECIPIENT_NAMES[idx]

            row_y = PAGE_H - MARGIN_Y_TOP - CARD_H - row_idx * (CARD_H + GAP_Y)
            front_x = MARGIN_X
            back_x = MARGIN_X + CARD_W

            draw_card_front(c, front_x, row_y, code)
            draw_card_back(c, back_x, row_y, recipient=name)
            draw_cut_marks(c, front_x, row_y, CARD_W, CARD_H)
            draw_cut_marks(c, back_x, row_y, CARD_W, CARD_H)

            label = f"— {code} —" + (f"  ({name})" if name else "  (BACKUP)")
            c.setFillColor(MUTED)
            c.setFont("Helvetica", 6)
            c.drawCentredString(MARGIN_X + CARD_W,
                                row_y + CARD_H + 2 * mm, label)

        c.setFillColor(MUTED)
        c.setFont("Helvetica", 6)
        c.drawCentredString(PAGE_W / 2, 10 * mm,
                            f"CoachAnywhere Coach Invitations  ·  Page {page_idx + 1} of {total_pages}  ·  Cut on marks  ·  85 × 55mm per card")
        c.showPage()

    c.save()

    print()
    print(f"✓ Generated {OUTPUT_PDF}")
    print(f"  {len(CODES)} coach cards across {total_pages} A4 pages")
    print()
    print("Specs for the printer:")
    print("  • Trim to 85 × 55mm per card (cut marks included)")
    print("  • 350gsm matte coated card stock")
    print("  • Full-colour CMYK, both sides")
    print("  • Optional: soft-touch lamination on front (premium hand-feel)")
    print()


if __name__ == "__main__":
    generate_pdf()
