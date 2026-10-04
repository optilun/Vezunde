# Homepage customer demonstration

The 34-second, silent MP4 demonstration uses real, cropped VIASEE screen captures.
The sample is “Vreau un control de vedere”, for an adult in Cluj-Napoca. Contact and
anamnesis steps were skipped; no request was sent to a provider.

Source captures were verified in the app preview on 2026-10-04. Public directory
profiles retain their actual verification labels. Update captures when the intake,
results or profile UI changes.

Render both desktop and mobile videos from the app root:

```bash
python3 -m pip install --target /tmp/viasee-video-tools Pillow imageio-ffmpeg
PYTHONPATH=/tmp/viasee-video-tools python3 scripts/render-client-journey.py
```

Outputs live in `public/videos/`. Chapter starts are 0, 6 and 24 seconds and are
also configured in `src/components/home/ClientJourneyVideo.jsx`.
