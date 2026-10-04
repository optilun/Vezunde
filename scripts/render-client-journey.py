#!/usr/bin/env python3
"""Render the homepage demonstration from cropped, real VIASEE screen captures.
Requires Pillow and imageio-ffmpeg. Run from the app root. No customer data is used.
"""
from pathlib import Path
import math
import subprocess
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageFilter
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parents[1]
CAPTURES = ROOT / "assets/client-journey"
OUT = ROOT / "public/videos"
OUT.mkdir(parents=True, exist_ok=True)
FPS, DURATION = 24, 34
FONT_DIR = Path("/usr/share/fonts/truetype/dejavu")
def font(size, bold=False):
    return ImageFont.truetype(str(FONT_DIR / ("DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf")), size)

# Short editorial cuts preserve the actual UI; optional questions are omitted.
# Cursor destinations are measured relative to each cropped source capture.
STAGES = [
    dict(start=0, end=6, title="Spui ce cauți.", subtitle="Cu propriile cuvinte.", chapter=0,
         desktop=("01-search.jpg", (0,0,760,450), (620,380)),
         mobile=("m01-search.jpg", (0,0,360,370), (305,269))),
    dict(start=6, end=9, title="Confirmi nevoia.", subtitle="VIASEE te ajută să alegi direcția.", chapter=1,
         desktop=("02-confirm.jpg", (35,45,715,510), (580,337)),
         mobile=("m02-confirm.jpg", (12,70,348,520), (290,385))),
    dict(start=9, end=12, title="Pentru cine cauți?", subtitle="Alegi răspunsul potrivit.", chapter=1,
         desktop=("03-person.jpg", (35,90,715,505), (580,263)),
         mobile=("m03-person.jpg", (12,125,362,495), (285,300))),
    dict(start=12, end=16, title="Alegi localitatea.", subtitle="De exemplu, Cluj-Napoca.", chapter=1,
         desktop=("04-location.jpg", (35,95,715,465), (580,391)),
         mobile=("m04-location.jpg", (12,125,362,495), (280,431))),
    dict(start=16, end=20, title="Răspunzi pe scurt.", subtitle="Câteva întrebări despre ce cauți.", chapter=1,
         desktop=("05-purpose.jpg", (35,90,715,515), (580,285)),
         mobile=("m05-purpose.jpg", (12,125,362,540), (280,328))),
    dict(start=20, end=24, title="Verifici rezumatul.", subtitle="Nevoia, serviciul și zona ta.", chapter=1,
         desktop=("07-review.jpg", (35,0,715,520), None),
         mobile=("m07-review.jpg", (12,0,345,355), None)),
    dict(start=24, end=27, title="Compari opțiunile.", subtitle="Verifici informațiile disponibile.", chapter=2,
         desktop=("09-results.jpg", None, None),
         mobile=("m09-results.jpg", (15,100,345,395), None)),
    dict(start=27, end=30, title="Deschizi profilul.", subtitle="Vezi mai multe despre locația aleasă.", chapter=2,
         desktop=("09-results.jpg", None, (467,400)),
         mobile=("m09-results.jpg", (15,380,345,575), (295,530))),
    dict(start=30, end=32, title="Vezi profilul.", subtitle="Locația și statutul profilului.", chapter=2,
         desktop=("10-profile.jpg", None, None),
         mobile=("m10-profile.jpg", (12,90,345,320), None)),
    dict(start=32, end=34, title="Vezi cum ajungi.", subtitle="Adresa și datele de contact.", chapter=2,
         desktop=("10-profile.jpg", None, None),
         mobile=("m11-contact.jpg", (85,215,325,405), None)),
]

def text_center(draw, text, y, face, fill, width):
    box = draw.textbbox((0,0), text, font=face)
    draw.text(((width-(box[2]-box[0]))/2, y), text, font=face, fill=fill)

def cursor(draw, x, y, size):
    points = [(0,0),(0,31),(8,24),(14,38),(21,35),(15,21),(27,21)]
    points = [(x+a*size/38,y+b*size/38) for a,b in points]
    draw.polygon(points, fill="#171717", outline="white", width=max(2,round(size/12)))

def smooth(t):
    t = max(0,min(1,t))
    return t*t*(3-2*t)

def prepare(mobile):
    w,h = (720,960) if mobile else (1280,800)
    texture = ImageOps.fit(Image.open(ROOT/"public/images/specialists/cobalt-woven-v2.webp").convert("RGB"), (w,h))
    # Keep the fabric texture legible but calm behind the UI.
    bg = Image.blend(texture, Image.new("RGB",(w,h),"#344ae7"), 0.22)
    assets=[]
    for stage in STAGES:
        name,crop,target = stage["mobile" if mobile else "desktop"]
        original=Image.open(CAPTURES/name).convert("RGB")
        if crop:
            source=original.crop(crop)
        else:
            source=original
            crop=(0,0,*source.size)
        maxw,maxh=(650,650) if mobile else (980,530)
        ratio=min(maxw/source.width,maxh/source.height)
        image=source.resize((round(source.width*ratio),round(source.height*ratio)),Image.Resampling.LANCZOS)
        x=(w-image.width)//2
        y=220+(650-image.height)//2 if mobile else 190+(530-image.height)//2
        # A narrow browser-like rim, without invented application content.
        base=bg.copy()
        shadow=Image.new("RGBA",(w,h))
        ImageDraw.Draw(shadow).rounded_rectangle((x-5,y-5,x+image.width+5,y+image.height+5),radius=18,fill=(10,16,70,90))
        shadow=shadow.filter(ImageFilter.GaussianBlur(15))
        base=Image.alpha_composite(base.convert("RGBA"),shadow).convert("RGB")
        mask=Image.new("L",image.size)
        ImageDraw.Draw(mask).rounded_rectangle((0,0,image.width,image.height),radius=12,fill=255)
        base.paste(image,(x,y),mask)
        draw=ImageDraw.Draw(base)
        draw.rounded_rectangle((x,y,x+image.width-1,y+image.height-1),radius=12,outline=(255,255,255),width=1)
        text_center(draw,"VIASEE  /  CUM FUNCȚIONEAZĂ",34 if mobile else 30,font(18 if mobile else 15), "#d9ddff",w)
        titlefont=font(39 if mobile else 51,True)
        while draw.textbbox((0,0),stage["title"],font=titlefont)[2]>w-56:
            titlefont=font(titlefont.size-1,True)
        text_center(draw,stage["title"],82 if mobile else 63,titlefont,"#fffdf6",w)
        subfont=font(22 if mobile else 23)
        while draw.textbbox((0,0),stage["subtitle"],font=subfont)[2]>w-44:
            subfont=font(subfont.size-1)
        text_center(draw,stage["subtitle"],148 if mobile else 130,subfont,"#eaecff",w)
        # Progress line stays away from page playback controls.
        barw=150 if mobile else 210
        gap=14
        startx=(w-(3*barw+2*gap))//2
        for chapter in range(3):
            draw.rounded_rectangle((startx+chapter*(barw+gap),h-42,startx+chapter*(barw+gap)+barw,h-38),
                                   radius=2,fill="#fffdf6" if chapter==stage["chapter"] else "#909aee")
        if target:
            dest=(x+(target[0]-crop[0])*ratio,y+(target[1]-crop[1])*ratio)
        else:
            dest=None
        assets.append((base,dest))
    return assets

def frame(t, assets, mobile):
    index=next(i for i,s in enumerate(STAGES) if s["start"]<=t<s["end"])
    stage=STAGES[index]
    frame=assets[index][0].copy()
    draw=ImageDraw.Draw(frame)
    dest=assets[index][1]
    if dest:
        elapsed=t-stage["start"]
        length=stage["end"]-stage["start"]
        # Cursor approaches the real button, waits, then clicks before the cut.
        travel=smooth((elapsed-0.6)/max(0.8,length-1.5))
        origin=(dest[0]+(100 if mobile else 160),dest[1]+(90 if mobile else 100))
        px=origin[0]+(dest[0]-origin[0])*travel
        py=origin[1]+(dest[1]-origin[1])*travel
        click_start=length-0.65
        if elapsed>=click_start:
            pulse=(elapsed-click_start)/0.65
            radius=10+pulse*29
            draw.ellipse((dest[0]-radius,dest[1]-radius,dest[0]+radius,dest[1]+radius),
                         outline="#4468ed",width=4)
            draw.ellipse((dest[0]-5,dest[1]-5,dest[0]+5,dest[1]+5),fill="#4468ed")
        cursor(draw,px,py,42 if mobile else 38)
    # Brief darkened dissolve around editorial cuts; no long loading screens.
    local=t-stage["start"]
    if index>0 and local<0.14:
        frame=Image.blend(Image.new("RGB",frame.size,"#344ae7"),frame,smooth(local/0.14))
    return frame

def render(mobile):
    label="client-journey-mobile" if mobile else "client-journey"
    dimensions=(720,960) if mobile else (1280,800)
    assets=prepare(mobile)
    frame(1.0,assets,mobile).save(OUT/(label+"-poster-v1.jpg"),quality=88,optimize=True)
    binary=imageio_ffmpeg.get_ffmpeg_exe()
    command=[binary,"-y","-loglevel","warning","-f","rawvideo","-vcodec","rawvideo","-pix_fmt","rgb24",
             "-s",f"{dimensions[0]}x{dimensions[1]}","-r",str(FPS),"-i","-",
             "-an","-c:v","libx264","-preset","medium","-crf","25","-pix_fmt","yuv420p",
             "-movflags","+faststart",str(OUT/(label+"-v1.mp4"))]
    with subprocess.Popen(command,stdin=subprocess.PIPE) as process:
        for n in range(FPS*DURATION):
            process.stdin.write(frame(n/FPS,assets,mobile).tobytes())
        process.stdin.close()
        if process.wait()!=0:
            raise RuntimeError("Video encoding failed")
    print(label, "rendered", flush=True)

if __name__=="__main__":
    render(False)
    render(True)
    print("34 seconds, silent H.264, desktop + mobile", flush=True)
