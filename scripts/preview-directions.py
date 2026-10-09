from PIL import Image,ImageDraw
from pathlib import Path
base=Path(__file__).resolve().parent.parent
names=sorted(p.stem for p in (base/'assets/units/chibi').glob('*.png'))
sheet=Image.new('RGB',(1400,6*195),'#F3F6F0');d=ImageDraw.Draw(sheet)
for i,name in enumerate(names):
    x=(i%7)*200;y=(i//7)*195
    for col,folder in enumerate(['chibi','rear']):
        im=Image.open(base/f'assets/units/{folder}/{name}.png').convert('RGBA');im.thumbnail((98,164))
        sheet.paste(im,(x+col*100,y+5),im)
    d.text((x+4,y+173),name,fill='#17364B');d.line((x,y+194,x+200,y+194),fill='#BCD2CE')
sheet.save(base/'reports/anime-directions-v1.png')
print('42 front/rear pairs rendered as a static asset sheet, not browser capture')
