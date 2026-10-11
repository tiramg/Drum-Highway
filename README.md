# Drum Highway

A browser-based rhythm game for electronic MIDI drum kits, with customizable lanes and drum symbols.

## Run locally

Serve the `dist` directory over HTTP:

```sh
python -m http.server 8080 --directory dist
```

Open http://localhost:8080. MIDI support depends on the browser; Chrome or Edge is recommended for MIDI kit testing.

## Current features

- MIDI pad learning, lane order, colors, shapes, and open hi-hat mapping.
- Built-in practice groove, keyboard controls, scoring, and timing offset.
- Drum chart library with New Orleans Is Sinking and Billie Jean.
- YouTube playback clock drives chart position, including pauses, buffering, and seeking.

## Work remaining

The two community charts are timing tests. Their note accuracy and alignment with the complete recordings have not been verified. Automatic audio-to-chart alignment is not implemented; the prototype still contains manual chart alignment controls. The intended finished experience is select a song and play, without per-playthrough calibration.

See `scripts/README.md` for chart sources and conversion details. No audio or API credentials are included.
