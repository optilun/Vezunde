# Homepage customer motion artwork

V3 is a 24-second silent product animation drawn at native resolution with Manrope brand typography, optical motifs, short 360 ms cursor moves, click ripples, selected states, staggered cards and controlled camera pushes. It is an illustrative reconstruction of the verified client journey, not a screen recording. All business names, addresses and contact details are fictional/illustrative. Lunear Optic Store and Lunear Studio replace real directory records. The cream dotted stage matches the homepage; scene sizes vary and result cards expand/contract to direct attention.

Desktop: 1920×1080, 60 fps. Mobile: separately composed 1080×1440, 60 fps. H.264 CRF18, faststart. Chapters start at 0, 4 and 16 seconds. Captions and accessible transcript accompany the video. Reduced motion/data-saver users start manually; offscreen playback pauses.

Research (2026-10-04):
- https://screen.studio/guide/animations — short cursor movements and settled screen transitions.
- https://screen.studio/guide/cursor — crisp cursor rendering and hiding idle pointers.
- https://www.godaddy.com/en/airo — page composition plus user-supplied references; embedded video did not load during research.

Render from project root:

```bash
python3 -m pip install --target /tmp/viasee-video-tools Pillow imageio-ffmpeg fonttools brotli
PYTHONPATH=/tmp/viasee-video-tools python3 scripts/render-client-journey-v3.py
```

Use `--stills` for fast composition review. Source renderer, brand fonts, exported MP4s and posters are versioned. V1 captures/renderer remain as historical assets. Do not enlarge those captures for future exports.
