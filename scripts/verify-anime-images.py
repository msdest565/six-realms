from pathlib import Path
from PIL import Image
import json
base=Path(__file__).resolve().parent.parent
rows=[];failures=[]
for folder in ['chibi','rear','portraits','avatars','thumbnails']:
    for file in sorted((base/f'assets/units/{folder}').glob('*.png')):
        im=Image.open(file).convert('RGBA');w,h=im.size
        if folder in ['chibi','rear']:
            corners=[im.getpixel(p)[3] for p in [(0,0),(w-1,0),(0,h-1),(w-1,h-1)]]
            if corners!=[0,0,0,0]:failures.append(file.name+' alpha corners')
        else:corners=None
        rows.append({'uri':file.relative_to(base).as_posix(),'size':[w,h],'bytes':file.stat().st_size,'rgbaBytes':w*h*4,'transparentCorners':corners})
sfx=list((base/'assets/audio/sfx').glob('*.wav'))
report={'scope':'Filesystem PNG/WAV metadata and alpha checks, not measured browser/GPU/device memory','runtimeUnitPngs':len(rows),'portraitCount':len([r for r in rows if '/portraits/' in r['uri']]),'chibiCount':len([r for r in rows if '/chibi/' in r['uri'] or '/rear/' in r['uri']]),'wavFileCount':len(sfx),'unitPngDiskBytes':sum(r['bytes'] for r in rows),'sfxDiskBytes':sum(f.stat().st_size for f in sfx),'allUnitImagesRGBAEstimateBytes':sum(r['rgbaBytes'] for r in rows),'note':'All-image estimate includes all portraits; lazy loading and URL sharing reduce actual live residency. No measured GPU figure. WAV decoder LRU 4 MiB + max four 12kHz 8s stereo environment buffers about 2.93 MiB.','failures':failures,'images':rows}
(base/'reports/anime-assets-v1.0.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(f'{len(rows)} runtime unit PNGs / {len(sfx)} WAV files / {len(failures)} alpha failures')
if failures:raise SystemExit(1)
