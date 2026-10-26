Poke & See is a set of tiny science toys for kids aged 3 to 5, at pokeandsee.com. Each toy is one page about one idea: poke something, see what happens. The grown-up sits beside the kid, so every page has to work for both of them.

## The foundation: respect the kid

Three-year-olds are serious scientists with small hands. Build for their intellect, not their size.

- **Real words.** Say "steam", "molecules", "shadow", "pigment". Never baby talk, never made-up names for real things.
- **Real units and numbers.** Temperatures in °C, counts as numerals, sizes in real units when shown. A kid who can't read yet can still recognise "100".
- **Real colours.** The world looks like the world: oceans are deep blue, leaves are leaf green, deserts are sand. Use the World tokens, never candy primaries, for anything that exists in nature.
- **Real science, simplified but never wrong.** Ice floats. Blue and yellow paint make green. Water molecules are one oxygen and two hydrogens, drawn in the standard CPK colours (`atom-oxygen`, `atom-hydrogen`).
- **No faces on things that don't have faces.** Molecules, clouds and planets don't smile. Animals and people can.
- **No praise bait.** No stars, streaks, confetti or "Great job!". The discovery is the reward.

## House rules for every toy

1. One idea, one big control: a slider, a tap or a drag. Never a menu.
2. No reading needed. Every word that matters is also spoken. On screen, only numbers and one-word labels. The one exception is colour names in Paint Mixer, which may be two words (SKY BLUE, DARK TEAL) so each shade gets its real name.
3. Instant and reversible. Every action shows its result straight away, and every change can be undone (steam condenses back to water).
4. Sound for everything, but calm. Nothing plays before the first touch. The sound button sits in the same corner on every page.
5. No hooks. No ads, accounts, tracking, timers or "keep going" nudges. The toy does its thing and lets the kid walk away.
6. Tablet first, phone second. Targets never smaller than `target-min`.
7. A grown-ups corner on every toy: one sentence of the science and one question to ask the kid.
8. One self-contained page per toy, built from this kit.

## Two layers: Frame and World

Every toy has two layers, and they follow different rules.

**Frame** is the controls and the page around the toy: buttons, chips, the slider, the sound button, readouts. Frame is tactile and identical on every toy. It uses `ink` outlines at `stroke-control`, the `press` ledge shadow, `radius-m` or `radius-l` corners, and only the Frame colours (`paper`, `card`, `ink`, `sun`, `tap`, plus the matter chips `ice`, `water`, `steam`).

**World** is the thing being studied: the glass of water, the globe, the plant, the paint. World is naturalistic. Light comes from the top left. Use the World tokens with soft gradients between neighbouring shades (`ocean-deep` to `ocean-shallow`, `leaf` to `grass`). Edges are optional and quiet: `stroke-object` in a darker shade of the object, or `ink` at 50%. Never put the chunky Frame outline or `press` shadow on a World object. Lifted World objects (a dropped stone, a paint blob) take `float`.

Zoomed-in **diagrams** (the molecule lens, a cut-away seed) sit between the two: draw them on `lens`, with `stroke-diagram` edges and scientific conventions (CPK atom colours, real proportions where you can).

## Colour

- Page ground is always `paper`. Raised Frame surfaces are `card`.
- All text and every control outline is `ink`. Grown-ups' secondary text is `ink-soft`.
- `sun` is the brand. Use it for the logo tile, the hint arrow and at most one highlight per screen. Text on `sun` is `ink`.
- `tap` marks the selected or primary control. Its text is `on-tap`. Don't use `tap` for decoration.
- Matter chips: `ice` (ink text), `water` (`on-water` text), `steam` (ink text, ink edge).
- `focus` is the keyboard focus ring: 4px solid, 4px offset, on every focusable control.
- Paint Mixer uses only the `paint-*` tokens, mixed with pigment maths (spectral.js, MIT licence). Never average RGB: blue and yellow must make green, not grey.
- The globe uses `ocean-deep`, `ocean`, `ocean-shallow`, `shore` for water and `forest`, `leaf`, `grass`, `savanna`, `sand`, `rock`, `snow`, `glacier` for land, chosen by real biome. No political rainbow map. The tapped country lifts and brightens; it doesn't turn a new colour.
- Plants grow through `soil`, `bark`, `leaf`, `grass` and wilt toward `savanna`. Flowers use `petal-red` and `petal-yellow`.
- Skies use `sky-day`, `sky-dusk`, `sky-night` and `star`. Night is never pure black.
- Reserve red-versus-green meaning for nothing. If a toy ever needs good/bad, use shape and sound, not hue.

## Type

Two families, split by who is reading.

- **Andika** (`kid`) for every word or number a kid sees. It's built for early readers: the single-storey "a" and "g" match how kids learn to write them. Use `word-xl` for the announced word, `word-l` for chips and big buttons, `word-m` for quick-jump buttons and tile names, `number-xl` for readouts and `number-s` for scale marks.
- Kid words are single words in capitals (ICE, WATER, STEAM). Three-year-olds learn capital letters first.
- **Syne** (`brand`) for the wordmark and anything for grown-ups: `display` once per page, `title`, `body`, `small`, `label`.
- Always pair a number with its real unit: `100°` on the readout, °C spoken.

## Space, size and shape

- Side gutter is at least `space-4`. Gaps between sibling controls are `space-3`; between toy regions, `space-6`.
- Every tap target is at least `target-min` (64px). Slider knobs are `knob` (72px).
- Corners: `radius-m` on buttons and chips, `radius-l` on panels, tiles and the stage, `radius-pill` on tracks and round buttons.
- Pressable Frame controls carry `press` at rest and `press-down` while pressed, moving down 4px. Nothing else gets a hard shadow.

## Motion

- Frame moves like a toy: a quick spring when a chip appears or a button is pressed (about 300ms, slight overshoot).
- World moves like physics: ice melts gradually, steam rises and fades, a stone accelerates as it sinks. State changes take about a second so kids can watch them happen.
- Under `prefers-reduced-motion`, keep the cause and effect but drop jiggle, shake and drifting particles.

## Sound and voice

- Nothing sounds before the first touch. The sound button (`sound-on` / `sound-off`) sits top right on every toy and remembers its setting.
- Taps are a soft wooden "tok". Sliders tick every few steps, and the pitch rises with the value, so kids can hear "more".
- Each state change has its own signature (a crackle when freezing, drips when melting, a whoosh when boiling), then the word is spoken about half a second later.
- Speak with the device voice at rate 0.85 and normal pitch. Speak the real word ("Steam"), numbers with units ("one hundred degrees"). No squeaky voices, no cheering.
- Keep the mix gentle. Ambient sounds (bubbling, hiss, tinkle) sit well under the spoken word.

## Words for grown-ups

The grown-ups corner and the site copy are written plainly, the way you'd explain it to a friend at the kitchen counter. Short sentences, contractions, no exclamation marks, no jargon left unexplained.

> Heat makes water molecules move faster. At 100°C they move fast enough to break away from each other and float off as steam.
>
> Ask: what happens to a puddle on a hot day?

## Iconography

Use the icons in the Icons group, drawn on a 48px grid with `ink` edges and natural fills. Inline them in toys so they can be recoloured from tokens. Don't use emoji in the interface: they look different on every device and flags don't render on Windows. Use drawn flags on the globe.

## Anatomy of a toy page

Top bar: `home` (left, back to the home page), the readout (centre), `sound-on` (right). A toy that needs undo puts it as an icon-only round button just left of `sound-on` (Paint Mixer). Then the stage, which holds the World. Then the one big control. Then optional quick-jump buttons (at most three). The grown-ups button sits bottom left, small, in `ink-soft`.

## Logos

Use the lockup (`poke-and-see-lockup.svg`) on the home page header and social banners, the stacked version for square spaces and the mark alone for the favicon and app icon. The mark is a poke making ripples: `sun` tile, `ink` rings. Keep clear space of half the mark's width around it. Don't recolour the mark, outline it or set "Poke & See" in another font.
