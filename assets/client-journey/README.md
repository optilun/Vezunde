# Homepage customer motion artwork

V5 is a 26-second silent product animation drawn at native resolution, 60 fps, using Manrope brand typography and the actual public/brand VIASEE symbol and wordmark. It combines short editorial text with a search composer that grows from a compact bar, quick cursor movements/click ripples, lifted selection cards, optical photography, varied result-card sizes and a brand end slate.

It illustrates the client journey: describe a need, confirm it, choose the person and locality, compare options, then inspect a profile. It is a designed reconstruction, not a live screen recording. Lunear Optic Store and Lunear Studio are fictional examples. Addresses, phones, ratings, bookings and clinical claims are not invented.

The background reuses public/images/specialists/cobalt-woven-v2.webp exactly. Existing VIASEE optical editorial assets are reused inside the cards. The section now has a concise heading, description and three short step descriptions, following the user's October 4 reference. No extra chapter buttons or CTA were added. The video surface toggles playback by click/Enter with an accessible label and keyboard focus ring; reduced-motion/data-saver users start manually, and offscreen or hidden playback pauses.

Desktop: 1920×1080. Mobile: separately composed 1080×1440. H.264 CRF19, faststart, no audio. Matching Romanian captions and an accessible transcript accompany the video.

Research (2026-10-04):
- https://www.godaddy.com/en/offers/godaddy — observed the playing 16-second Airo Builder example and the user's reference frames: search growth, layered product/card layouts and typographic close.
- https://screen.studio/guide/animations — short cursor movement and settled transitions.
- https://screen.studio/guide/cursor — crisp cursor rendering and hiding idle pointers.

Render from project root:

```bash
python3 -m pip install --target /tmp/viasee-video-tools Pillow imageio-ffmpeg fonttools brotli
PYTHONPATH=/tmp/viasee-video-tools python3 scripts/render-client-journey-v5.py
```

Use --stills for fast composition review. V5 imports V4's drawing primitives and fonts, so retain both renderers. The brand SVGs contain traced M/L/Z polygons; V5 rasterises those exact paths without external SVG system libraries. Source, fonts, exported MP4s and posters are versioned. Older versions are retained for restoration.

