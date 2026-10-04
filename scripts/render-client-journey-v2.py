#!/usr/bin/env python3
"""VIASEE motion artwork: native 1080p shapes/type, 60 fps, no enlarged screenshots.
Dependencies: Pillow, fonttools, brotli, imageio-ffmpeg. Run from the project root.
"""
from pathlib import Path
from functools import lru_cache
import math, random, subprocess, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from fontTools.ttLib import TTFont
import imageio_ffmpeg

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"public/videos"; OUT.mkdir(parents=True,exist_ok=True)
CACHE=Path("/tmp/viasee-motion-fonts"); CACHE.mkdir(exist_ok=True)
for subset in ("latin","latin-ext"):
    face=TTFont(ROOT/f"public/fonts/manrope-{subset}-wght-normal.woff2")
    face.flavor=None; face.save(CACHE/f"{subset}.ttf")
FPS=60; LENGTH=24; S=2
INK="#171918"; MUTED="#797b79"; BLUE="#4454e8"; LIGHT="#eef0ff"; PAPER="#faf9f5"
STAGES=[
    (0,4,"Spui ce cauți.",0),
    (4,7,"Confirmi nevoia.",1),
    (7,10,"Alegi pentru cine.",1),
    (10,13,"Alegi localitatea.",1),
    (13,16,"Verifici. Și continui.",1),
    (16,20,"Compari opțiunile.",2),
    (20,24,"Vezi detaliile. Tu alegi.",2),
]
LATIN=set(TTFont(CACHE/"latin.ttf").getBestCmap())

@lru_cache(maxsize=200)
def font(size,weight=600,ext=False):
    f=ImageFont.truetype(str(CACHE/("latin-ext.ttf" if ext else "latin.ttf")),round(size*S))
    f.set_variation_by_axes([weight])
    return f

@lru_cache(maxsize=2500)
def label(value,size=20,weight=600,color=INK):
    runs=[]
    for c in value:
        ext=ord(c) not in LATIN
        if runs and runs[-1][0]==ext: runs[-1]=(ext,runs[-1][1]+c)
        else: runs.append((ext,c))
    width=math.ceil(sum(font(size,weight,e).getlength(v) for e,v in runs))
    img=Image.new("RGBA",(max(1,width+4),round(size*S*1.7)))
    d=ImageDraw.Draw(img); x=0
    for ext,v in runs:
        f=font(size,weight,ext);d.text((x,round(size*S*1.1)),v,font=f,fill=color,anchor="ls");x+=f.getlength(v)
    return img

def txt(im,value,x,y,size=20,weight=600,color=INK,center=False):
    stamp=label(value,size,weight,color)
    if center: x-=stamp.width/(S*2)
    im.alpha_composite(stamp,(round(x*S),round(y*S)))

def rr(im,box,r=14,fill="white",outline=None,width=1):
    ImageDraw.Draw(im).rounded_rectangle(tuple(round(v*S) for v in box),radius=round(r*S),fill=fill,outline=outline,width=max(1,round(width*S)))

def line(im,points,fill=INK,width=2):
    ImageDraw.Draw(im).line([(round(x*S),round(y*S)) for x,y in points],fill=fill,width=max(1,round(width*S)),joint="curve")

def circle(im,x,y,r,fill=None,outline=None,width=1):
    ImageDraw.Draw(im).ellipse(((x-r)*S,(y-r)*S,(x+r)*S,(y+r)*S),fill=fill,outline=outline,width=round(width*S))

def arrow(im,x,y,color="white",up=False,size=11):
    if up:
        line(im,[(x,y+size),(x,y-size),(x-size,y),(x,y-size),(x+size,y)],color,2.7)
    else:
        line(im,[(x-size,y),(x+size,y),(x,y-size),(x+size,y),(x,y+size)],color,2.7)

def check(im,x,y,color=BLUE,size=8):
    line(im,[(x-size,y),(x-2,y+size*.6),(x+size,y-size*.7)],color,2.5)

def pin(im,x,y,color=BLUE,size=12):
    circle(im,x,y,size,None,color,2)
    line(im,[(x-size*.72,y+size*.67),(x,y+size*1.7),(x+size*.72,y+size*.67)],color,2)
    circle(im,x,y,size*.3,color)

def pill(im,value,x,y,w=None,color=LIGHT,textcolor=BLUE,size=15):
    w=w or label(value,size,650,textcolor).width/S+26
    rr(im,(x,y,x+w,y+33),16,color)
    txt(im,value,x+13,y+5,size,650,textcolor)

def clamp(v):return max(0,min(1,v))
def ease(v):return 1-(1-clamp(v))**3
def smooth(v):v=clamp(v);return v*v*(3-2*v)

def cursor_layer(size=36,press=0,angle=0):
    im=Image.new("RGBA",(round(size*S*1.6),round(size*S*1.7)))
    q=size/36*(1-.14*press);off=5
    shape=[(0,0),(1,31),(9,23),(15,36),(21,33),(15,20),(28,19)]
    points=[((a*q+off)*S,(b*q+off)*S) for a,b in shape]
    d=ImageDraw.Draw(im)
    shadow=Image.new("RGBA",im.size);ImageDraw.Draw(shadow).polygon([(x+3*S,y+4*S)for x,y in points],fill=(0,0,0,60))
    im=Image.alpha_composite(im,shadow.filter(ImageFilter.GaussianBlur(3*S)))
    d=ImageDraw.Draw(im);d.polygon(points,fill=INK);d.line(points+[points[0]],fill="white",width=round(2*S),joint="curve")
    if angle:im=im.rotate(angle,resample=Image.Resampling.BICUBIC)
    return im

def paint_cursor(im,dest,u,click_at,origin=None):
    if dest is None:return
    travel_start=click_at-.5
    if u<travel_start-.12 or u>click_at+.68:return
    progress=ease((u-travel_start)/.36)
    origin=origin or (dest[0]-110,dest[1]-48)
    x=origin[0]+(dest[0]-origin[0])*progress
    y=origin[1]+(dest[1]-origin[1])*progress
    pressed=max(0,1-abs((u-click_at-.065)/.09))
    if u>=click_at:
        pulse=clamp((u-click_at)/.46)
        ring=Image.new("RGBA",im.size)
        color=(68,84,232,round(210*(1-pulse)))
        circle(ring,dest[0],dest[1],9+34*ease(pulse),None,color,3)
        circle(ring,dest[0],dest[1],3,(68,84,232,round(170*(1-pulse))))
        im.alpha_composite(ring)
    pointer=cursor_layer(34,pressed,4*(1-progress))
    if u>click_at+.42:
        pointer.putalpha(pointer.getchannel("A").point(lambda v:round(v*(1-clamp((u-click_at-.42)/.26)))))
    im.alpha_composite(pointer,(round((x-5)*S),round((y-5)*S)))

@lru_cache(maxsize=2)
def background(mobile):
    w,h=(540,720) if mobile else (960,540)
    im=Image.new("RGBA",(w*S,h*S),"#4650df")
    texture=Image.new("RGBA",im.size)
    d=ImageDraw.Draw(texture)
    # Fine woven/stipple surface at native resolution, with restrained contrast.
    random.seed(41)
    for y in range(0,h*S,5):
        for x in range(0,w*S,5):
            k=random.randrange(3)
            color=[(255,255,255,13),(14,20,90,15),(255,255,255,6)][k]
            d.line((x,y,x+1,y+1),fill=color,width=1)
    im=Image.alpha_composite(im,texture)
    overlay=Image.new("RGBA",im.size)
    # Optical rings form the artwork around the UI, never behind text.
    cx,cy=(35,460) if mobile else (85,340)
    for r in [53,69,91,118]:
        circle(overlay,cx,cy,r,None,(218,225,255,36),1)
    cx2,cy2=(508,213) if mobile else (889,193)
    for r in [33,46,61]:
        circle(overlay,cx2,cy2,r,None,(218,225,255,46),1)
    line(overlay,[(cx2-80,cy2),(cx2+80,cy2)],(220,225,255,38),1)
    line(overlay,[(cx2,cy2-80),(cx2,cy2+80)],(220,225,255,38),1)
    # Warm small accent, balanced with the blue.
    rr(overlay,(w-54,h-106,w-38,h-90),2,(241,181,98,230))
    return Image.alpha_composite(im,overlay)

@lru_cache(maxsize=12)
def panel_shadow(w,h):
    im=Image.new("RGBA",((w+100)*S,(h+100)*S))
    rr(im,(48,54,w+52,h+58),24,(12,19,72,75))
    return im.filter(ImageFilter.GaussianBlur(16*S))

def map_art(im,x,y,w,h,p=1):
    rr(im,(x,y,x+w,y+h),14,"#f0f1e7")
    # Schematic, intentionally not presented as a navigable geographic map.
    for points in [
        [(x+8,y+h*.8),(x+w*.35,y+h*.42),(x+w*.72,y+h*.5),(x+w,y+h*.2)],
        [(x+w*.12,y),(x+w*.2,y+h*.4),(x+w*.56,y+h*.75),(x+w*.62,y+h)],
        [(x,y+h*.26),(x+w*.45,y+h*.31),(x+w*.8,y+h*.13)],
    ]:line(im,points,"#ffffff",9)
    line(im,[(x+20,y+h-20),(x+w*.35,y+h*.42),(x+w*.72,y+h*.5)],"#c8cda8",2)
    circle(im,x+w*.51,y+h*.48,30*p,"#dce0e9")
    circle(im,x+w*.51,y+h*.48,18*p,BLUE)
    pin(im,x+w*.51,y+h*.48-4,"white",6)
    for dx,dy in [(.22,.32),(.78,.66)]:
        circle(im,x+w*dx,y+h*dy,7,"white",BLUE,2)

def chrome(im,w,index):
    rr(im,(0,0,w,430 if w<600 else 340),18,PAPER)
    txt(im,"VIASEE",24,16,16,800)
    txt(im,"vedere, mai simplu",104,20,10,500,MUTED)
    for n in range(3):circle(im,w-57+n*12,28,3,"#d5d7d0")
    line(im,[(22,49),(w-22,49)],"#e5e6df",1)
    if 1<=index<=4:
        rr(im,(24,57,w-24,60),2,"#e8e9e3")
        rr(im,(24,57,24+(w-48)*(.25+(index-1)*.22),60),2,INK)

def option(im,value,y,w,selected=False):
    rr(im,(28,y,w-28,y+59),13,LIGHT if selected else "white",BLUE if selected else "#dedfd9",1.5 if selected else 1)
    txt(im,value,47,y+15,22 if w<600 else 21,700)
    circle(im,w-54,y+30,11,BLUE if selected else None,None if selected else "#d3d6cf",1.5)
    if selected:check(im,w-54,y+30,"white",6)

def scene(index,u,mobile):
    w,h=(480,430) if mobile else (760,340)
    im=Image.new("RGBA",(w*S,h*S));chrome(im,w,index)
    dest=None; click_at=2
    if index==0:
        txt(im,"Cu ce te putem ajuta?",w/2,74,28 if mobile else 31,800,center=True)
        box_y=142 if mobile else 137
        rr(im,(28,box_y,w-28,box_y+145),17,"white","#d7d9d1",1)
        content="Vreau un control de vedere"
        typed=content[:round(len(content)*clamp((u-.45)/1.45))]
        tx,ty=48,box_y+26
        if mobile and len(typed)>20:
            txt(im,typed[:20],tx,ty,23,550);txt(im,typed[20:].lstrip(),tx,ty+34,23,550)
            caret_x=tx+label(typed[20:].lstrip(),23,550).width/S;caret_y=ty+35
        else:
            txt(im,typed,tx,ty,23,550);caret_x=tx+label(typed,23,550).width/S;caret_y=ty
        if u<2.3 and int(u*3)%2==0:line(im,[(caret_x+2,caret_y+6),(caret_x+2,caret_y+28)],BLUE,2)
        dest=(w-69,box_y+111);click_at=3.05
        r=24-2*max(0,1-abs((u-click_at-.05)/.09))
        circle(im,*dest,r,BLUE if u>click_at else INK);arrow(im,*dest,up=True,size=9)
        txt(im,"Descrie pe scurt ce cauți",48,box_y+112,13,500,MUTED)
        if mobile:
            pill(im,"Oftalmolog",32,320,color="#eceee7",textcolor=INK,size=16)
            pill(im,"Control de vedere",192,320,color="#eceee7",textcolor=INK,size=16)
        else:
            txt(im,"Medici, clinici și optici, aproape de tine.",w/2,304,15,500,MUTED,True)
    elif index==1:
        txt(im,"Am înțeles că ai nevoie",30,85,27,800)
        txt(im,"de un control de vedere.",30,122,27,800)
        y=209 if mobile else 183
        click_at=1.55
        option(im,"Da, continuă",y,w,u>=click_at)
        option(im,"Aleg altă nevoie",y+73,w)
        dest=(w-62,y+31)
    elif index==2:
        txt(im,"Pentru cine este?",30,85,29,800)
        y=145 if mobile else 127
        click_at=1.45
        for n,value in enumerate(["Pentru mine","Pentru copilul meu","Pentru altcineva"]):
            option(im,value,y+n*67,w,n==0 and u>=click_at)
        dest=(w-62,y+31)
    elif index==3:
        txt(im,"Unde cauți?",30,85,29,800)
        y=158 if mobile else 137
        rr(im,(28,y,w-28,y+67),14,"white",BLUE,1.5)
        pin(im,53,y+30,MUTED,8)
        value="Cluj-Napoca"[:round(11*clamp((u-.35)/.65))]
        txt(im,value,77,y+19,24,600)
        if u>.97:
            delta=(1-ease((u-.97)/.22))*11
            option(im,"Cluj-Napoca",y+88+delta,w,u>=2.02)
        dest=(w-62,y+118);click_at=2.02
        if mobile:txt(im,"Cauți în zona aleasă de tine.",31,351,17,500,MUTED)
    elif index==4:
        txt(im,"Am pregătit căutarea.",30,82,28,800)
        rr(im,(28,136,w-28,247 if mobile else 231),14,"white","#e1e3db",1)
        txt(im,"Control de vedere",49,150,25,750)
        pin(im,57,205,BLUE,7);txt(im,"Cluj-Napoca",78,189,21,600)
        y=288 if mobile else 258
        click_at=2.18
        press=max(0,1-abs((u-click_at-.07)/.12))*2
        rr(im,(28+press,y+press,w-28-press,y+58-press),14,BLUE if u>=click_at else INK)
        txt(im,"Caută rezultate",w/2-10,y+14,22,750,"white",True)
        arrow(im,w-59,y+30,size=9)
        dest=(w-67,y+30)
    elif index==5:
        txt(im,"Recomandările tale",28,68,27,800)
        pill(im,"Cluj-Napoca",28,112,size=14)
        pill(im,"Control de vedere",168,112,size=14)
        cw=w-56 if mobile else 359
        y=167
        names=[("Avantaj Optik","Str. Napoca nr. 7"),("Gama Optic","Cluj · Aushopping")]
        for n,(name,address) in enumerate(names):
            progress=ease((u-.2-n*.14)/.32)
            yy=y+n*(114 if mobile else 83)+(1-progress)*20
            rh=99 if mobile else 81
            if progress<=0:continue
            selected=n==0 and u>=3.05
            rr(im,(28,yy,28+cw,yy+rh),13,LIGHT if selected else "white",BLUE if selected else "#dedfd8",1.5 if selected else 1)
            txt(im,name,45,yy+10,23 if mobile else 20,800)
            txt(im,address,45,yy+43 if mobile else yy+36,17 if mobile else 14,500,MUTED)
            txt(im,"Profil din director",45,yy+72 if mobile else yy+61,12 if not mobile else 13,550,BLUE)
            circle(im,28+cw-28,yy+rh-27,17,BLUE if selected else INK)
            arrow(im,28+cw-28,yy+rh-27,size=7)
        if not mobile:
            map_art(im,416,166,316,161,ease((u-.4)/.55))
        dest=(28+cw-28,y+(99 if mobile else 81)-27);click_at=3.05
    else:
        if mobile:
            rr(im,(27,75,93,141),14,LIGHT);txt(im,"AO",60,92,25,800,BLUE,True)
            txt(im,"Avantaj Optik",109,76,26,800)
            txt(im,"Cluj-Napoca",109,112,20,550,MUTED)
            pill(im,"Profil din director",29,158,size=14)
            rr(im,(28,215,w-28,318),14,"white","#e0e2d9",1)
            pin(im,52,241,BLUE,8);txt(im,"Str. Napoca nr. 7",75,225,22,650)
            txt(im,"0771 096 086",48,274,22,750)
            txt(im,"Confirmă direct serviciul căutat.",29,349,17,550,MUTED)
        else:
            rr(im,(28,80,96,148),15,LIGHT);txt(im,"AO",62,96,27,800,BLUE,True)
            txt(im,"Avantaj Optik",115,81,30,800)
            txt(im,"Cluj-Napoca",115,122,19,550,MUTED)
            pill(im,"Profil din director",28,169,size=14)
            pin(im,42,230,BLUE,8);txt(im,"Str. Napoca nr. 7",65,211,22,650)
            txt(im,"0771 096 086",29,257,25,750)
            map_art(im,440,78,292,220,ease((u-.25)/.5))
    if index<6:paint_cursor(im,dest,u,click_at)
    return im

def frame(t,mobile):
    index=next(i for i,(start,end,*_) in enumerate(STAGES) if start<=t<end)
    start,end,title,chapter=STAGES[index];u=t-start
    im=background(mobile).copy();W,H=im.width/S,im.height/S
    txt(im,"VIASEE  /  CUM FUNCȚIONEAZĂ",30 if mobile else 62,26 if mobile else 23,12,700,"#dee1ff")
    title_size=32 if mobile else 38
    if mobile and index==6:
        txt(im,"Vezi detaliile.",30,65,34,800,"white")
        txt(im,"Tu alegi.",30,110,34,800,"white")
    else:
        txt(im,title,30 if mobile else 62,68 if mobile else 53,title_size,800,"white")
    panel=scene(index,u,mobile)
    # Short controlled camera push. Movement finishes before reading.
    intro=ease(u/.38)
    zoom=1+.025*ease(u/.6)
    if index in (1,2,3,4):zoom+=.018*ease((u-1.7)/.28)
    sw,sh=panel.width/S*zoom,panel.height/S*zoom
    panel=panel.resize((round(sw*S),round(sh*S)),Image.Resampling.LANCZOS)
    px=(W-sw)/2+(1-intro)*33
    py=(196 if mobile else 129)+(1-intro)*15
    if mobile and index==6:py=203
    shad=panel_shadow(round(sw),round(sh))
    if intro<1:
        panel.putalpha(panel.getchannel("A").point(lambda v:round(v*intro)))
        shad=shad.copy();shad.putalpha(shad.getchannel("A").point(lambda v:round(v*intro)))
    im.alpha_composite(shad,(round((px-50)*S),round((py-50)*S)))
    im.alpha_composite(panel,(round(px*S),round(py*S)))
    # Finishing accents on the stage, separate from the UI.
    x0=31 if mobile else 62; y=682 if mobile else 518
    for n in range(3):
        length=54 if mobile else 105
        rr(im,(x0+n*(length+10),y,x0+n*(length+10)+length,y+3),1,"#f9f8f0" if n==chapter else "#8189eb")
    # Bottom-right area is reserved for accessible player controls.
    return im.convert("RGB")

def render(mobile):
    name="client-journey-mobile-v2" if mobile else "client-journey-v2"
    size=(1080,1440) if mobile else (1920,1080)
    frame(2.5,mobile).save(OUT/(name+"-poster.jpg"),quality=94,subsampling=0,optimize=True)
    # Save diagnostic frames, useful when updating the artwork.
    stills=[frame(t,mobile) for t in [2.6,5.7,8.7,11.7,14.8,17.8,21.5]]
    for n,still in enumerate(stills):
        still.save(OUT/(name+f"-frame-{n}.jpg"),quality=93,subsampling=0)
    ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
    args=[ffmpeg,"-y","-loglevel","warning","-f","rawvideo","-pix_fmt","rgb24","-s",f"{size[0]}x{size[1]}","-r",str(FPS),"-i","-",
          "-an","-c:v","libx264","-preset","fast","-crf","18","-pix_fmt","yuv420p","-g","120","-movflags","+faststart",str(OUT/(name+".mp4"))]
    process=subprocess.Popen(args,stdin=subprocess.PIPE)
    try:
        for n in range(FPS*LENGTH):
            process.stdin.write(frame(n/FPS,mobile).tobytes())
        process.stdin.close()
        if process.wait()!=0:raise RuntimeError("Encoder failed")
    except Exception:
        process.kill();raise
    print(name, "finished", (OUT/(name+".mp4")).stat().st_size,flush=True)

if __name__=="__main__":
    if "--stills" in sys.argv:
        for mobile in (False,True):
            name="client-journey-mobile-v2" if mobile else "client-journey-v2"
            for n,t in enumerate([2.6,5.7,8.7,11.7,14.8,17.8,21.5]):
                frame(t,mobile).save(OUT/(name+f"-frame-{n}.jpg"),quality=93,subsampling=0)
        print("Artwork stills ready")
    else:
        render(False);render(True)
