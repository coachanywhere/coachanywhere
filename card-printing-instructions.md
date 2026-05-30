# CoachAnywhere — Pilot Card Printing Instructions

## What you have

| File | Purpose |
|---|---|
| `pilot-card-generator.py` | Python script that produces the print-ready PDF |
| `logo-cropped.png` | Logo file the script uses (must sit next to the script) |
| `card-preview-final.png` | Design mockup (what one card looks like) |
| `pdf-page1-preview.png` | Page 1 of the actual generated PDF (verification only) |

## Step 1 — Get your real codes from Supabase

In Supabase SQL Editor:
```sql
SELECT code FROM pilot_codes WHERE used_at IS NULL ORDER BY created_at;
```

Copy the 20 codes. They should look like `PIONEER-A7K2`, `PIONEER-B3M9`, etc.

## Step 2 — Replace the codes in the script

Open `pilot-card-generator.py` in a text editor. Near the top, find the `CODES = [...]` list (around line 40). Replace the 20 placeholder codes with your real ones from Supabase.

Save the file.

## Step 3 — Set up Python (one-time)

If you don't have Python installed:
- Download from https://python.org (pick 3.11 or newer)
- During install, check "Add Python to PATH"

Then install the libraries the script needs:
```
pip install reportlab qrcode Pillow
```

If `pip` isn't recognised, try `python -m pip install reportlab qrcode Pillow`.

## Step 4 — Run the script

Open Command Prompt, navigate to the folder containing `pilot-card-generator.py` and `logo-cropped.png`:
```
cd C:\Users\kaneo\Projects\CoachAnywhere
python pilot-card-generator.py
```

Output: `pilot-invitation-cards.pdf` — a 10-page A4 PDF with all 20 cards laid out (2 athletes per page, front + back side by side, cut marks at every corner).

## Step 5 — Send to your printer

Print specs to give them:

- **Trim size:** 85 × 55mm per card
- **Stock:** 350gsm matte coated card
- **Print:** Full-colour CMYK, both sides
- **Cut on the marks** at each corner of every card
- **Optional upgrade:** Soft-touch lamination on the front side (~$0.50/card)

Quantity: 20 cards = 10 A4 sheets (front + back, 2 athletes per sheet).

## Notes

- Each card has a UNIQUE QR code pointing to `https://app.coachanywhere247.com/pilot.html?code=PIONEER-XXXX`
- When an athlete scans, they land on the pilot page with their code pre-filled, ready to claim their spot
- The code is also printed in monospace under the QR as a fallback (in case the QR doesn't scan)
- The back has 3 faint horizontal lines for your handwritten note per recipient

## Troubleshooting

- **"qrcode module not found"** → run `pip install qrcode` again, or `pip install qrcode[pil]`
- **"logo-cropped.png not found"** → make sure that file is in the same folder as the script
- **PDF looks empty or wrong colors** → make sure you opened it in a real PDF reader (Adobe Reader, browser, etc.) not in a basic image viewer
