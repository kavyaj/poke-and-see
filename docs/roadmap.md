# Roadmap

Toys in build order. Every toy follows the house rules and the brand book.

## 1. Ice, Water, Steam (live, kit pass done)

Slide the temperature from −20° to 120°. Ice melts and floats, water boils, steam rises. A magnifier zooms in on the molecules.

Kit pass (done 23 October 2026):
- Switch fonts and colours to `kit/tokens.css` and `kit/kit.css` (it still uses Baloo 2 and its own palette).
- Redraw the molecules as real water (one `--atom-oxygen`, two `--atom-hydrogen`, see the Molecule component). Remove the faces.
- Add the Home button (top left) and the grown-ups corner:
  "Heat makes water molecules move faster. At 0°C they let go of each other and ice melts. At 100°C they move fast enough to fly apart as steam." Ask: "What happens to a puddle on a hot day?"
- Move the sound and speech code into `kit/kit.js`.

## 2. Paint Mixer (built 23 October 2026, grown-ups copy waiting for Kavya)

Squish two paint blobs together. A new colour appears and its name is spoken.

- Pigments: `--paint-red`, `--paint-yellow`, `--paint-blue`, `--paint-pink`, `--paint-white`, `--paint-black`.
- Mix with spectral.js (MIT) so blue + yellow makes a real green. Never average RGB.
- Name the result with a small fixed list of colour words a 3-year-old knows (green, orange, purple, brown, pink, grey, light blue...), picked by nearest colour.
- Reversible: a "clean the palette" button, and blobs can be pulled apart again.

As built:
- The six pigments sit in wells along the top and never run out: one row on tablets, two rows of three on phones (red, yellow, blue on top) so every well stays at least 64px to tap. Drag from a well and a dollop stretches out on a string of goo, then snaps free.
- Drop paint onto paint (anywhere the goo reaches across) and they squish together. The old colours swirl and settle into the mix, then it's spoken: "Blue and yellow make green."
- Paint is mixed by amount, so a big white blob with a little blue makes light blue. Blobs grow as they mix, up to six dollops.
- Pulling apart: drag from a mixed blob to pull off one dollop. It keeps the mixed colour, because real paint doesn't unmix. A pure dollop dropped back on its own well goes back in. CLEAN wipes the palette.
- UNDO (a round icon button in the top bar, just left of the sound button) takes back the last change of paint: a mix, a dollop pulled off, paint put back in a well, or CLEAN (up to 40 steps). Moving a blob isn't a step. Paint that didn't change stays put; the rest fades back to how it was. On phones the colour swatch beside the name is hidden to make room, and long names shrink to fit.
- Tap any blob to hear its colour. The top bar shows the last colour word with a swatch; tap it to hear it again.
- Colour names: 127 shades, everyday names (MINT, JADE, WATERMELON, BLACKBERRY) and colour plus a shade word (LIGHT BLUE, DARK TEAL, DUSTY ROSE), up to two words. Each shade is pinned to a real mix of the six paints, and a mix takes the name of the nearest one. The list was built by grouping all 806 mixes of up to six dollops into look-alike shades and naming each group, then checked by eye. Long single words shrink to fit the top bar on a phone.
- Real results worth knowing: blue + green makes teal, red + blue makes a dark plum (cadmium red and ultramarine can't make a bright purple), pink + blue makes a real purple, yellow + black makes olive, red + green makes brown.
- Pink (`--paint-pink`, #E5338C) was added on 23 October 2026 as the sixth paint so purple can be made. Picked from twelve deep pinks for the most colourful purple with blue, and lighter than red so the two are easy to tell apart.
- spectral.js 3.0.0 is vendored in `kit/vendor/spectral/` with its licence.

## 3. Sun and Shadow (next)

Drag the sun across the sky. A tree's shadow stretches, shrinks and flips sides. Drag it below the horizon and it's night (`--sky-night`, `--star`).

## 4. Float or Sink

Drop a rock, a leaf, an apple, a coin or a sponge into a tub of water. Plop or bloop. Objects behave by real density (the apple floats).

## 5. Grow a Seed

Slide water and sun. The seed sprouts, grows leaves, flowers. Too little or too much water and it droops toward `--savanna`, then recovers when fixed.

- Several plants: sunflower, tomato, bean (Kavya's family grows different plants; pick the real ones they grow).
- Realistic, not cartoon: real leaf shapes per plant, real growth order (roots first).

## 6. World Globe

Spin the Earth with a finger. Tap a country: it lifts and brightens, its flag pops up big, and its name is spoken.

- Realistic Earth: biome colours from the World tokens, oceans in three depths, polar ice. No political rainbow map.
- No Home button. On load, turn the globe to the longitude matching the device's time zone (UTC offset × 15°), without picking a country.
- Bigger invisible tap zones for small countries.
- Drawn flags (an SVG flag set with a clear licence), never emoji.
- Optional later: one animal per country, or "hello" in a local language.

## Later

- Weather Dial: mix sun and rain until a rainbow appears.
- Big and Small: pinch to zoom from an ant to a whale.
- Water Xylophone: fill bottles to different levels, tap to hear the pitch change.
- Moon Tonight: slide through the month and watch the moon change shape.
