# Motion format (v1)

How to author the animated 3D model of one exercise. One JSON file per exercise:
`motions/<slug>.json`. The app plays it in the exercise screen's **Animation** section
(js/motion/player.js), and `scripts/validate-motions.mjs` checks it.

You can author a file from this document alone. The code that implements it is
`js/motion/skeleton.js` (sizes, channels, names), `js/motion/pose.js` (evaluation) and
`js/motion/validate.js` (rules). If this doc and the code disagree, the code wins:
report the mismatch.

## Workflow

1. Find the exact exercise name in `js/seed.js` (`STARTER[].name`), e.g. `"Squat (Barbell)"`.
   The file name is its slug: lowercase, every run of non-letters/digits becomes `-`
   (`Triceps Pushdown (Cable - Straight Bar)` → `triceps-pushdown-cable-straight-bar.json`).
2. Read the exercise's cues in `js/seed.js`. The **Common mistakes** lines become your
   `mistakes`, and the setup/execution cues become your `checks`.
3. Copy the worked example at the end, change it, then run
   `node scripts/validate-motions.mjs` until it prints `ok`. It also regenerates
   `motions/index.json`; commit that too.
4. Render contact sheets and **look at them**:
   `node scripts/contact-sheet.mjs <slug>` writes `contact-sheets/<slug>-<variant>.png`
   (correct + one per mistake; 8 frames; side and front rows). Use
   `--views side,45,front` or `--query 't=0,0.5&w=420&h=520'` for close-ups; a view can
   also be a number (camera azimuth in degrees, e.g. `-120`).
5. Iterate until the pose looks like the photos and the cues. The validator only proves
   the file is consistent, not that the movement is right.

Node: `/tmp/nodedl/node-v22.11.0-linux-x64/bin/node` on the dev box. The contact sheet
needs Playwright with Chromium (`PLAYWRIGHT=/path/to/node_modules/playwright`, default
`/tmp/smoke/node_modules/playwright`); it starts its own `python3 -m http.server`.

## Coordinates and units

- Metres and degrees.
- World: **Y up, the person faces +Z, the person's left is +X**, floor at `y = 0`.
- Side view = camera on the person's right (−X), so a person facing +Z faces screen-right.
- Every rep loops: the pose at `t = 1` should equal the pose at `t = 0`.

## The mannequin

A ~1.75 m low-poly mannequin. Segment lengths are fixed (bones never stretch):

| Segment | From → to | Length |
|---|---|---|
| pelvis | root (midpoint of the hip joints) → hip joints at x = ±0.09; base of the spine (`l5`) 0.10 up, 0.03 back | — |
| lumbar | `l5` → `t12` | 0.20 |
| thorax | `t12` → `c7` (base of the neck) | 0.26 |
| neck + head | `c7` → head joint; head centre 0.06 above it | 0.10 |
| upperArm | shoulder → elbow | 0.30 |
| forearm | elbow → wrist | 0.255 |
| hand | wrist → centre of the closed hand (`grip`) | 0.08 |
| thigh | hip → knee | 0.429 |
| shin | knee → ankle | 0.43 |
| foot | ankle is 0.068 above the sole; heel 0.065 behind, ball 0.14 and toe 0.195 ahead of the ankle | — |

Shoulder joints sit at x = ±0.18, 0.21 above `t12` and 0.04 in front of the spine line.
They move with the shoulder blades (`scapElev`, `scapProt`).

Standing with everything at 0 and `rootY = 0.927`: ankles 0.068, knees ~0.50, hips 0.927,
shoulders 1.437, `c7` 1.487, head centre ~1.65, top of the head ~1.75.

Zero pose for every joint: **standing straight, arms hanging at the sides with palms
facing the thighs (thumbs forward), feet pointing forward.**

## Channels (what keyframes animate)

All channels are numbers. Unset channels use the default (0, except `rootY` = 0.927).

### Root and spine

| Channel | Meaning (+ direction) | Range |
|---|---|---|
| `rootX`, `rootY`, `rootZ` | position of the root (midpoint between the hip joints), metres | ±3, −0.5..3, ±3 |
| `rootPitch` | whole body tips **forward** about the hip axis (the hip-hinge angle of the pelvis) | ±180 |
| `rootYaw` | body turns to its **left** | ±180 |
| `rootRoll` | body tilts to its **left** | ±90 |
| `lumbarFlex` / `thoracicFlex` | spine bends **forward** (rounding); negative = arching | −30..50 / −25..45 |
| `lumbarSide` / `thoracicSide` | side bend to the **left** | ±30 / ±20 |
| `lumbarTwist` / `thoracicTwist` | twist so the chest turns **left** | ±30 / ±35 |
| `neckFlex`, `neckSide`, `neckTwist` | head: chin to chest / to the left / turn left | ±60, ±40, ±70 |

Rotation order: root = yaw · pitch · roll; each spine joint = flex · side · twist.
Trunk lean from vertical = `rootPitch + lumbarFlex + thoracicFlex` (when yaw/roll are 0).
Use **`rootPitch` for a hip hinge** and keep `lumbarFlex` near 0 for a neutral back;
`lumbarFlex` is what "back rounding" means.

Common root placements (then check the contact sheet):

- Standing: `rootY` 0.90–0.927 (lower = knees softer).
- Sitting upright on a seat whose top is at height *h*: `rootY ≈ h + 0.09` (the `seat`
  landmark, the sit bones, is 0.09 below the root), `hipFlex ≈ 90` on both legs.
- Lying on the back on a pad whose top is at *h*: `rootPitch: -90`, `rootY ≈ h + 0.13`,
  head toward −Z, `neckFlex ≈ 10` so the head rests on the pad.
- Lying face down: `rootPitch: 90`, head toward +Z.

### Arms and legs (sided)

Sided channels take a suffix: `kneeFlexL`, `kneeFlexR`. **Without a suffix the value is
used for both sides** (`"kneeFlex": 90`). If a keyframe has both, the suffixed key wins
for that side. Signs are anatomical, so the same number is mirror-symmetric on both sides
(abduction is always "away from the midline", external rotation is always "outward").

| Channel | Meaning (+ direction) | Range |
|---|---|---|
| `scapElev` | shoulder blade up (shrug) | −10..40 |
| `scapProt` | shoulder blade forward (round the shoulders); − = retract/pinch | −25..30 |
| `shFlex` | arm forward and up (90 = straight ahead, 180 = overhead); − = arm back | −60..180 |
| `shAbd` | arm out to the side (90 = horizontal) | −30..180 |
| `shRot` | external rotation of the upper arm (forearm turns outward/up) | ±90 |
| `elbowFlex` | elbow bend | 0..150 |
| `forearmPro` | pronation (palm turns back/down); − = supination | ±90 |
| `wristFlex` | wrist bends toward the palm | −70..80 |
| `hipFlex` | thigh forward and up (90 = thigh horizontal); − = extension | −30..135 |
| `hipAbd` | thigh out to the side | −30..60 |
| `hipRot` | external rotation (knee and toes turn out) | −45..50 |
| `kneeFlex` | knee bend (shin goes back) | 0..155 |
| `ankleFlex` | dorsiflexion (toes up toward the shin); − = point the toes | −50..45 |
| `ankleInv` | inversion (sole turns inward) | −25..35 |
| `heelRaise` | **planted feet only**: heel up, pivoting about the ball of the foot | 0..60 |
| `kneeOut` | **planted feet only**: knee bend direction turned outward (−: knees cave in) | ±45 |
| `elbowOut` | **gripping hands only**: elbow bend direction turned outward/up (flare) | ±60 |

Rotation order (forward kinematics, each in its parent frame): shoulder and hip =
flex · abd · rot; then elbow/knee bend; then forearm pronation / ankle.
Examples: arm straight ahead `shFlex 90`; arms overhead `shFlex 180`; overhead-press
bottom (elbows out, forearms vertical) `shAbd 85, shRot 90, elbowFlex 90`; seated
`hipFlex 90, kneeFlex 90`; seated with knees apart (hip abductor machine) add `hipAbd 25`.

### Prop channels

`"<propId>.x|y|z"` (metres) and `"<propId>.pitch|yaw|roll"` (degrees) are added to a
prop's placement, e.g. `"bar.y": -0.3` lowers the bar 30 cm.

## Contacts: planted feet and gripping hands (IK)

Limbs listed in `contacts` are solved by inverse kinematics instead of from their joint
channels (which are then ignored; the validator warns). This keeps feet planted and hands
on the bar while the body moves, and is how most exercises should be written.

```json
"contacts": {
  "feet":  { "at": [0.17, 0, 0], "toeOut": 20 },
  "hands": { "at": "bar.grip", "elbowPole": [0.25, -1, -0.45] }
}
```

- `feet` / `hands` set both sides; `footL`, `footR`, `handL`, `handR` set one side and win
  over the shorthand.
- `at` is a world point `[x, y, z]` or a prop point `"<propId>.<point>"`.
  - In the shorthand a world point is given for the **left** side; the right gets x mirrored.
    A prop point gets `L`/`R` appended: `"bar.grip"` → `bar.gripL` / `bar.gripR`.
- **Feet**: `at` is the point on the surface directly under the ankle (sole level), i.e.
  the floor (`y = 0`) or a prop point (e.g. a platform; the foot then takes the prop's
  orientation). `toeOut` turns the toes outward (degrees, −30..60).
  Knees bend toward the toes; `kneeOut` turns that direction; `heelRaise` lifts the heel.
- **Hands**: `at` is the centre of the closed hand. `elbowPole` is the direction the elbow
  should point, in the **chest (thorax) frame, left-side convention**: x = outward, y = up
  (toward the head), z = forward (out of the chest). The right side is mirrored for you.
  Defaults to `[0.3, -1, -0.3]` (down, a little out and back). Examples: squat `[0.25, -1, -0.45]`;
  bench press `[0.5, -0.3, -1]` (lying: elbows toward the floor and the feet);
  pull-up / pulldown `[0.6, -1, 0]`.
- The limb can't stretch. If the target is out of reach the validator fails with
  "misses its contact by N cm": move the root or the target. Legs are 0.859 long
  hip-to-ankle; arms reach 0.635 from shoulder to grip.
- A prop that a contact grips must not itself be attached to the hands/limbs (cycle).

## Props

Each prop: `{ "id": "bar", "type": "...", ...params, placement }`. Ids are words
(`[A-Za-z][\w-]*`). Colors are fixed; a prop turns green/amber/red when a check lists its
id in `parts`.

Placement (exactly one, except cables):

- `"pos": [x, y, z]` (+ optional `"rot": [pitch, yaw, roll]`): fixed in the world, moved
  by prop channels.
- `"attach": { "to": <segment>, "offset": [x, y, z], ... }`: rides on a body segment;
  `offset` is in that segment's frame (origin at its upper joint; trunk segments point
  +Y, limbs point −Y, z = the front of the body). `to` can be any part name (below) or:
  - `"handL"` / `"handR"`: origin at the centre of that closed hand, oriented with the hand;
  - `"hands"`: midpoint between both hands, x axis from the right hand to the left.
  - Example: bar on a high-bar squat's upper back: `{ "to": "thorax", "offset": [0, 0.235, -0.05] }`.

| type | params (defaults) | shape | points (for `at` / measures) |
|---|---|---|---|
| `barbell` | `grip` 0.6 (distance between hands), `length` 2.2, `plates` true, `plateRadius` 0.225 | bar along local x, plates drawn see-through | `center`, `gripL` (+x), `gripR` |
| `rod` | `grip` 0.6, `length` 1.2, `radius` 0.016 | bar along x (pull-up bar, lat bar, cable bar) | `center`, `gripL`, `gripR` |
| `dumbbell` | `headRadius` 0.055 | handle along local z (= the hand's grip axis) | `center`, `grip` |
| `handle` | `width` 0.15, `neutral` false | D-handle along x; `neutral: true` = two vertical grips (V-handle) | `center`, `grip`, `gripL`, `gripR` |
| `rope` | — | two strands hanging 0.3 below the attach point | `center`, `gripL`, `gripR` |
| `bench` | `height` 0.43 (pad top), `length` 1.2, `width` 0.28, `incline` 0 (deg), `backLength` 0.8 | flat pad along z centred on `pos` (on the floor); with `incline`, a 0.4 seat toward +z from `pos` and a back pad rising toward −z | Flat (`incline` omitted or 0): `center`, `top`, `head` (−z end), `foot` (+z end). Inclined (nonzero `incline`): `center` (hinge), `top` (seat center), `backTop` (raised end). |
| `box` | `size` [0.4, 0.4, 0.4] | box centred on `pos`: machine seats, pads, platforms, frames | `center`, `top` |
| `roller` | `length` 0.35, `radius` 0.05 | foam roller pad along x (leg extension/curl pads) | `center` |
| `cable` | `from` [x, y, z] (pulley), `to` "<propId>.<point>" | line from the pulley to a handle/bar/rope | — |

Physical dimensions must be positive. A bar or rod can put both named grip points
at its center with `grip: 0`.

A dumbbell in the hand: `{ "id": "dbL", "type": "dumbbell", "attach": { "to": "handL" } }`.
A leg-extension pad on the shins: `{ "id": "pad", "type": "roller", "attach": { "to": "shinL", "offset": [-0.09, -0.36, 0.07] } }`.

## Keyframes

```json
"keyframes": [
  { "t": 0,    "rootY": 0.92, "rootPitch": 9 },
  { "t": 0.48, "rootY": 0.37, "rootPitch": 28 },
  { "t": 1,    "rootY": 0.92, "rootPitch": 9 }
]
```

- `t` is normalised time 0..1 of one rep (`durationMs` long at 1×, 800–15000 ms).
  First keyframe at 0, last at 1, strictly increasing.
- **Set every channel you animate in the first and the last keyframe** (the validator
  warns otherwise), and make them equal so the loop doesn't jump. Between, give a channel
  only where it matters; it interpolates between the keyframes that have it.
- Interpolation per channel is a smooth monotone cubic: it passes through every keyed
  value, never overshoots, and slows to a stop at t = 0, t = 1 and at every peak.
  A hold is two keyframes with the same values. Optional `"ease"` on a keyframe changes
  the segment that ends at it: `"linear"`, or `"easeInOut"` (stop at both ends).
- Typical rep: 4–8 keyframes (start, mid-way, bottom, bottom hold, mid-way, top).

## Phases

```json
"phases": [
  { "name": "Descent", "start": 0, "end": 0.46 },
  { "name": "Bottom", "start": 0.46, "end": 0.56 },
  { "name": "Ascent", "start": 0.56, "end": 1 }
]
```

Contiguous, covering 0..1 (each `start` equals the previous `end`), unique names. Shown
as the phase label in the player; checks can be limited to phases.

## Checks

Checks color the body and fill the ✓ / ⚠ / ✕ list. They are evaluated on every frame from
the computed pose (so they work for IK limbs and for mistakes):

```json
{ "id": "depth", "label": "Hip crease below the knee",
  "measure": { "delta": ["hip", "knee"], "axis": "y" }, "max": 0, "tol": 0.04,
  "phases": ["Bottom"], "parts": ["thighs", "pelvis"] }
```

- Status: value within `[min, max]` → **good** (green ✓); outside by at most `tol` →
  **warn** (amber ⚠); further → **bad** (red ✕). Give `min`, `max` or both; `tol` ≥ 0
  (default 0). Outside its `phases` (default: all) a check is **off** and colors nothing.
- `parts`: what turns green/amber/red. Body parts: `pelvis lumbar thorax neck head
  upperArmL forearmL handL upperArmR forearmR handR thighL shinL footL thighR shinR footR`.
  Groups: `back` (lumbar, thorax), `spine` (+neck), `trunk` (pelvis, lumbar, thorax),
  `armL armR arms legL legR legs upperArms forearms hands thighs shins feet`, `knees`
  (thighs + shins). Or a prop id. A part shows the worst status of the active checks on it;
  parts no check covers stay grey.
- `"sides": true` with a sided measure checks L and R; the worse one counts.

**Named measures** (degrees):

| Measure | Meaning |
|---|---|
| `trunkLean` | chest (thorax) axis from vertical, + = leaning forward |
| `pelvisTilt` | pelvis axis from vertical, + forward |
| `lumbarFlex`, `thoracicFlex`, `spineFlex` (sum), `neckFlex` | the spine channels (back rounding) |
| `hipFlex·` / `shFlex·` | thigh / upper arm angle in the side view relative to pelvis / chest (90 = horizontal forward when upright) |
| `hipAbd·` / `shAbd·` | thigh / upper arm angle out of the side plane (e.g. elbow flare) |
| `kneeFlex·`, `elbowFlex·` | joint bend (0 = straight) |
| `ankleFlex·` | dorsiflexion, shin vs foot |
| `shinLean·` | shin from vertical, + = knee forward |
| `kneeTrack·` | knee bend direction vs the toes, + = knee outside the toes, − = caving in; 0 while the leg is nearly straight |
| `heelRaise·` | foot angle, + = heel up |

`·` = add `L`/`R`, or use `"sides": true` without a suffix.

**Delta measures** (metres): `{ "delta": [a, b], "axis": "x" | "y" | "z" | "dist" }` =
`a − b` along that world axis, or the distance. Points: `root seat l5 t12 c7 head
upperBack`, sided `hip knee ankle heel midfoot ball toe shoulder elbow wrist grip` (with
`L`/`R`, or without for the midpoint of both sides), prop ids (`"bar"` = its centre) and
prop points (`"bar.gripL"`). Example: bar over mid-foot = `{ "delta": ["bar", "midfoot"], "axis": "z" }`, `min -0.05, max 0.05`.

Rules the validator enforces: on the correct rep **every active check is green on every
frame** (30 fps), not just at keyframes. Leave margin: tune bands from real technique,
not just from your keyframes.

## Mistakes

```json
{ "id": "knees-cave", "label": "Knees caving in", "cue": "Push the knees out over the toes",
  "fails": ["knees"],
  "delta": [
    { "t": 0.3, "kneeOut": -6 },
    { "t": 0.5, "kneeOut": -20 },
    { "t": 0.66, "kneeOut": -30 },
    { "t": 0.86, "kneeOut": -10 }
  ] }
```

- A mistake is the correct rep **plus** `delta` (same channel names, added to the
  correct values). `label` is the chip text, `cue` the fix shown under it. Take both from
  the exercise's "Common mistakes" lines in `js/seed.js` so the text and the animation
  agree.
- Deltas are 0 at t = 0 and t = 1 unless you key them there, and **a channel missing from
  a delta keyframe is 0 at that keyframe**. So `{ "t": 0.56 }` means "no error yet at 0.56".
- `fails`: check ids that must go **red** during the mistake (validator enforces, at its
  active phases). Other checks may go red too; that's shown honestly.
- Aim for 2–4 mistakes. Make the error clearly visible, not subtle: it's a teaching aid.
- Handy channels: knees caving `kneeOut −20..−30`; heels up `heelRaise 12–16` with
  `rootZ +0.08`; shallow `rootY +0.14`; hips shooting up `rootY +0.1, rootPitch +25..30`;
  rounding `lumbarFlex +20..25`; elbow flare `elbowOut`; shrugging `scapElev +20`.

## Camera views

The player and contact sheets frame the whole rep automatically (all body points and
props over the correct rep and every mistake). Preset views: **side** (from the person's
right), **front**, **45°** (front-right); the user can drag to orbit. Nothing to author.

## Validator rules (summary)

`node scripts/validate-motions.mjs` fails a file when: the exercise name isn't in
`js/seed.js`; a key, channel, prop type, point, measure, part or phase name is unknown; a
value is outside its range; keyframes/phases are out of order or don't cover 0..1; a
contact can't be reached (> 1 cm) on any frame; a measured knee/elbow/hip/ankle angle is
outside human limits; a body point goes > 2 cm below the floor; a check is not green on
every frame of the correct rep; a mistake's `fails` check never turns red; two files
animate the same exercise. It warns on ignored joint channels (IK limbs), channels not set
at t = 0 and t = 1, and a file name that doesn't match the slug.

It does **not** detect body parts passing through each other or through props (except
the floor), floating above a seat, or a movement that is wrong but self-consistent:
that is what the contact sheets are for.

## Worked example: `motions/squat-barbell.json`

High-bar back squat: bar on the upper back, hands on the bar, feet planted shoulder-width
with toes out 20°, descent to just below parallel, neutral spine, knees over the toes,
heels down, bar over mid-foot. The legs and arms are IK (contacts), so only the root and
the spine are keyframed.

```json
{
  "version": 1,
  "exercise": "Squat (Barbell)",
  "durationMs": 3600,
  "props": [
    { "id": "bar", "type": "barbell", "grip": 0.78, "attach": { "to": "thorax", "offset": [0, 0.235, -0.05] } }
  ],
  "contacts": {
    "feet": { "at": [0.17, 0, 0], "toeOut": 20 },
    "hands": { "at": "bar.grip", "elbowPole": [0.25, -1, -0.45] }
  },
  "phases": [
    { "name": "Brace", "start": 0, "end": 0.06 },
    { "name": "Descent", "start": 0.06, "end": 0.46 },
    { "name": "Bottom", "start": 0.46, "end": 0.56 },
    { "name": "Ascent", "start": 0.56, "end": 0.94 },
    { "name": "Lockout", "start": 0.94, "end": 1 }
  ],
  "keyframes": [
    { "t": 0, "rootY": 0.92, "rootZ": 0.04, "rootPitch": 9, "lumbarFlex": 0, "thoracicFlex": 0, "neckFlex": 0 },
    { "t": 0.06, "rootY": 0.92, "rootZ": 0.04, "rootPitch": 9 },
    { "t": 0.3, "rootY": 0.66, "rootZ": -0.06, "rootPitch": 18, "lumbarFlex": 2, "neckFlex": -4 },
    { "t": 0.48, "rootY": 0.37, "rootZ": -0.16, "rootPitch": 28, "lumbarFlex": 6, "thoracicFlex": 3, "neckFlex": -10 },
    { "t": 0.54, "rootY": 0.37, "rootZ": -0.16, "rootPitch": 28, "lumbarFlex": 6, "thoracicFlex": 3, "neckFlex": -10 },
    { "t": 0.75, "rootY": 0.66, "rootZ": -0.06, "rootPitch": 18, "lumbarFlex": 2, "neckFlex": -4 },
    { "t": 0.94, "rootY": 0.92, "rootZ": 0.04, "rootPitch": 9, "lumbarFlex": 0, "thoracicFlex": 0, "neckFlex": 0 },
    { "t": 1, "rootY": 0.92, "rootZ": 0.04, "rootPitch": 9, "lumbarFlex": 0, "thoracicFlex": 0, "neckFlex": 0 }
  ],
  "checks": [
    { "id": "depth", "label": "Hip crease below the knee", "measure": { "delta": ["hip", "knee"], "axis": "y" }, "max": 0, "tol": 0.04, "phases": ["Bottom"], "parts": ["thighs", "pelvis"] },
    { "id": "back", "label": "Neutral lower back", "measure": "lumbarFlex", "min": -10, "max": 12, "tol": 6, "parts": ["lumbar", "pelvis"] },
    { "id": "chest", "label": "Chest up, hips and bar rise together", "measure": "trunkLean", "max": 45, "tol": 5, "parts": ["thorax"] },
    { "id": "knees", "label": "Knees track over the toes", "measure": "kneeTrack", "sides": true, "min": -8, "max": 15, "tol": 6, "parts": ["knees"] },
    { "id": "heels", "label": "Heels down", "measure": "heelRaise", "sides": true, "max": 2, "tol": 4, "parts": ["feet"] },
    { "id": "barpath", "label": "Bar over mid-foot", "measure": { "delta": ["bar", "midfoot"], "axis": "z" }, "min": -0.05, "max": 0.05, "tol": 0.04, "parts": ["bar"] }
  ],
  "mistakes": [ "… see the file: knees-cave, shallow, hips-up, toes …" ]
}
```

Why these numbers:

- Standing (`t = 0`): hips 4 cm in front of the ankles and a 9° forward tilt put the bar
  over mid-foot; `rootY 0.92` leaves the knees ~8° soft.
- Bottom (`t = 0.48–0.54`): `rootY 0.37` puts the hip joint ~5 cm below the knee joint
  (just below parallel); hips back (`rootZ −0.16`) and trunk lean `28 + 6 + 3 = 37°`
  keep the bar over mid-foot. Resulting knee ~132°, hip ~125°, ankle ~35° dorsiflexion.
- The descent and ascent use the same mid-way keyframe, so the bar path is vertical.

### Recipe sketches (starting points; tune with the validator and contact sheets)

- **Lying press** (bench press): bench `{ "type": "bench", "pos": [0, 0, 0.05] }`; root
  `rootPitch -90, rootY 0.56, rootZ 0.45, lumbarFlex -8, scapProt -10, neckFlex 12`; feet
  `{ "at": [0.3, 0, 0.75], "toeOut": 15 }`; barbell with `"pos": [0, 1.07, -0.06]`, keyed
  `"bar.y"` 0 → −0.28 → 0 and `"bar.z"` 0 → 0.08 → 0; hands
  `{ "at": "bar.grip", "elbowPole": [0.5, -0.3, -1] }`; elbow flare check `shAbd`, sides.
- **Curl**: standing, no contacts for the arms; dumbbell(s) attached to `handL`/`handR`;
  keyframe `elbowFlex` 0 → 140 → 0 with `shFlex` ~5–10; `forearmPro -90` for palms up.
- **Seated machine** (leg extension): `box` seat and back pad with `pos`; `rootY` = seat
  top + 0.09; legs FK (`hipFlex 90`, `kneeFlex` 90 → 0); `roller` attached to the shins;
  hands on the handles via `hands` contacts to `rod`/`handle` props.
- **Pull-up / pulldown**: `rod` with `pos` (pull-up: fixed bar, body moves; pulldown:
  body fixed on a seat, bar keyed) and `hands` contacts with `elbowPole [0.6, -1, 0]`;
  pulldown adds a `cable` from the pulley to `"bar.center"`.
