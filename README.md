# Drum Highway

Browser drum game matching the supplied Drum Highway / Lab screenshot. The original concert-stage artwork is included.

## Run

No build or npm installation is required. Serve the `dist` folder:

```sh
python -m http.server 8080 --directory dist
```

Open http://localhost:8080. Use HTTPS when hosted for Web MIDI. Upload the contents of `dist` to a static host (GitHub Pages or Render static hosting).

## Play

Start groove begins a three-second count-in followed by a 16-bar original groove at 100 BPM. Pause, restart, loop, mute groove audio, or select Practice to stop misses affecting scoring. Score, hit accuracy, streak, elapsed time, and progress update during play.

The full-screen stage surrounds a narrow, centered portrait-style highway with gentle perspective and evenly spaced travel so upcoming notes stay readable. Moving notes use simple glowing discs; strike targets use the actual drum and cymbal artwork from the approved reference. Drum names appear only in Arrange drums; keyboard letters and the separate bottom kick arrow are removed. Kick notes still use the blue cross-highway bars. Connect your USB MIDI kit using Kit Setup.

Kit Setup supports USB MIDI device selection, pad learning, open hi-hat mapping, colors, shapes, names, lane reordering, handedness presets, extra pads, timing offset, and speed. Settings persist in this browser. Existing customized kits retain their settings.

## Songs

Songs lists only bundled playable charts: The Tragically Hip — New Orleans Is Sinking and Michael Jackson — Billie Jean. The embedded YouTube player is the clock for chart playback; buffering and pause stop judging, while seeking resets the score. No YouTube API key is needed for this embedded-player implementation.

These are community transcriptions with unverified recording alignment. This version does not analyze or automatically transcribe YouTube audio. Adjust Chart Timing offers saved offset and tempo corrections. Full-song accuracy and video availability need playback checks. Opening a video separately on YouTube does not synchronize gameplay.

Chart provenance and conversion instructions are in `scripts/README.md`. No song audio is bundled.

## Checks

```sh
node --check dist/app.js
node tests/game.test.cjs
```

Runtime tests cover the default layout, count-in/reset state, chart generation, hit windows, open hi-hat judging, practice mode, and seek handling. Hardware MIDI and live YouTube embedding require browser testing.

## Audio import and automatic timing

Open Songs → Import and automatically align a song. Choose a General MIDI drum chart on channel 10 (.mid/.midi) or a Drum Highway JSON chart, and an original recording, a drumless recording, or both. The included community charts are also available as import choices. This version does not search YouTube, download its audio, remove drums, or transcribe recordings.

Each audio file is decoded locally. A background worker estimates rhythmic attacks, global offset and tempo scaling, then local timing anchors for modest drift. Each playback version has its own alignment. Uploaded recordings and estimates persist in IndexedDB on this browser when storage permits. Removal deletes the imported song. Audio is not uploaded to a server.

A confidence score is a heuristic match-quality indicator, not a calibrated probability or a claim of verified timing. Repetitive patterns, different arrangements, sparse drums, drumless audio and large tempo variation can produce uncertain results. Uncertain imports use practice mode without points. Recorded audio is the gameplay clock; buffering stops judgment, seeking resets the score, and original/drumless switching uses separate timing estimates.

Limits: 80 MB per audio file, 20-minute recordings, 8 MB chart files. Automatic search handles offsets from −15 to +30 seconds and global chart duration scaling from 0.8 to 1.2. MIDI uses its tempo map; generated measure lines assume four quarter notes per bar. General MIDI instrument assignments may require a chart adapted to the kit.

Additional checks:

```sh
node tests/alignment.test.cjs
node tests/import-playback.test.cjs
```

Synthetic fixtures verify offset, tempo differences, modest local drift, ambiguous-phase rejection and silence rejection. Playback tests verify clock behavior, version switching, seeking and practice gating. Real-recording accuracy, browser audio decoding, persistent storage and physical MIDI remain to be checked in the browser.

## Ready-to-play hosted catalog

Songs now starts with a searchable hosted catalog. Every ready entry includes a full mix, drumless mix and sample-aligned chart; players do not need any files or setup. The initial catalog contains four original synthesized practice compositions: River Drive (rock), Midnight Pocket (funk), North Fork Shuffle (blues shuffle), and Backbeat Avenue (pop rock). These are Drum Highway Originals, not recordings of commercial artists. Both mixes are rendered together on the same timeline.

Catalog metadata lives in `dist/catalog/songs.json`; entries specify recording and chart URLs. Adding a prepared song there makes it searchable without changing the player. The generator is `scripts/build-catalog.py`. Catalog playback fetches assets on demand rather than importing them into browser storage. Previously available YouTube community charts remain labeled as timing-unverified and original-only. Personal imports are an optional Advanced section.

A broad catalog of commercial recordings, drumless mixes and drum charts is not connected. Provider credentials and permission to distribute/use the content are required; a karaoke catalog that removes vocals does not establish drumless-track availability. No provider search or content license is represented as configured.

`python tests/catalog.test.py` verifies both recordings' durations and every drum cue against the chart. Playback integration tests verify direct hosted-URL playback and matching timelines in both modes.
