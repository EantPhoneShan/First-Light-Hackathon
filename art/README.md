# First Light art

The game already has a full set of built-in vector art (`public/assets/svg/`, made by `art/make_svgs.py`).
Any ChatGPT image you process replaces the built-in art for that item. Nothing else needs changing.

## Swap in a ChatGPT image

1. Paste the **style prompt** below, then the item's prompt, into ChatGPT. Ask for a square PNG with a transparent background.
2. Save the PNG as `art/raw/<name>.png`, using the name in the tables (for example `art/raw/part-bus-6u.png`).
3. Run `npm run art`. It trims the edges, resizes and converts to WebP in `public/assets/`, and updates the manifest.
4. If the background isn't transparent, remove it first (remove.bg, or `rembg i in.png out.png`).

Built-in SVG art is original and needs no credit. Record the prompts you actually used in the "Used" column for the judges.

## Style prompt (start every request with it)

> Flat vector game illustration, clean shapes, soft cel shading, 3/4 view, navy and white with orange accents, transparent background, no text, no logos, centred on the canvas.

## Parts (256 px)

| Name | Prompt after the style prompt | Used |
|---|---|---|
| part-bus-3u | A 3U CubeSat frame: a tall white aluminium box made of three stacked 10 cm cubes, orange corner rails. | |
| part-bus-6u | A 6U CubeSat frame: a white aluminium box two cubes wide and three tall, orange corner rails. | |
| part-bus-12u | A 12U CubeSat frame: a chunky white aluminium box two by two cubes and three tall, orange corner rails. | |
| part-solar-body | A small cube covered in blue solar cells on every face, thin navy frame. | |
| part-solar-wings | A small white satellite body with two long deployable blue solar panels unfolded to each side, orange hinges. | |
| part-battery-small | A small navy battery pack with an orange terminal and a yellow lightning bolt on the side. | |
| part-battery-large | A double navy battery pack, two cells side by side, orange terminals, yellow lightning bolt. | |
| part-radio-uhf | A small white radio box with four thin whip antennas sticking out diagonally. | |
| part-radio-s | A small white radio box with a flat gold square patch antenna on top. | |
| part-radio-x | A small white radio box with a tilted white dish antenna on a short mast, orange feed tip. | |
| part-computer-std | A small green circuit board with black chips and gold connector pins. | |
| part-magnetorquer | Three copper-orange coil rods on a navy plate, one along each axis. | |
| part-cold-gas | A silver spherical gas tank on a navy plate with a small dark thruster nozzle. | |
| part-camera | A white cube camera with a large dark blue lens on the front. | |
| part-thermal-imager | A navy cube camera with a lens glowing orange and red like a heat map. | |

## Rockets (512 px tall, generic, no real rockets or logos)

| Name | Prompt | Used |
|---|---|---|
| rocket-rideshare | A small white two-stage rocket, side view, standing upright, one small orange band. | |
| rocket-small | A slim white two-stage rocket, side view, upright, navy fins, orange band. | |
| rocket-medium | A medium white rocket, side view, upright, larger fairing, navy fins, orange band. | |
| rocket-heavy | A heavy white rocket with two side boosters, side view, upright, navy fins. | |
| rocket-super | A very tall white super-heavy rocket with two side boosters, side view, upright. | |

## Role avatars (256 px)

| Name | Prompt | Used |
|---|---|---|
| role-planner | An astronaut helmet portrait with a dark visor, orange suit trim, a small clipboard badge. Navy circle background. | |
| role-engineer | An astronaut helmet portrait with a dark visor, yellow suit trim, a small wrench badge. Navy circle background. | |
| role-science | An astronaut helmet portrait with a dark visor, green suit trim, a small flask badge. Navy circle background. | |
| role-flight | An astronaut helmet portrait with a dark visor, blue suit trim, a small antenna badge. Navy circle background. | |

## Scenes

| Name | Size | Prompt | Used |
|---|---|---|---|
| scene-title | 1024 px wide | A small CubeSat with unfolded blue solar wings flying above the curved blue limb of Earth, the Sun glowing top right, stars. Wide 2:1 image, dark navy space background (not transparent). | |
| scene-ground-dish | 256 px | A white ground station dish antenna on a tripod, pointing up to the right, orange feed tip. | |

## Not made yet

- **Event cards** (5, `event-*.png`, 512 px): waiting for Member 1's `events.ts` (P1).
- **Instrument extras**: the brief lists 6 instruments, but the parts list has 2 so far. Add rows when Member 1's `parts.json` lands.
- **Earth texture**: the simulation draws Earth in code. If we switch to NASA's Blue Marble image, credit "NASA Earth Observatory" on the title screen.
