#!/usr/bin/env python3
"""
================================================================================
CoachAnywhere — Pilot Invitation Card Generator
================================================================================
Generates 20 print-ready invitation cards (one per PIONEER-XXXX code) as a
single multi-page PDF, ready to send to your local printer.

LAYOUT (matches the design preview):
  Front: Logo across the top
         "You're Invited" headline on the left
         QR code on the right
         PIONEER-XXXX code in monospace under the QR
         Navy gradient background

  Back:  Top accent stripe (navy → blue gradient)
         "Scan for your exclusive invite to CoachAnywhere"
         "Elite coaching, anytime, anywhere"
         Handwriting space (3 lines)
         Founder signature at bottom

USAGE:
  1. Mint your pilot codes in the admin panel first.
  2. Export the codes from Supabase:
       SELECT code FROM pilot_codes WHERE used_at IS NULL ORDER BY created_at;
  3. Replace the CODES list below with your real PIONEER-XXXX codes.
  4. Make sure logo-cropped.png is in the same folder as this script.
  5. Run: python pilot-card-generator.py
  6. Output: pilot-invitation-cards.pdf

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

# Your real codes from Supabase. Replace these with the 20 you minted.
CODES = [
    "PIONEER-A7K2",
    "PIONEER-B3M9",
    "PIONEER-C5N1",
    "PIONEER-D8P4",
    "PIONEER-E2Q7",
    "PIONEER-F6R3",
    "PIONEER-G9S5",
    "PIONEER-H1T8",
    "PIONEER-J4U2",
    "PIONEER-K7V6",
    "PIONEER-L3W9",
    "PIONEER-M5X1",
    "PIONEER-N8Y4",
    "PIONEER-P2Z7",
    "PIONEER-Q6A3",
    "PIONEER-R9B5",
    "PIONEER-S1C8",
    "PIONEER-T4D2",
    "PIONEER-U7E6",
    "PIONEER-V3F9",
]

# The URL each QR code points to. {code} gets replaced with each PIONEER-XXXX.
QR_URL_TEMPLATE = "https://app.coachanywhere247.com/pilot.html?code={code}"

# Founder name shown on the back of each card
FOUNDER_NAME = "Kane Oakley"

# Path to your CoachAnywhere logo (wordmark version)
LOGO_PATH = "logo-cropped.png"

# Output filename
OUTPUT_PDF = "pilot-invitation-cards.pdf"

# ═══════════════════════════════════════════════════════════════════════════════
# CARD DIMENSIONS — Business card 85mm × 55mm
# ═══════════════════════════════════════════════════════════════════════════════

CARD_W = 85 * mm
CARD_H = 55 * mm

PAGE_W, PAGE_H = A4
# Layout: 2 cards across (front+back side by side), 2 athletes per page, 4/page total
# 5 pages for 20 athletes
MARGIN_X = (PAGE_W - 2 * CARD_W) / 2
MARGIN_Y_TOP = 20 * mm
GAP_Y = 8 * mm

# Brand colours
NAVY      = HexColor("#0a1428")
NAVY2     = HexColor("#1e3a8a")
BLUE      = HexColor("#60a5fa")
BLUE_DEEP = HexColor("#2563eb")
TEXT_DARK = HexColor("#0a1428")
TEXT_GREY = HexColor("#374151")
MUTED     = HexColor("#6b7280")
LIGHT_GREY= HexColor("#cbd5e1")
WHITE_OFF = HexColor("#fcfbf7")


# ═══════════════════════════════════════════════════════════════════════════════
# QR CODE GENERATION
# ═══════════════════════════════════════════════════════════════════════════════

def make_qr_image(url: str, size_px: int = 400) -> Image.Image:
    """Generate a high-resolution QR code for printing."""
    qr = qrcode.QRCode(
        version=None,                                  # auto-pick
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=12,
        border=1,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    img = img.resize((size_px, size_px), Image.LANCZOS)
    return img


# ═══════════════════════════════════════════════════════════════════════════════
# CARD DRAWING
# ═══════════════════════════════════════════════════════════════════════════════

def draw_navy_gradient(c: canvas.Canvas, x: float, y: float, w: float, h: float):
    """Approximate the navy → deeper-blue gradient using horizontal strips."""
    n_strips = 40
    for i in range(n_strips):
        ratio = i / n_strips
        r = 0x0a + (0x1e - 0x0a) * ratio
        g = 0x14 + (0x3a - 0x14) * ratio
        b = 0x28 + (0x8a - 0x28) * ratio
        c.setFillColorRGB(r / 255, g / 255, b / 255)
        strip_y = y + (h * (n_strips - i - 1) / n_strips)
        strip_h = h / n_strips + 0.5  # +0.5 to avoid gaps from rounding
        c.rect(x, strip_y, w, strip_h, fill=1, stroke=0)


def draw_card_front(c: canvas.Canvas, x: float, y: float, code: str):
    """Front: logo top, You're Invited left, QR right, code under QR."""

    # ── Background gradient ─────────────────────────────────
    draw_navy_gradient(c, x, y, CARD_W, CARD_H)

    # ── Logo across the top ─────────────────────────────────
    if os.path.exists(LOGO_PATH):
        logo = Image.open(LOGO_PATH).convert("RGBA")
        # Make black pixels transparent so logo overlays on navy
        data = list(logo.getdata())
        new_data = [
            (0, 0, 0, 0) if (p[0] < 30 and p[1] < 30 and p[2] < 30) else p
            for p in data
        ]
        logo.putdata(new_data)

        # Save to buffer
        buf = io.BytesIO()
        logo.save(buf, format="PNG")
        buf.seek(0)
        logo_reader = ImageReader(buf)

        # Scale to fit card width with 8mm padding each side
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

    # ── Thin divider under logo ──────────────────────────────
    c.setStrokeColor(HexColor("#60a5fa"))
    c.setLineWidth(0.3)
    c.line(x + 8 * mm, y + CARD_H - 13 * mm,
           x + CARD_W - 8 * mm, y + CARD_H - 13 * mm)

    # ── LEFT: "You're Invited" headline ──────────────────────
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(x + 5 * mm, y + CARD_H - 24 * mm, "You're")

    c.setFillColor(BLUE)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(x + 5 * mm, y + CARD_H - 32 * mm, "Invited")

    # ── RIGHT: QR code ──────────────────────────────────────
    qr_url = QR_URL_TEMPLATE.format(code=code)
    qr_img = make_qr_image(qr_url, size_px=400)
    qr_buf = io.BytesIO()
    qr_img.save(qr_buf, format="PNG")
    qr_buf.seek(0)
    qr_reader = ImageReader(qr_buf)

    qr_size = 22 * mm
    qr_x = x + CARD_W - qr_size - 5 * mm
    qr_y = y + CARD_H - 14 * mm - qr_size

    # White panel around QR for cleaner edge
    pad = 1 * mm
    c.setFillColor(white)
    c.roundRect(qr_x - pad, qr_y - pad,
                qr_size + 2 * pad, qr_size + 2 * pad,
                1 * mm, fill=1, stroke=0)
    c.drawImage(qr_reader, qr_x, qr_y, width=qr_size, height=qr_size)

    # ── Code under QR ────────────────────────────────────────
    c.setFillColor(BLUE)
    c.setFont("Courier-Bold", 7)
    c.drawCentredString(qr_x + qr_size / 2,
                        qr_y - 3 * mm,
                        code)


def draw_card_back(c: canvas.Canvas, x: float, y: float):
    """Back: tagline top, handwriting space, founder signature footer."""

    # ── White background ────────────────────────────────────
    c.setFillColor(white)
    c.rect(x, y, CARD_W, CARD_H, fill=1, stroke=0)

    # ── Top accent stripe (3-band gradient simulation) ──────
    stripe_h = 2 * mm
    c.setFillColor(NAVY)
    c.rect(x, y + CARD_H - stripe_h, CARD_W * 0.4, stripe_h, fill=1, stroke=0)
    c.setFillColor(NAVY2)
    c.rect(x + CARD_W * 0.4, y + CARD_H - stripe_h, CARD_W * 0.3, stripe_h, fill=1, stroke=0)
    c.setFillColor(BLUE)
    c.rect(x + CARD_W * 0.7, y + CARD_H - stripe_h, CARD_W * 0.3, stripe_h, fill=1, stroke=0)

    # ── Tagline copy ────────────────────────────────────────
    c.setFillColor(TEXT_GREY)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(x + 5 * mm, y + CARD_H - 10 * mm, "Scan for your")
    c.drawString(x + 5 * mm, y + CARD_H - 14 * mm, "exclusive invite to")

    # CoachAnywhere brand split
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(x + 5 * mm, y + CARD_H - 22 * mm, "Coach")
    # Compute where "Coach" ends so "Anywhere" starts there
    coach_w = c.stringWidth("Coach", "Helvetica-Bold", 13)
    c.setFillColor(BLUE)
    c.drawString(x + 5 * mm + coach_w, y + CARD_H - 22 * mm, "Anywhere")

    # Sub-tagline
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7)
    c.drawString(x + 5 * mm, y + CARD_H - 27 * mm,
                 "Elite coaching, anytime, anywhere.")

    # ── Handwriting area ────────────────────────────────────
    label_y = y + CARD_H - 35 * mm
    c.setFillColor(LIGHT_GREY)
    c.setFont("Helvetica-Bold", 5)
    c.drawString(x + 5 * mm, label_y, "A NOTE FOR YOU:")

    # Three lines
    c.setStrokeColor(LIGHT_GREY)
    c.setLineWidth(0.3)
    for i in range(3):
        line_y = label_y - 3 * mm - i * 3.5 * mm
        c.line(x + 5 * mm, line_y, x + CARD_W - 5 * mm, line_y)

    # ── Footer ──────────────────────────────────────────────
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 5.5)
    c.drawString(x + 5 * mm, y + 3 * mm, f"— {FOUNDER_NAME}, Founder")
    c.drawRightString(x + CARD_W - 5 * mm, y + 3 * mm, "coachanywhere247.com")


def draw_cut_marks(c: canvas.Canvas, x: float, y: float, w: float, h: float):
    """Print-shop cut marks at each corner."""
    c.setStrokeColor(black)
    c.setLineWidth(0.15)
    mark = 2 * mm
    gap = 0.5 * mm
    # Four corners
    for cx, cy in [(x, y), (x + w, y), (x, y + h), (x + w, y + h)]:
        # Horizontal tick
        if cx == x:
            c.line(cx - mark - gap, cy, cx - gap, cy)
        else:
            c.line(cx + gap, cy, cx + mark + gap, cy)
        # Vertical tick
        if cy == y:
            c.line(cx, cy - mark - gap, cx, cy - gap)
        else:
            c.line(cx, cy + gap, cx, cy + mark + gap)


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN — BUILD THE PDF
# ═══════════════════════════════════════════════════════════════════════════════

def generate_pdf():
    if not os.path.exists(LOGO_PATH):
        print(f"⚠ Warning: {LOGO_PATH} not found. The logo on the front will be missing.")
        print(f"  Make sure logo-cropped.png is in the same folder as this script.")

    if len(CODES) != 20:
        print(f"⚠ Warning: expected 20 codes, got {len(CODES)}.")
        print("  Edit the CODES list at the top of this script.")

    c = canvas.Canvas(OUTPUT_PDF, pagesize=A4)
    c.setTitle("CoachAnywhere — Pilot Invitation Cards")
    c.setAuthor("CoachAnywhere")

    cards_per_page = 2   # 2 athletes per A4, each athlete gets front+back side by side
    total_pages = (len(CODES) + cards_per_page - 1) // cards_per_page

    for page_idx in range(total_pages):
        start = page_idx * cards_per_page
        page_codes = CODES[start:start + cards_per_page]

        for row_idx, code in enumerate(page_codes):
            row_y = PAGE_H - MARGIN_Y_TOP - CARD_H - row_idx * (CARD_H + GAP_Y)
            front_x = MARGIN_X
            back_x = MARGIN_X + CARD_W

            draw_card_front(c, front_x, row_y, code)
            draw_card_back(c, back_x, row_y)
            draw_cut_marks(c, front_x, row_y, CARD_W, CARD_H)
            draw_cut_marks(c, back_x, row_y, CARD_W, CARD_H)

            # Code label between the pair
            c.setFillColor(MUTED)
            c.setFont("Helvetica", 6)
            c.drawCentredString(MARGIN_X + CARD_W,
                                row_y + CARD_H + 2 * mm,
                                f"— {code} —")

        # Page footer
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 6)
        c.drawCentredString(PAGE_W / 2, 10 * mm,
                            f"CoachAnywhere Pilot Invitations  ·  Page {page_idx + 1} of {total_pages}  ·  Cut on marks  ·  85 × 55mm per card")

        c.showPage()

    c.save()

    print()
    print(f"✓ Generated {OUTPUT_PDF}")
    print(f"  {len(CODES)} cards across {total_pages} A4 pages")
    print(f"  Each athlete: front + back, side by side")
    print()
    print(f"Send to your printer with these specs:")
    print(f"  • Trim to 85 × 55mm per card (cut marks included)")
    print(f"  • 350gsm matte coated card stock")
    print(f"  • Full-colour CMYK, both sides")
    print(f"  • Optional: soft-touch lamination on front (~$0.50/card upgrade)")
    print()


if __name__ == "__main__":
    generate_pdf()
