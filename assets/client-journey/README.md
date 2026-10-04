# Homepage customer motion artwork

V4 is a 24-second silent product animation drawn at native resolution with Manrope brand typography, optical motifs, short 360 ms cursor moves, click ripples, selected states, staggered cards and controlled camera pushes. It is an illustrative reconstruction of the verified client journey, not a screen recording. All business names, addresses and contact details are fictional/illustrative. Lunear Optic Store and Lunear Studio replace real directory records. The stage reuses public/images/specialists/cobalt-woven-v2.webp exactly. No outer headings, chapter labels, CTA, visible playback controls or progress bars. The video surface toggles playback by click/Enter, with an accessible label and keyboard focus indication; reduced-motion/data-saver users start manually. Scene sizes vary and result cards expand/contract to direct attention.

Desktop: 1920×1080, 60 fps. Mobile: separately composed 1080×1440, 60 fps. H.264 CRF18, faststart. The narrative has seven scenes; there is no chapter navigation. Captions and accessible transcript accompany the video. Reduced motion/data-saver users start manually; offscreen playback pauses.

Research (2026-10-04):
- https://screen.studio/guide/animations — short cursor movements and settled screen transitions.
- https://screen.studio/guide/cursor — crisp cursor rendering and hiding idle pointers.
- https://www.godaddy.com/en/airo — page composition plus user-supplied references; embedded video did not load during research.

Render from project root:

```bash
python3 -m pip install --target /tmp/viasee-video-tools Pillow imageio-ffmpeg fonttools brotli
PYTHONPATH=/tmp/viasee-video-tools python3 scripts/render-client-journey-v4.py
```

Use `--stills` for fast composition review. Source renderer, brand fonts, exported MP4s and posters are versioned. V1 captures/renderer remain as historical assets. Do not enlarge those captures for future exports.
