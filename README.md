# ASCII-timer

ASCII timer app with glow effects. A focus timer drawn in glowing ASCII on a black screen.

The clock is a 5×7 pixel font built from monospace characters. When a digit
changes, only the pixels that differ animate: they heat up through a character
ramp (` .:-=+*#%@`), flash white-hot, then settle into their phosphor color.
Labels change with a decode scramble. Lit pixels shimmer slightly while idle.

No frameworks, no build step, no tracking. About 40 KB of plain HTML, CSS and JS.

## Run it

Open `index.html` in a browser. That's all you need.

To install it as an app (its own window, works offline), serve the folder over HTTP:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. In Chrome or Edge, click the install icon in the address bar.
In Safari on iOS, use Share → Add to Home Screen.

It also works as-is on GitHub Pages: Settings → Pages → deploy from the `main` branch.

## Features

- focus / short break / long break cycle, with a long break every N sessions
- auto-start breaks and/or focus
- synthesized bell chime (WebAudio, no audio files), optional ticking
- desktop notifications when a session ends in a background tab
- keeps time accurately in background tabs (worker timer), and resumes after a reload
- task name per session, plus a log with 7-day bars, totals and a streak
- 5 phosphor colors: amber, green, ice, white, rose
- 4 glyph styles: ascii, block, shade, binary
- optional scanlines and vignette, and a UI that fades out while you work
- respects `prefers-reduced-motion`

All data stays in your browser's localStorage.

## Keys

| key | action |
| --- | --- |
| `space` | start / pause (or click the clock) |
| `r` | reset |
| `n` | skip to next phase |
| `↑` `↓` | ±1 minute (shift: ±5); scrolling on the clock also works |
| `1` `2` `3` | focus / short break / long break |
| `t` | edit task |
| `c` | cycle color |
| `g` | cycle glyphs |
| `m` | mute |
| `f` | fullscreen |
| `s` | settings (arrows to navigate) |
| `l` | log |
| `?` | help |

## Files

```
index.html          markup and overlays
css/style.css       themes, glow, crt
js/font.js          5x7 bitmap digits
js/clock.js         ascii renderer + transitions + text scramble
js/sound.js         webaudio chime / tick
js/store.js         localStorage wrapper
js/app.js           timer, settings, log, keys
sw.js               offline cache
```
