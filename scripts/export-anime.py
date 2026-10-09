"""Mechanical cutting / size exports required by the dual-version asset brief.
No repainting or AI image editing; preserve original generated RGBA sources.
"""
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageFilter, ImageChops
from collections import deque
import json, io
BASE=Path(__file__).resolve().parent.parent
SOURCE=BASE/'assets/units/sources'
records=[]
def save_png(im,path):
    buf=io.BytesIO()
    im.save(buf,format='PNG',optimize=True)
    path.write_bytes(buf.getvalue())
def trim(im):
    # Isolate the character after half-sheet cutting; discard detached fragments
    # from the adjacent figure without repainting pixels of the selected figure.
    scale=4
    alpha=im.getchannel('A')
    small=alpha.resize((max(1,im.width//scale),max(1,im.height//scale)),Image.Resampling.NEAREST).point(lambda v:255 if v>24 else 0).filter(ImageFilter.MaxFilter(7))
    sw,sh=small.size;pixels=small.load();visited=set();largest=[]
    for sy in range(sh):
        for sx in range(sw):
            if not pixels[sx,sy] or (sx,sy) in visited:continue
            work=deque([(sx,sy)]);visited.add((sx,sy));component=[]
            while work:
                x,y=work.popleft();component.append((x,y))
                for xx,yy in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
                    if 0<=xx<sw and 0<=yy<sh and pixels[xx,yy] and (xx,yy) not in visited:
                        visited.add((xx,yy));work.append((xx,yy))
            if len(component)>len(largest):largest=component
    mask=Image.new('L',small.size);draw=ImageDraw.Draw(mask)
    for p in largest:draw.point(p,fill=255)
    mask=mask.resize(im.size,Image.Resampling.NEAREST).filter(ImageFilter.MaxFilter(9))
    im=im.copy();im.putalpha(ImageChops.multiply(alpha,mask))
    box=im.getchannel('A').point(lambda v:255 if v>8 else 0).getbbox()
    return im.crop(box) if box else im
def fit(im,size,pivot=.84):
    canvas=Image.new('RGBA',(size,size))
    im=ImageOps.contain(im,(int(size*.88),int(size*.79)),Image.Resampling.LANCZOS)
    canvas.alpha_composite(im,((size-im.width)//2,int(size*pivot)-im.height))
    return canvas
for src in sorted(SOURCE.glob('*.png')):
    if src.stem.endswith('-v2'):continue
    name=src.stem
    if (SOURCE/f'{name}-v2.png').exists():src=SOURCE/f'{name}-v2.png'
    im=Image.open(src).convert('RGBA');w,h=im.size
    if name.endswith('-land'):
        chibi=trim(im)
        out=fit(chibi,320)
        save_png(out,BASE/f'assets/units/chibi/{name}.png')
        continue
    portrait=trim(im.crop((0,0,w//2,h)))
    chibi=trim(im.crop((w//2,0,w,h)))
    full=ImageOps.contain(portrait,(768,1024),Image.Resampling.LANCZOS)
    save_png(full,BASE/f'assets/units/portraits/{name}.png')
    save_png(fit(chibi,320),BASE/f'assets/units/chibi/{name}.png')
    head=portrait.crop((int(portrait.width*.2),0,int(portrait.width*.8),int(portrait.height*.3)))
    save_png(ImageOps.fit(head,(128,128),Image.Resampling.LANCZOS),BASE/f'assets/units/avatars/{name}.png')
    records.append({'id':name,'sourceAsset':str(src.relative_to(BASE)).replace('\\','/'),'sourceSize':[w,h],'portraitSize':list(full.size),'chibiSize':[320,320],'alphaCorners':[fit(chibi,320).getpixel((0,0))[-1]],'provenance':'built-in image_gen; original paired sheet retained'})
(BASE/'assets/units/manifests/exports.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
print(f'Exported {len(records)} portraits / chibis / avatars, plus available land forms')

# Direction originals are already single figures: resize / alpha trim only.
rear_dir=BASE/'assets/units/rear'
rear_dir.mkdir(exist_ok=True)
directions=[]
for src in sorted((BASE/'assets/units/direction-sources').glob('*-rear.png')):
    name=src.stem.removesuffix('-rear')
    im=trim(Image.open(src).convert('RGBA'))
    out=fit(im,320)
    save_png(out,rear_dir/f'{name}.png')
    directions.append({'id':name,'sourceAsset':src.relative_to(BASE).as_posix(),'uri':f'assets/units/rear/{name}.png','size':[320,320],'pivot':[.5,.84]})
(BASE/'assets/units/manifests/directions.json').write_text(json.dumps(directions,ensure_ascii=False,indent=2),encoding='utf-8')
print(f'Exported {len(directions)} rear diagonal figures')


# Cards use light thumbnail files; full portraits are fetched only in the detail view.
thumb_dir=BASE/'assets/units/thumbnails'
thumb_dir.mkdir(exist_ok=True)
for source in sorted((BASE/'assets/units/portraits').glob('*.png')):
    im=Image.open(source).convert('RGBA')
    save_png(ImageOps.contain(im,(256,384),Image.Resampling.LANCZOS),thumb_dir/source.name)
print('Exported 38 small card thumbnails; full detail illustrations remain available')
