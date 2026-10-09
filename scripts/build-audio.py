"""Original reproducible synthesized SFX. WAV runtime assets, editable generator.
No third-party recordings, music or voice cloning. Peaks are measured, not LUFS.
"""
from pathlib import Path
import math,random,wave,struct,json,io
base=Path(__file__).resolve().parent.parent
directory=base/'assets/audio/sfx';directory.mkdir(parents=True,exist_ok=True)
names=['infantry','track','wheel','leg','vehicle','ship','jet','helicopter','aa','rifle','shell','missile','mortar','rail','bomb','torpedo','impact','unknown','hit.light','hit.armor','hit.sea','hit.air','hit.building','destruction','capture','repair','scan','jam','entrench','anchor','shock','sniper','deploy','construct','produce','upgrade','cancel','turn','select','invalid','transition','wing','rifle.heavy','shell.light','shell.heavy','retire.land','retire.sea','retire.air']
rate=22050;manifest={};peaks=[]
for k,name in enumerate(names):
    variants=[]
    for v in range(4):
        duration=.16 if v==3 else .32 if name in ['destruction','capture','ship','jet'] else .24
        length=int(rate*duration);data=[];rng=random.Random(4200+k*7+v)
        freq=110 if name in ['shell','shell.heavy','vehicle','track','destruction','impact','hit.armor','retire.land'] else 480 if name in ['scan','repair','select','capture','deploy','produce','turn'] else 220
        for i in range(length):
            t=i/rate;p=t/duration;attack=min(1,t/.006);env=attack*math.exp(-p*(7 if v==3 else 5))
            noise=rng.uniform(-1,1)
            if name in ['capture','deploy','repair','turn']:
                f=[330,370,495][min(2,int(p*3))];signal=math.sin(2*math.pi*f*t)*.35
            elif name in ['rifle','rifle.heavy','aa','infantry']:
                pulse=(1-(t%(duration/3))/(duration/3))**3;signal=(noise*.45+math.sin(2*math.pi*freq*t)*.12)*pulse
            elif name in ['scan','jam','rail','sniper','missile','bomb']:
                f=freq*(1+p*(3 if name in ['scan','missile'] else -0.65));signal=math.sin(2*math.pi*f*t)*.26+noise*.1
            elif name in ['ship','helicopter','jet','wing','hit.sea','retire.sea','retire.air']:
                signal=noise*.28+math.sin(2*math.pi*freq*t)*.1
            else:signal=noise*.28+math.sin(2*math.pi*freq*t)*.24
            data.append(max(-.7,min(.7,signal*env)))
        stem=name.replace('.','_')+('_short' if v==3 else '_v'+str(v+1));filename=stem+'.wav';buf=io.BytesIO()
        with wave.open(buf,'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes(b''.join(struct.pack('<h',int(x*32767)) for x in data))
        (directory/filename).write_bytes(buf.getvalue())
        peak=max(abs(x) for x in data);peaks.append(peak)
        variants.append({'uri':'assets/audio/sfx/'+filename,'duration':duration,'sampleRate':rate,'channels':1,'pcmBytes':length*4,'short':v==3,'peak':peak})
    manifest[name]=variants
(base/'assets/audio/manifests').mkdir(parents=True,exist_ok=True)
(base/'assets/audio/manifests/sfx.json').write_text(json.dumps({'provenance':'Original procedural synthesis; scripts/build-audio.py','cues':manifest},indent=2),encoding='utf-8')
(base/'src/audio-samples.js').write_text("(function(root){'use strict';root.GameAudioSamples="+json.dumps(manifest,separators=(',',':'))+";if(typeof module!=='undefined')module.exports=root.GameAudioSamples;})(typeof window!=='undefined'?window:globalThis);\n",encoding='utf-8')
print(f'{len(names)*4} original WAV variants, highest linear peak {max(peaks):.3f}; no loudness / listening claim')
