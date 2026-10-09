from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageFont
import json,io
base=Path(__file__).resolve().parent.parent
exports=json.loads((base/'assets/units/manifests/exports.json').read_text(encoding='utf-8'))
cols=6;cw=240;ch=210
canvas=Image.new('RGB',(cols*cw,((len(exports)+cols-1)//cols)*ch),(243,246,240));draw=ImageDraw.Draw(canvas)
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',14)
for i,r in enumerate(exports):
    x=(i%cols)*cw;y=(i//cols)*ch
    for image,xx in [('portraits',x),('chibi',x+cw//2)]:
        im=Image.open(base/f'assets/units/{image}/{r["id"]}.png').convert('RGBA')
        im=ImageOps.contain(im,(cw//2-8,ch-35),Image.Resampling.LANCZOS)
        canvas.paste(im,(xx+(cw//2-im.width)//2,y+5),im)
    draw.text((x+9,y+ch-24),r['id'],font=font,fill=(23,54,75))
    draw.line((x,y+ch-1,x+cw,y+ch-1),fill=(182,202,198))
buf=io.BytesIO();canvas.save(buf,format='PNG');(base/'reports/anime-roster-v1.png').write_bytes(buf.getvalue())
print('Static asset contact sheet rendered; not a browser screenshot')
