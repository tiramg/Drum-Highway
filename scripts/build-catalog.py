"""Render original Drum Highway compositions and sample-aligned drum charts."""
from pathlib import Path
import json, math, wave
import numpy as np
ROOT=Path(__file__).resolve().parents[1]/'dist'/'catalog';ROOT.mkdir(parents=True,exist_ok=True)
SR=16000
rng=np.random.default_rng(54811)
songs=[('river-drive','River Drive',104,'Rock','Beginner',[40,36,43,38],False),('midnight-pocket','Midnight Pocket',96,'Funk','Intermediate',[40,43,45,38],False),('north-fork-shuffle','North Fork Shuffle',112,'Blues shuffle','Intermediate',[40,45,40,47],True),('backbeat-avenue','Backbeat Avenue',120,'Pop rock','Beginner',[48,43,45,41],False)]
def freq(m):return 440*2**((m-69)/12)
def put(dest,start,sound,gain=1):
 at=round(start*SR);end=min(len(dest),at+len(sound));
 if at>=0 and end>at:dest[at:end]+=sound[:end-at]*gain

def tone(m,length,kind='bass'):
 t=np.arange(round(length*SR))/SR;f=freq(m)
 if kind=='bass':s=np.sin(2*np.pi*f*t)+.27*np.sin(4*np.pi*f*t)+.12*np.sin(6*np.pi*f*t);env=np.minimum(t/.008,1)*np.exp(-t*3/length)
 elif kind=='chord':s=np.sin(2*np.pi*f*t)+.3*np.sin(2*np.pi*f*2.003*t)+.1*np.sin(2*np.pi*f*3*t);env=np.minimum(t/.006,1)*np.exp(-t*4/length)
 else:s=np.sin(2*np.pi*f*t)+.18*np.sin(2*np.pi*f*2*t);env=np.minimum(t/.018,1)*np.minimum(np.maximum(length-t,0)/.09,1)
 return s*env

def drum(id,art=None):
 length={'kick':.28,'snare':.24,'hat':.1,'ride':.4,'crash1':.75,'crash2':.75}.get(id,.26)
 if art=='open':length=.36
 t=np.arange(round(length*SR))/SR;noise=rng.uniform(-1,1,len(t));hp=np.r_[noise[0],np.diff(noise)]
 if id=='kick':phase=2*np.pi*(48*t+80*.035*(1-np.exp(-t/.035)));return .9*np.sin(phase)*np.exp(-t*18)+.05*hp*np.exp(-t*100)
 if id=='snare':return (.52*hp*np.exp(-t*23)+.3*np.sin(2*np.pi*185*t)*np.exp(-t*35))
 if id.startswith('tom') or id=='floor':f={'tom1':210,'tom2':170,'tom3':135,'floor':95}[id];return .65*np.sin(2*np.pi*(f*t+15*.04*(1-np.exp(-t/.04))))*np.exp(-t*13)+.035*hp*np.exp(-t*45)
 return hp*.14*np.exp(-t*(45 if id=='hat' and art!='open' else 10 if id=='ride' else 6))
entries=[]
for slug,title,bpm,style,difficulty,roots,shuffle in songs:
 beat=60/bpm;bars=24;lead=2;dur=lead+bars*4*beat+1.5;n=round(dur*SR);back=np.zeros(n);drums=np.zeros(n);notes=[];barTimes=[lead+i*4*beat for i in range(bars+1)]
 def hit(b,id,velocity=1,art=None):
  t=lead+b*beat;notes.append({'id':id,'t':round(t,6),'articulation':art});put(drums,t,drum(id,art),velocity)
 for bar in range(bars):
  root=roots[(bar//2)%4];base=bar*4
  for b in range(4):
   off=base+b;put(back,lead+off*beat,tone(root,beat*.86),.17)
   if b in [0,2]:
    for m in [root+12,root+16,root+19]:put(back,lead+off*beat,tone(m,beat*1.4,'chord'),.055)
   melodic=root+24+[0,7,4,2][(bar+b)%4]
   if bar>=4 and (b+bar)%2==0:put(back,lead+(off+.25)*beat,tone(melodic,beat*.65,'lead'),.07)
   hit(off,'hat',.8);hit(off+(2/3 if shuffle else .5),'hat',.6,'open' if bar%8==6 and b==3 else None)
   if b in [0,2]:hit(off,'kick',.9)
   if b in [1,3]:hit(off,'snare',.85)
   if style=='Funk' and b==2:hit(off+.75,'kick',.7)
  if bar in [0,8,16]:hit(base,'crash1',.7)
  if bar%8==7:
   for j,id in enumerate(['tom1','tom2','tom3','floor']):hit(base+3+j*.25,id,.7)
  if style=='Pop rock' and bar>=16:
   for b in [0,2]:hit(base+b,'ride',.6)
 # Identical duration, gain, and sample timeline for both versions.
 original=back+drums;gain=.9/max(1,np.max(np.abs(original)),np.max(np.abs(back)))
 folder=ROOT/slug;folder.mkdir(exist_ok=True)
 for version,samples in [('original',original),('drumless',back)]:
  pcm=np.clip(samples*gain,-1,1);pcm[-SR//2:]*=np.linspace(1,0,SR//2)
  with wave.open(str(folder/(version+'.wav')),'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(SR);f.writeframes((pcm*32767).astype('<i2').tobytes())
 chart={'title':title,'duration':round(n/SR,6),'bars':barTimes,'notes':sorted(notes,key=lambda x:x['t'])};(folder/'chart.json').write_text(json.dumps(chart,separators=(',',':')))
 entries.append({'id':slug,'title':title,'artist':'Drum Highway Originals','style':style,'difficulty':difficulty,'bpm':bpm,'duration':chart['duration'],'noteCount':len(notes),'chart':'catalog/'+slug+'/chart.json','versions':{'original':{'url':'catalog/'+slug+'/original.wav'},'drumless':{'url':'catalog/'+slug+'/drumless.wav'}},'timing':'sample-aligned','description':'Original synthesized practice composition; full mix and drumless mix share one sample timeline.'})
(ROOT/'songs.json').write_text(json.dumps({'version':1,'songs':entries},indent=2));print('Prepared',len(entries),'songs with both audio versions and charts.')
