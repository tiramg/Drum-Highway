from pathlib import Path
import json,wave
import numpy as np
root=Path(__file__).resolve().parents[1]/'dist'
catalog=json.loads((root/'catalog/songs.json').read_text())
assert len(catalog['songs'])==4
for song in catalog['songs']:
 chart=json.loads((root/song['chart']).read_text());audio=[]
 for version in ['original','drumless']:
  with wave.open(str(root/song['versions'][version]['url'])) as f:
   assert f.getframerate()==16000 and f.getnchannels()==1
   audio.append(np.frombuffer(f.readframes(f.getnframes()),dtype='<i2').astype(float)/32767)
 assert len(audio[0])==len(audio[1]) and abs(len(audio[0])/16000-chart['duration'])<1e-6
 assert song['noteCount']==len(chart['notes'])
 assert all(0<=n['t']<song['duration'] for n in chart['notes'])
 drums=audio[0]-audio[1]
 for note in chart['notes']:
  at=round(note['t']*16000)
  assert np.sqrt(np.mean(drums[at:at+800]**2))>.005,(song['id'],note)
 assert np.max(np.abs(audio[1]))>.01
 print('PASS',song['title'],'both hosted mixes, exact timeline,',len(chart['notes']),'audible drum cues')
