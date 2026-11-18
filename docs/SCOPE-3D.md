# Scope: animated 3D exercise models (v2)

Status: proposal, not started.

## Goal

Each exercise gets an animated model of one rep. The user can play, pause, step a
frame at a time and change the speed. Colors show whether each body part is in a
good position. A "mistake" mode replays the rep with a common error, with the
faulty parts in red.

## The hard part is the motion, not the rendering

Drawing a mannequin is easy. Making 30+ exercises move correctly is the real work,
because a wrong animation is worse than none. So the core of v2 is a motion spec
per exercise, and any renderer reads it:

```jsonc
// motions/squat-barbell.json (sketch)
{
  "exercise": "Squat (Barbell)",
  "props": [{ "type": "barbell", "attach": "upperBack" }],
  "durationMs": 3000,
  "phases": [["Descent", 0, 0.45], ["Bottom", 0.45, 0.55], ["Ascent", 0.55, 1]],
  "keyframes": [          // joint angles in degrees; between keyframes they are eased
    { "t": 0,    "hip": 0,   "knee": 0,   "ankle": 0,  "trunk": 5 },
    { "t": 0.5,  "hip": 100, "knee": 115, "ankle": 30, "trunk": 40 },
    { "t": 1,    "hip": 0,   "knee": 0,   "ankle": 0,  "trunk": 5 }
  ],
  "checks": [            // drive the colors: green, amber near the limit, red outside it
    { "id": "depth", "label": "Hip crease below the knee", "joint": "hip", "at": "Bottom", "min": 95 },
    { "id": "back",  "label": "Neutral back", "segment": "spine", "maxFlex": 10 }
  ],
  "mistakes": [          // each one is a delta on the correct rep, linked to a cue
    { "id": "knee-cave", "label": "Knees caving in", "cue": "Push the knees out over the toes",
      "delta": [{ "t": 0.5, "hipAdduction": 15 }], "fails": ["knees"] }
  ]
}
```

The "Common mistakes" already in each exercise's cues become the `mistakes` list,
so the text and the animation tell the same story.

## Where the motion comes from

1. **Hand-authored keyframes (recommended for v2).** There are 4–6 key poses per
   rep on a simple skeleton (forward kinematics), checked against the researched
   cues and reviewed visually from contact sheets. This is predictable, small
   (a few KB per exercise) and fully under our control.
2. **Pose extraction from video (MediaPipe / similar).** This needs licensed
   reference videos and cleanup, because the extracted motion is noisy. It's better kept
   for a later "check my form from my own video" feature (v3), where the same `checks`
   could grade the user's video.

## Renderer options, and what I think of fframes

fframes renders **video from SVG frames**, written in Rust. It's good at
precise, deterministic, color-coded frames. However, it has **no 3D engine**: a "3D"
model would mean projecting the skeleton into 2D ourselves and drawing the limbs
as SVG shapes. Its output is a fixed camera angle, so you couldn't rotate the model.

| | A. Live 3D in the app (three.js) | B. Pre-rendered with fframes |
|---|---|---|
| What the phone gets | Motion JSON (~5 KB) + three.js once (~700 KB, cached) | SVG/WebP frame lists or MP4 per view |
| Rotate / any angle | Yes, drag to orbit | No, only the fixed views we render (side, front) |
| Frame step, slow-mo | Exact: the pose is computed for any time | Exact with frame lists; MP4 stepping on iOS Safari is unreliable |
| Correct / mistake colors | Live, toggle any mistake | One render per mistake per view |
| Offline | Yes | Yes, but more storage |
| Toolchain | Plain JS, fits the current no-build app | Rust + ffmpeg + GPU on the build machine |
| Shareable video clips | Needs extra work | Natural fit |

**Recommendation:** use A for the app, and use fframes for what it's best at:

- rendering contact sheets / strips of each animation from the same motion JSON, so
  every exercise is reviewed visually (by me, Sol and you) before it ships;
- optional shareable MP4 clips per exercise later.

If you prefer the "list of frames" look exactly, B can export SVG frames that the
app plays as a flipbook. That approach is simpler on the phone but has fixed angles
and more files.

## The player (in the exercise screen, new "Animation" section)

- Play / pause, previous / next frame, scrub bar, loop, speed 0.25× / 0.5× / 1×.
- Phase label (Descent / Bottom / Ascent) and a pause on each phase.
- Views: side, front, 45°, plus drag to rotate (option A).
- Toggle: **Correct** / each **Mistake** from a chip list; the mistake mode shows the
  faulty parts in red and the matching cue text.
- Legend: green good, amber near the limit, red wrong.
- Equipment as simple shapes: barbell, dumbbells, bench, cable + handle, machine pads.

## Phases

0. **Spike (1 exercise: Squat).** Motion format, skeleton, three.js player and an
   fframes contact-sheet renderer. This phase decides A vs B with something you can try on
   your phone.
1. **Player + format.** The full player UI, equipment shapes, the mistake system and a
   validation script (joint limits, `checks` consistent with the keyframes).
2. **Content in batches by routine.** Legs → Pull → Push → the rest. Each exercise gets
   1 correct rep + 2–3 mistakes, reviewed from contact sheets.
3. **Polish.** Performance on iPhone, offline caching, accessibility (reduced motion,
   labels, not color-only: icons ✓ / ⚠ / ✕ next to each check).

## Team (spreading tokens between Claude and Codex)

- **Opus 5.5 agents:** skeleton and three.js player, UI, the fframes review renderer,
  and authoring half of the motion files.
- **GPT Sol 6.2 agents:** authoring the other half of the motion files, plus biomechanics
  review of the ones the Opus agents wrote (and vice versa), plus code review (the usual Sol loop).
- Me: the format, integration, test/smoke runs, and the final visual check of every
  contact sheet before shipping.

## Risks

- **Accuracy.** Animations are illustrations, not motion capture. Mitigations: cross-review
  between the two model families, review from contact sheets, and show a short
  "illustrative" note. Your own photos and notes still win.
- **Effort on content.** Roughly 30–60 min of agent time per exercise with
  review; ~31 exercises.
- **iPhone performance.** A low-poly mannequin is light for WebGL. It's still to be verified on a real phone
  during the spike.
- **Scope creep.** Realistic muscle meshes, faces and clothes are out of scope; the style is a clean
  mannequin with colored segments.
