#!/usr/bin/env python3
"""V5: motion typography + layered product artwork. Native 1080p, 60 fps.
Reuses V4 drawing primitives, brand fonts and the existing cobalt woven texture.
"""
from pathlib import Path
from functools import lru_cache
import importlib.util, io, math, re, subprocess, sys
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw, ImageOps, ImageFilter
import imageio_ffmpeg

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("motion_v4",ROOT/"scripts/render-client-journey-v4.py")
v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
S=v.S;FPS=60;LENGTH=26
INK=v.INK;MUTED=v.MUTED;BLUE=v.BLUE;PAPER=v.PAPER;LIGHT=v.LIGHT
txt=v.txt;rr=v.rr;line=v.line;circle=v.circle;arrow=v.arrow;check=v.check;pin=v.pin
ease=v.ease;clamp=v.clamp;pill=v.pill
OUT=ROOT/"public/videos"
TIMES=[(0,4.7),(4.7,8),(8,10.8),(10.8,13.7),(13.7,18.6),(18.6,22),(22,26)]
STILLS=[.35,2.6,6.8,9.7,12.6,17.5,20.8,24.2]

def layer(w,h):return Image.new("RGBA",(round(w*S),round(h*S)))

@lru_cache(maxsize=30)
def shadow(w,h,r=18):
    im=layer(w+100,h+100)
    rr(im,(48,53,w+52,h+57),r,(18,23,66,70))
    return im.filter(ImageFilter.GaussianBlur(16*S))

def place(im,card,x,y,scale=1,alpha=1,shade=True,rotation=0):
    if alpha<=0:return
    W,H=card.width/S*scale,card.height/S*scale
    a=card.resize((round(W*S),round(H*S)),Image.Resampling.LANCZOS)
    sh=shadow(round(W),round(H))
    if rotation:
        a=a.rotate(rotation,Image.Resampling.BICUBIC,expand=True)
        x-=(a.width/S-W)/2;y-=(a.height/S-H)/2
    if alpha<1:
        a.putalpha(a.getchannel("A").point(lambda z:round(z*alpha)))
        sh=sh.copy();sh.putalpha(sh.getchannel("A").point(lambda z:round(z*alpha)))
    if shade:im.alpha_composite(sh,(round((x-50)*S),round((y-50)*S)))
    im.alpha_composite(a,(round(x*S),round(y*S)))

@lru_cache(maxsize=20)
def raster_brand_svg(name,w):
    # Brand SVGs contain only their traced M/L/Z paths; draw those exact polygons.
    root=ET.parse(ROOT/"public/brand"/name).getroot()
    _,_,vw,vh=map(float,root.attrib["viewBox"].split())
    out=layer(w,w*vh/vw);draw=ImageDraw.Draw(out)
    for path in root.findall("{http://www.w3.org/2000/svg}path"):
        d=path.attrib["d"]
        assert not re.search("[CQAHVSTcqahvst]",d), "Unexpected brand path command"
        for subpath in re.findall(r"M([^M]+)",d):
            nums=list(map(float,re.findall(r"-?\d+(?:\.\d+)?",subpath)))
            points=[(nums[i]/vw*w*S,nums[i+1]/vw*w*S) for i in range(0,len(nums),2)]
            draw.polygon(points,fill=INK)
    return out

@lru_cache(maxsize=15)
def brand(w=220,white=False,symbol_only=False):
    # Rasterise the actual site vector assets, retaining their original geometry.
    symbol=raster_brand_svg("viasee-symbol.svg",w*.19)
    if symbol_only:
        result=symbol
    else:
        word=raster_brand_svg("viasee-wordmark.svg",w*.76)
        result=layer(w,max(symbol.height,word.height)/S)
        result.alpha_composite(symbol,(0,0))
        result.alpha_composite(word,(round(w*.24*S),round((result.height-word.height)/2)))
    if white:
        alpha=result.getchannel("A");result=Image.new("RGBA",result.size,"#fffdf7");result.putalpha(alpha)
    return result

def logo(im,x,y,w=110,white=False):
    im.alpha_composite(brand(w,white),(round(x*S),round(y*S)))

@lru_cache(maxsize=30)
def photo(name,w,h,r=12):
    image=ImageOps.fit(Image.open(ROOT/"public/images/specialists"/name).convert("RGBA"),(round(w*S),round(h*S)),method=Image.Resampling.LANCZOS)
    mask=Image.new("L",image.size);ImageDraw.Draw(mask).rounded_rectangle((0,0,*image.size),radius=round(r*S),fill=255)
    image.putalpha(mask);return image

def heading(im,lines,x,y,size=42,center=False,u=1):
    a=layer(im.width/S,im.height/S)
    for n,value in enumerate(lines):
        txt(a,value,x,y+n*(size*1.18),size,800,"#fffdf7",center)
    p=ease(u/.45)
    if p<1:a.putalpha(a.getchannel("A").point(lambda z:round(z*p)))
    im.alpha_composite(a,(0,round((1-p)*14*S)))

def window(w,h):
    im=layer(w,h);rr(im,(0,0,w,h),18,PAPER)
    logo(im,23,18,93)
    for n in range(3):circle(im,w-52+n*11,28,2.5,"#cacdc5")
    line(im,[(20,50),(w-20,50)],"#e0e2db",1)
    return im

def choice(value,w=360,chosen=False,h=62):
    im=layer(w,h);rr(im,(0,0,w,h),13,"#eef0ff" if chosen else "white",BLUE if chosen else "#dedfd8",1.5)
    txt(im,value,20,17,22,750)
    circle(im,w-30,h/2,11,BLUE if chosen else None,None if chosen else "#c9cec5",1.5)
    if chosen:check(im,w-30,h/2,"white",6)
    return im

def badge(value,w=234):
    im=layer(w,59);rr(im,(0,0,w,59),14,"#e8eddf","#d7decc")
    circle(im,28,29,13,"#dde7cd");check(im,28,29,"#4d623b",7)
    txt(im,value,52,17,17,750,"#3e4d32")
    return im

def eyeglasses(im,x,y,color=INK,size=24):
    circle(im,x-size*.65,y,size*.52,None,color,2)
    circle(im,x+size*.65,y,size*.52,None,color,2)
    line(im,[(x-size*.12,y-2),(x+size*.12,y-2)],color,2)
    line(im,[(x-size*1.2,y-4),(x-size*1.46,y-7)],color,2)
    line(im,[(x+size*1.2,y-4),(x+size*1.46,y-7)],color,2)

def search_scene(im,u,m):
    W,H=im.width/S,im.height/S
    heading(im,["Spui ce cauți."],W/2,87 if m else 69,36 if m else 45,True,u)
    if m:
        txt(im,"Cu propriile tale cuvinte.",W/2,150,20,550,"#edf0ff",True)
    else:
        txt(im,"O nevoie. O întrebare. Un loc de unde să începi.",W/2,131,20,550,"#edf0ff",True)
    grow=ease((u-.18)/.62)
    w=(180+(464-180)*grow) if m else (220+(656-220)*grow)
    h=58+((192 if m else 154)-58)*grow
    card=layer(w,h);rr(card,(0,0,w,h),18,"#fffefa")
    if grow>.85:
        typed="Vreau un control de vedere"[:round(26*clamp((u-.88)/1.28))]
        if m and len(typed)>17:
            txt(card,typed[:17],24,24,26,600);txt(card,typed[17:].strip(),24,59,26,600)
            tx=24+v.label(typed[17:].strip(),26,600).width/S;cy=63
        else:
            txt(card,typed,24,23,26,600);tx=24+v.label(typed,26,600).width/S;cy=27
        if u<2.6 and int(u*3)%2==0:line(card,[(tx+3,cy+4),(tx+3,cy+29)],BLUE,2)
        txt(card,"Descrie pe scurt ce cauți",24,h-44,14,550,MUTED)
        circle(card,w-44,h-43,23,BLUE if u>=3.45 else INK)
        arrow(card,w-44,h-43,up=True,size=9)
        v.paint_cursor(card,(w-44,h-43),u,3.45,origin=(w-158,h-104))
    x=(W-w)/2;y=(280 if m else 219)+(1-grow)*24
    place(im,card,x,y,alpha=ease(u/.2))
    # Short closing push into the send action.
    if u>4.2:
        overlay=layer(W,H);overlay.alpha_composite(card,(round(x*S),round(y*S)))
    return im

def confirm_scene(im,u,m):
    W,H=im.width/S,im.height/S;p=ease(u/.4)
    if m:
        heading(im,["Câteva răspunsuri.","Mai multă claritate."],W/2,55,33,True,u)
        x,y,w,h=40,233,460,338
    else:
        heading(im,["Câteva răspunsuri.","Mai multă claritate."],56,95,36,False,u)
        x,y,w,h=391,116,492,333
    card=window(w,h)
    txt(card,"Am înțeles că ai nevoie",24,80,24,800)
    txt(card,"de un control de vedere.",24,114,24,800)
    card.alpha_composite(choice("Da, continuă",w-48,u>=1.55),(24*S,177*S))
    card.alpha_composite(choice("Aleg altă nevoie",w-48),(24*S,251*S))
    place(im,card,x+(1-p)*30,y+(1-p)*15,alpha=p)
    focus=ease((u-1.55)/.38)
    if focus>0:
        selected=choice("Da, continuă",430 if m else 370,True,69)
        place(im,selected,55 if m else 480,448 if m else 298,1+.035*focus,focus)
        place(im,badge("Nevoia e confirmată"),155 if m else 306,565 if m else 408,alpha=ease((u-1.9)/.28))
    v.paint_cursor(im,(x+w-54,y+207),u,1.55,(x+w-155,y+138))
    return im

def person_scene(im,u,m):
    W,H=im.width/S,im.height/S
    heading(im,["Pentru cine cauți?"],W/2,69,35 if m else 40,True,u)
    w,h=(460,366) if m else (590,314);x=(W-w)/2;y=232 if m else 167
    card=window(w,h)
    txt(card,"Alege persoana",24,73,23,800)
    for n,value in enumerate(["Pentru mine","Pentru copilul meu","Pentru altcineva"]):
        yy=120+n*73 if m else 112+n*62
        row=choice(value,w-48,n==0 and u>=1.27,61 if m else 54)
        card.alpha_composite(row,(24*S,yy*S))
    place(im,card,x,y+(1-ease(u/.35))*20,alpha=ease(u/.35))
    focus=ease((u-1.27)/.35)
    if focus:
        front=choice("Pentru mine",384 if m else 348,True,70)
        place(im,front,x+38 if m else x-24,y+110,1+.035*focus,focus)
    v.paint_cursor(im,(x+w-54,y+(150 if m else 139)),u,1.27)
    return im

def city_scene(im,u,m):
    W,H=im.width/S,im.height/S
    heading(im,["Aproape de tine."],W/2,65,36 if m else 43,True,u)
    w,h=(460,367) if m else (625,311);x=(W-w)/2;y=228 if m else 169
    card=window(w,h);txt(card,"Unde cauți?",24,75,26,800)
    rr(card,(24,126,w-24,192),12,"white",BLUE,1.5);pin(card,47,154,MUTED,8)
    value="Cluj-Napoca"[:round(11*clamp((u-.25)/.7))]
    txt(card,value,73,144,23,650)
    if u>.9:
        opt=choice("Cluj-Napoca",w-48,u>=1.5,62)
        card.alpha_composite(opt,(24*S,round((215+(1-ease((u-.9)/.2))*12)*S)))
    place(im,card,x,y,alpha=ease(u/.32))
    if u>1.75:
        card2=badge("Căutarea e pregătită",260)
        place(im,card2,x+110 if m else x+w-189,y+h-17,alpha=ease((u-1.75)/.25))
    v.paint_cursor(im,(x+w-52,y+246),u,1.5)
    return im

def result_card(w=350,h=220,secondary=False,selected=False):
    card=layer(w,h);rr(card,(0,0,w,h),15,"#fffefa","#d4d9ca",1.5)
    image_h=round(h*.48)
    card.alpha_composite(photo("optical-light-study-v2.webp" if secondary else "optical-stilllife-v2.webp",w-16,image_h,9),(8*S,8*S))
    rr(card,(16,18,103,43),12,"#fffefa")
    txt(card,"Optică",28,23,12,750)
    fs=19 if secondary else 22
    txt(card,"Lunear Studio" if secondary else "Lunear Optic Store",18,image_h+19,fs,800)
    txt(card,"Cluj-Napoca · Optică medicală",18,image_h+53,13 if secondary else 14,550,MUTED)
    txt(card,"Exemplu de profil",18,h-37,12,550,MUTED)
    circle(card,w-34,h-32,19,BLUE if selected else INK);arrow(card,w-34,h-32,size=8)
    return card

def results_scene(im,u,m):
    W,H=im.width/S,im.height/S
    heading(im,["Vezi opțiunile.","Alegi în ritmul tău."] if m else ["Vezi opțiunile. Alegi în ritmul tău."],W/2,46 if m else 43,31 if m else 35,True,u)
    w,h=(468,437) if m else (758,358);x=(W-w)/2;y=226 if m else 133
    shell=window(w,h);txt(shell,"Locații pentru tine",23,67,23,800)
    pill(shell,"Cluj-Napoca",24,107,size=13)
    pill(shell,"Control de vedere",158,107,size=13)
    if not m:v.map_art(shell,400,158,335,177,1)
    place(im,shell,x,y,alpha=ease(u/.3))
    focus=ease((u-2.4)/.4)
    if m:
        # One editorial lead card, one compact alternative, both legible at phone width.
        a=layer(420,180);rr(a,(0,0,420,180),14,"#fffefa","#dedfd4")
        a.alpha_composite(photo("optical-stilllife-v2.webp",120,162),(8*S,9*S))
        txt(a,"Lunear Optic",145,24,24,800);txt(a,"Store",145,56,24,800)
        txt(a,"Cluj-Napoca",145,101,17,550,MUTED);txt(a,"Optică medicală",145,129,15,550,MUTED)
        circle(a,382,143,20,BLUE if u>=3.9 else INK);arrow(a,382,143,size=8)
        p=ease((u-.3)/.35);scale=.96+.06*focus
        ax=x+24-8*focus;ay=y+164-17*focus
        place(im,a,ax,ay+(1-p)*25,scale,p)
        small=layer(404,82);rr(small,(0,0,404,82),12,"#ecefdf")
        small.alpha_composite(photo("optical-light-study-v2.webp",64,64,7),(9*S,9*S))
        txt(small,"Lunear Studio",88,11,22,800);txt(small,"Cluj-Napoca",88,43,16,550,MUTED)
        b=ease((u-.57)/.35)
        place(im,small,x+34+10*focus,y+360+12*focus,.96-.035*focus,b)
        v.paint_cursor(im,(ax+382*scale,ay+143*scale),u,3.9)
    else:
        p=ease((u-.28)/.38);q=ease((u-.5)/.4)
        second=result_card(284,207,True)
        place(im,second,x+400+12*focus,y+160+14*focus,.94-.035*focus,q,rotation=-1.0*focus)
        primary=result_card(351,225,False,u>=3.9)
        ax=x+22+29*focus;ay=y+158-20*focus;scale=1+.09*focus
        place(im,primary,ax,ay+(1-p)*24,scale,p,rotation=1.1*focus)
        v.paint_cursor(im,(ax+(351-34)*scale,ay+(225-32)*scale),u,3.9)
    return im

def profile_scene(im,u,m):
    W,H=im.width/S,im.height/S
    heading(im,["Un profil clar.","Următorul pas e al tău."] if m else ["Un profil clar. Următorul pas e al tău."],W/2,50,31 if m else 34,True,u)
    w,h=(468,397) if m else (685,330);x=(W-w)/2;y=228 if m else 154
    card=window(w,h)
    pw,ph=(w-40,158) if m else (276,236)
    card.alpha_composite(photo("optician-client-editorial-v1.webp",pw,ph,12),(20*S,67*S))
    tx,ty=(24,239) if m else (323,73)
    txt(card,"Lunear Optic Store",tx,ty,27 if m else 24,800)
    txt(card,"Optică medicală",tx,ty+42,17,600,MUTED)
    pin(card,tx+9,ty+91,BLUE,7);txt(card,"Cluj-Napoca",tx+30,ty+74,18,650)
    if not m:
        rr(card,(tx,208,w-23,273),12,"#e8eddf")
        txt(card,"Servicii și date de contact",tx+15,222,17,750)
        txt(card,"Confirmi direct ce ai nevoie.",tx,288,13,550,MUTED)
    else:
        txt(card,"Servicii și date de contact",tx,ty+124,19,750)
    place(im,card,x,y+(1-ease(u/.4))*22,alpha=ease(u/.4))
    if u>.8:
        if m:
            b=badge("Compari. Apoi alegi.",254);place(im,b,143,627,alpha=ease((u-.8)/.3))
        else:
            b=layer(257,93);rr(b,(0,0,257,93),14,"#fffefa")
            circle(b,31,45,15,"#e6ebd9");check(b,31,45,"#536c3c",8)
            txt(b,"Detaliile, la îndemână.",58,20,15,800)
            txt(b,"Tu alegi unde mergi.",58,50,14,550,MUTED)
            place(im,b,651,390,alpha=ease((u-.8)/.3))
    return im

def ending_scene(im,u,m):
    W,H=im.width/S,im.height/S
    scale=.78+.22*ease((u-.15)/.5)
    b=brand(328 if m else 394,True)
    bx=(W-b.width/S*scale)/2
    place(im,b,bx,198 if m else 142,scale,ease(u/.35),False)
    heading(im,["Spui ce ai nevoie.","Vezi unde poți merge."],W/2,333 if m else 256,34 if m else 44,True,max(0,u-.45))
    return im

def frame(t,m):
    idx=next(i for i,(a,b) in enumerate(TIMES) if a<=t<b);u=t-TIMES[idx][0]
    im=v.background(m).copy()
    [search_scene,confirm_scene,person_scene,city_scene,results_scene,profile_scene,ending_scene][idx](im,u,m)
    # Short editorial cut, 100ms of settle instead of slow drifting.
    return im.convert("RGB")

def render(m):
    name="client-journey-mobile-v5" if m else "client-journey-v5"
    size=(1080,1440) if m else (1920,1080)
    frame(2.6,m).save(OUT/(name+"-poster.jpg"),quality=94,subsampling=0)
    for n,t in enumerate(STILLS):frame(t,m).save(OUT/(name+f"-frame-{n}.jpg"),quality=94,subsampling=0)
    ff=imageio_ffmpeg.get_ffmpeg_exe()
    args=[ff,"-y","-loglevel","warning","-f","rawvideo","-pix_fmt","rgb24","-s",f"{size[0]}x{size[1]}","-r",str(FPS),"-i","-","-an","-c:v","libx264","-preset","fast","-crf","19","-pix_fmt","yuv420p","-g","120","-movflags","+faststart",str(OUT/(name+".mp4"))]
    p=subprocess.Popen(args,stdin=subprocess.PIPE)
    try:
        for n in range(FPS*LENGTH):
            p.stdin.write(frame(n/FPS,m).tobytes())
            if n%300==0:print(name,n/FPS,"seconds rendered",flush=True)
        p.stdin.close()
        if p.wait()!=0:raise RuntimeError("Encoder failed")
    except Exception:p.kill();raise
    print(name,"finished", (OUT/(name+".mp4")).stat().st_size,flush=True)

if __name__=="__main__":
    if "--stills" in sys.argv:
        for m in (False,True):
            name="client-journey-mobile-v5" if m else "client-journey-v5"
            for n,t in enumerate(STILLS):frame(t,m).save(OUT/(name+f"-frame-{n}.jpg"),quality=93,subsampling=0)
        print("V5 stills ready")
    else:render(False);render(True)
