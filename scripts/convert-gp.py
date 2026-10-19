"""Convert the percussion track of a Guitar Pro score into timed lane events."""
import json, sys
import guitarpro

song = guitarpro.parse(sys.argv[1])
track = next(t for t in song.tracks if t.isPercussionTrack)
headers = song.measureHeaders
order = []
i = start = 0
passes = {}
while i < len(headers):
    if len(order) > 10000:
        raise ValueError('Invalid repeat structure')
    h = headers[i]
    if h.isRepeatOpen:
        start = i
    attempt = passes.get(start, 0)
    include = not h.repeatAlternative or bool(h.repeatAlternative & (1 << attempt))
    if include:
        order.append(i)
    if h.repeatClose > 0 and attempt < h.repeatClose:
        passes[start] = attempt + 1
        i = start
        continue
    if h.repeatClose > 0 and not h.repeatAlternative:
        passes.pop(start, None)
    i += 1

mapping = {35:'kick',36:'kick',38:'snare',40:'snare',42:'hat',44:'hat',46:'hat',49:'crash1',57:'crash2',51:'ride',53:'ride',59:'ride',50:'tom1',48:'tom2',47:'tom3',41:'floor',43:'floor',45:'floor'}
notes, bars = [], []
time, tempo = 0., song.tempo
for index in order:
    header = headers[index]
    bars.append(round(time, 6))
    changes = {}
    for t in song.tracks:
        for v in t.measures[index].voices:
            for b in v.beats:
                change = b.effect.mixTableChange
                if change and change.tempo:
                    changes[b.start - header.start] = change.tempo.value
    points = sorted(changes.items())
    def seconds(tick):
        result, prev, bpm = 0., 0, tempo
        for at, new in points:
            if at > tick: break
            result += (at-prev)/960*60/bpm
            prev, bpm = at, new
        return result+(tick-prev)/960*60/bpm
    for voice in track.measures[index].voices:
        for beat in voice.beats:
            for note in beat.notes:
                if note.value not in mapping or note.type.name == 'tie': continue
                notes.append({'t':round(time+seconds(beat.start-header.start),6),'id':mapping[note.value],'articulation':'open' if note.value == 46 else None})
    time += seconds(header.length)
    if points: tempo = points[-1][1]
notes.sort(key=lambda n:n['t'])
result = {'title':song.title,'duration':round(time,6),'bars':bars,'notes':notes,'source':sys.argv[3] if len(sys.argv)>3 else 'https://gprotab.net/en/tabs/tragically-hip/new-orleans-is-sinking','status':'Community transcription; alignment with studio recording needs verification.'}
with open(sys.argv[2], 'w') as f: json.dump(result,f,separators=(',',':'))
print(json.dumps({'bars':len(bars),'notes':len(notes),'duration':time}))
