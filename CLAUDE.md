# Poke & See

Tiny science toys for kids aged 3 to 5, at pokeandsee.com. Each toy is one page about one idea: poke something, see what happens. A grown-up sits beside the kid, so every page works for both.

Owner: Kavya. She writes the copy and makes the product calls. Ask her before changing a house rule or the brand.

## Read first

- `docs/brand.md` is the brand book: principles, colour, type, motion, sound, toy anatomy. Follow it exactly.
- `docs/roadmap.md` is the toy list in build order, with notes per toy.
- The live design system (tokens, components with previews, logos, icons) is the Claude artifact "Poke & See": https://claude.ai/artifact/ADDj6DcG6rJ8TA2nX7U2Tv. `kit/` in this repo is generated from it. If the two disagree, ask Kavya which wins.
- `index.html` has two halves: the toy tiles on top (for kids), then the For grown-ups section (the philosophy in Kavya's words). Keep the toys first. When a toy ships, add its tile and its real-world twin.

## The foundation: respect the kid

Build for kids' intellect, not their size. Real words ("steam", "molecules"), real units (°C), real colours (the World tokens), real science (simplified, never wrong). No faces on things that don't have faces. No stars, streaks, confetti or "Great job!".

## House rules (every toy)

1. One idea, one big control: a slider, a tap or a drag. Never a menu.
2. No reading needed. Every word that matters is also spoken. On screen, only numbers and one-word labels (colour names in Paint Mixer may be two words, like SKY BLUE).
3. Instant and reversible. Every action shows its result straight away and can be undone.
4. Sound for everything, but calm. Nothing plays before the first touch. Sound button top right on every toy, remembered.
5. No hooks. No ads, accounts, analytics, cookies, timers or "keep going" nudges.
6. Tablet first, phone second. Tap targets at least `--target-min` (64px).
7. A grown-ups corner on every toy: one sentence of correct science and one "Ask:" question.
8. Home button top left on every toy, back to `/`.

## Tech rules

- Plain static site for GitHub Pages. HTML, CSS and vanilla JS. No framework, no build step, no npm runtime dependencies.
- Every page loads `kit/tokens.css` then `kit/kit.css`. Use token variables and `ps-` classes; never hard-code a colour that has a token.
- Fonts are self-hosted in `kit/fonts/`. No Google Fonts or other third-party requests at runtime (privacy, and it works offline).
- Small vetted libraries are fine when they do real work (d3-geo and world-atlas for the globe, spectral.js for paint mixing). Vendor them into `kit/vendor/` with their licence; don't load from a CDN.
- Each toy lives at `toys/<slug>/index.html` and is self-contained apart from `kit/`.
- Sound: Web Audio, synthesised (no audio files needed so far). Speech: `speechSynthesis`, rate 0.85, normal pitch, en-US, guarded so a missing voice never breaks the toy.
- Wrap every `localStorage` read and write in try/catch.
- Respect `prefers-reduced-motion`: keep cause and effect, drop jiggle and drifting particles.
- Use a native `<input type="range">` for sliders and real `<button>`s for buttons, with visible focus (`--focus`).

## Making a new toy: checklist

1. Re-read the toy's entry in `docs/roadmap.md` and the brand book's Anatomy section.
2. Build the World first with World tokens, lit from the top left. Frame controls come from `kit/kit.css`.
3. Wire sound: tap "tok", value ticks with rising pitch, a signature sound per state change, then the spoken word.
4. Write the grown-ups corner copy and show it to Kavya before shipping.
5. Give the page its own `<title>` and `<meta name="description">` in the same style as `index.html`: a title of about 50 characters that names the toy and says it's for kids aged 3 to 5, and a description of about 155 characters in plain words that says what the kid does and sees, then the promise (no ads, no accounts, no tracking). Show both to Kavya with the grown-ups copy.
6. Test at 1024x768 (tablet landscape), 768x1024 (tablet portrait) and 390x844 (phone). No sideways scroll, nothing under 64px to tap.
7. Add its tile to `index.html` (art in real colours, name in capitals, `data-say` with the spoken name).
8. Update `docs/roadmap.md`.

## Shared code

`kit/kit.js` holds the sound engine, speech helper and sound button (`PS.sound`, `PS.say`, `PS.token`). Toys load it after `kit/kit.css`. Ice, Water, Steam uses it; every new toy should too.

## Deploying

- GitHub Pages from the `main` branch, root folder. `CNAME` already holds `pokeandsee.com`; `.nojekyll` is there so Pages serves files as they are.
- At the domain registrar: A records for `@` to 185.199.108.153, 185.199.109.153, 185.199.110.153 and 185.199.111.153; a CNAME for `www` to `<github-username>.github.io`. Then tick "Enforce HTTPS" in the repo's Pages settings once the certificate is issued.
