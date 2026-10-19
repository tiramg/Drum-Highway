# Imported drum charts

`dist/charts/new-orleans.json` contains a community transcription of The Tragically Hip's New Orleans Is Sinking, downloaded through the public Guitar Pro download at https://gprotab.net/en/tabs/tragically-hip/new-orleans-is-sinking?download on October 11, 2026. The percussion track is named Johnny Fay.

Convert a local copy of that GP4 score with Python and PyGuitarPro:

```sh
python scripts/convert-gp.py /path/to/new-orleans.gp dist/charts/new-orleans.json
```

The converter expands repeats and alternate endings and applies the score's tempo change. The result contains 115 measures, 1,554 drum onsets, and a 254.22665-second timeline. No audio is bundled. Playback uses the official artist channel's studio recording at https://www.youtube.com/watch?v=zym7LpW9BtU.

This chart is available as a timing test, not a verified transcription of that recording. Chart-to-recording alignment and individual notes need listening checks. User alignment corrections are browser-local. A chart matches only the exact configured video ID; the library lists only playable drum charts. Song selection does not transcribe YouTube audio. Songsterr listings alone are not used as chart data.

The player clock drives chart time; paused and buffering states stop judging, seeks reset scoring and skip earlier notes, and returning to practice restores the original groove. YouTube playback still depends on embed availability, network, and browser autoplay settings.

## Billie Jean

`dist/charts/billie-jean.json` imports the Drums track from the community Guitar Pro score downloaded at https://www.gitagram.com/tabfile/Michael%20Jackson%20-%20Billie%20Jean.gp5. Source page: https://www.gitagram.com/sheet-music/drum/billie-jean-drum-score/. The separate Percussions track is not included because this chart targets the drum kit. The score contains 145 measures at 118 BPM, 1,748 mapped drum notes, and a 294.915254-second timeline. Playback uses https://www.youtube.com/watch?v=OZGtRvYF-A4. Timing and transcription accuracy remain unverified against the full recording.

The library contains chart search only. The API entry form and YouTube search UI have been removed; any previously saved browser key is retained.
