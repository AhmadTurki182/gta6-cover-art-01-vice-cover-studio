# Vice Cover Studio — GTA 6-style cover art maker

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/AhmadTurki182/gta6-cover-art-01-vice-cover-studio/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/AhmadTurki182/gta6-cover-art-01-vice-cover-studio/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

Turn any photo and a caption into cover art in the style of GTA 6's posters —
the multi-panel poster look with bold lettering and a Vice City sunset or neon
colour grade — and export it as a PNG to share. It runs offline in a desktop
browser from its own static files: the photos never leave the machine.

## How it works

1. **Add photos** — drop in 1–4 of your own photos (two model-made demo photos
   are included so you can try it instantly). Nothing is uploaded.
2. **Pick a layout** — 2 × 2 Grid, Hero + Strip, 3-Panel Vertical, or Duo Split.
3. **Grade it Vice** — Sunset, Neon Nights, Noir, or Vice Pastel, with a
   strength slider, film grain and vignette.
4. **Place each photo** — click a panel to select it, drag to pan, zoom, rotate
   or flip, swap the photo per panel.
5. **Write the caption** — big bold title, tagline and credit line, title at
   the top or bottom, poster border on or off.
6. **Export PNG** — one click, in 1080 × 1080, 1080 × 1350 or 1920 × 1080.

## Try it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network requests, no external fonts — everything is a file
under `app/`.

## Original artwork

Everything in this entry is original: no Rockstar Games logo, official
artwork or fonts. The two demo photos under `app/samples/` were made with an
image model for make.fun and are free to use.

## Entry

Built for the [make.fun gta6-cover-art-01 bounty](https://make.fun/bounty/gta6-cover-art-01).
`main.ts` hands the app in by copying `app/` and `screenshots/` to `/output`
and writing `/output/dossier.json` with the vendored make.fun library.
