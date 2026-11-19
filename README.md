# Vice Cover Studio

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/AhmadTurki182/gta6-cover-art-01-vice-cover-studio/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/AhmadTurki182/gta6-cover-art-01-vice-cover-studio/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

Turn your photos + a caption into multi-panel Vice City sunset cover art, in the style of GTA 6 posters — and export it as a PNG to share. Fully offline: photos never leave your machine.

## How it works

1. **Add photos** — upload 1–4 of your own photos (demo photos are loaded for you to start).
2. **Pick a layout** — 2×2 Grid, Hero + Strip, 3-Panel Vertical, or Duo Split.
3. **Place each panel** — click a panel, then drag on the preview to pan, use the zoom slider, rotate, flip, or swap the photo in that panel.
4. **Grade it Vice** — Sunset, Neon Nights, Noir, or Vice Pastel, with a strength slider.
5. **Write the caption** — big bold title, tagline, and byline, on top or at the bottom.
6. **Export** — one click downloads a PNG at 1080 × 1080, 1080 × 1350, or 1920 × 1080.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network requests, no libraries. The app is plain static files under `app/` — `index.html`, `app.js`, `style.css`, plus two model-made demo photos in `app/samples/` (free to use, supplied by the kit).

## Originality

Original design and lettering using system fonts only. No Rockstar Games logo, wordmark, official artwork, character, or font.

## Entry program

`main.ts` (Node 22, standard library only) copies `app/` and `screenshots/` to `/output` (or `$MAKEFUN_OUTPUT_DIR`) and writes `dossier.json` with the kit's vendored `vendor/makefun-app.ts`.
