// Default cues, source links and reference photos for common lifts. Names match
// Strong's naming so they attach to exercises imported from a Strong export.
// Cues were researched from the linked sources (Stronger By Science, NASM, ACE,
// BarBend, Outlift…). Photos are bundled in defaults/images (public domain, see
// defaults/CREDITS.md). Generated from research notes; edit freely.

const photos = (id, ...captions) => captions.map((caption, i) => ({ src: `defaults/images/${id}/${i}.jpg`, caption }));

// Bump when defaults change so existing exercises pick them up (see upgradeDefaults in app.js).
export const DEFAULTS_VERSION = 4;

// Short hash of a cues text, used to recognise untouched older default cues.
export function cueHash(text) {
  let h = 0x811c9dc5;
  for (const c of text.trim()) {
    h ^= c.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

// "<lowercase name>:<cueHash>" of earlier default cues: these get replaced by the
// current defaults; anything the user edited is left alone.
export const LEGACY_CUES = new Set([
  'bench press (barbell):1v4oau0',
  'bent over row (barbell):1ewozbh',
  'bulgarian split squat:100s5u9',
  'deadlift (barbell):1kyfhmu',
  'face pull (cable):19z5fz6',
  'hammer curl (dumbbell):rnnmyw',
  'incline bench press (barbell):o1wzds',
  'incline bench press (dumbbell):7m7lk',
  'iso-lateral row (machine):1t2b3b5',
  'lat pulldown (cable):1gkqe1f',
  'leg extension (machine):a2fn3h',
  'lying leg curl (machine):1jcvxf6',
  'overhead press (barbell):1iuojeu',
  'pull up:wso6b9',
  'romanian deadlift (barbell):a7z4ut',
  'seated overhead press (dumbbell):16bof8r',
  'squat (barbell):dgdi13'
]);

export const STARTER = [
  {
    name: 'Squat (Barbell)',
    photos: photos('Barbell_Squat', 'Top: standing tall, bar on upper back', 'Bottom: hips just below knees, chest up'),
    muscles: 'Quads, glutes, adductors, hamstrings, spinal erectors, core',
    links: [
      'https://www.strongerbyscience.com/how-to-squat/',
      'https://barbend.com/back-squat/',
    ],
    cues: `Setup
- Bar on upper traps (high bar) or rear delts (low bar), not neck
- Feet about shoulder width, toes out roughly 15–30°
- Hands just outside shoulders; squeeze bar, upper back tight
- Unrack, take two or three steps back, set feet

Execution
- Break at hips and knees together; sit down between heels
- Knees track over toes; knees past toes is fine
- Squat as deep as you can with a neutral back
- Keep weight over mid-foot, whole foot planted
- Drive up: push the floor away, traps back into the bar

Breathing & tempo
- Big belly breath, brace like bracing for a punch
- Hold breath through the rep; exhale at the top
- Controlled descent, as fast as you can stay in control
- Stand up explosively

Common mistakes
- Hips shoot up first ("good morning squat") → lead with chest and traps
- Cutting depth short → lower the load, squat to your full depth
- Knees caving in → push knees out over toes
- Rocking to toes or heels → keep pressure mid-foot
- Bar digs into neck → set bar on muscle, tighten upper back

Programming tips
- Hypertrophy: 3–4 sets of 6–10 reps, 1–3 reps in reserve
- Strength: 3–5 sets of 3–5 reps, heavy but crisp
- Rest 2–3 min (hypertrophy), 3–5 min (strength)
- Progress: add reps to top of range, then add 2.5–5 kg`,
  },
  {
    name: 'Bench Press (Barbell)',
    photos: photos('Barbell_Bench_Press_-_Medium_Grip', 'Top: arms locked, bar over shoulders', 'Bottom: bar touches lower chest'),
    muscles: 'Chest, front delts, triceps',
    links: [
      'https://www.strongerbyscience.com/how-to-bench/',
      'https://outlift.com/bench-press/',
    ],
    cues: `Setup
- Eyes under the bar; feet planted firmly on the floor
- Grip about 1.5–2× shoulder width; bar low in the palm
- Pull shoulder blades back and down; keep them pinned
- Moderate arch: lift the chest, not just the lower back
- Wrists stacked over elbows; squeeze the bar hard

Execution
- Lower the bar under control to lower chest / sternum
- Elbows roughly 45° from torso, under the bar
- Touch the chest lightly, no bounce
- Press up and slightly back toward the shoulders
- Drive heels into the floor; glutes stay on the bench

Breathing & tempo
- Deep breath at the top before lowering; hold it
- Exhale near lockout or between reps
- 1–2 s controlled lowering; press with intent

Common mistakes
- Bouncing the bar off the chest → touch and press, brief pause if needed
- Wrists bent back → grip lower in palm, knuckles to ceiling
- Elbows flared to 90° → tuck to about 45°
- Shoulders roll forward at the top → keep blades pinned throughout
- Big low-back arch, flat chest → arch by lifting the chest

Programming tips
- Hypertrophy: 3–4 sets of 6–12 reps, 1–3 reps in reserve
- Strength: 3–5 sets of 3–5 reps
- Rest 2–3 min; 3–5 min on heavy sets
- Always use safeties or a spotter near failure
- Progress: add reps, then add 1–2.5 kg`,
  },
  {
    name: 'Deadlift (Barbell)',
    photos: photos('Barbell_Deadlift', 'Setup: bar over mid-foot, back flat', 'Lockout: standing tall, glutes squeezed'),
    muscles: 'Glutes, hamstrings, adductors, spinal erectors, quads, lats, traps, grip',
    links: [
      'https://www.strongerbyscience.com/how-to-deadlift/',
      'https://www.nasm.org/resource-center/exercise-library/barbell-deadlift',
    ],
    cues: `Setup
- Feet about hip width; bar over mid-foot
- Bar an inch or so from the shins
- Grip just outside the legs; arms straight
- Hinge down until shins touch the bar; shoulders slightly ahead of it
- Lats on: "shoulder blades in back pockets"

Execution
- Pull the slack out before the bar leaves the floor
- Push the floor away; hips and chest rise together
- Bar drags up your shins and thighs
- Finish standing tall: hips through, glutes squeezed
- Lower by hinging, bar close, back neutral

Breathing & tempo
- Big belly breath and brace before each pull
- Hold the breath through the rep
- Exhale and re-brace at the top or on the floor
- Smooth start, no jerking; controlled lowering

Common mistakes
- Jerking the bar → build tension first, then push
- Hips shoot up early → brace harder, push with the legs first
- Bar drifts forward → engage lats, keep bar touching legs
- Rounded lower back → lighter load, brace, set spine first
- Leaning back at lockout → just stand tall, glutes squeezed
- Bending the arms → arms are hooks, keep elbows straight

Programming tips
- Strength: 3–5 sets of 1–5 reps
- Hypertrophy: 3–4 sets of 5–8 reps, 2–3 reps in reserve
- Rest 3–5 min between heavy sets
- Reset each rep on the floor
- Progress: add 2.5–5 kg when all reps look clean`,
  },
  {
    name: 'Overhead Press (Barbell)',
    photos: photos('Standing_Military_Press', 'Start: bar on front delts', 'Lockout: bar over mid-foot'),
    muscles: 'Front and side delts, triceps, upper chest, upper traps, core',
    links: [
      'https://outlift.com/overhead-press/',
      'https://barbend.com/overhead-press/',
    ],
    cues: `Setup
- Rack the bar at upper-chest height
- Grip slightly wider than shoulders; bar in the heel of the palm
- Forearms vertical, wrists stacked over elbows
- Feet about shoulder width; squeeze glutes and quads
- Bar on upper chest, elbows slightly in front of the bar

Execution
- Tuck chin, move head back so the bar clears your face
- Press straight up, close to your face
- Once the bar passes the forehead, push head "through the window"
- Lock out with bar over mid-foot; shrug up at the top
- Ribs down; don't lean back to press

Breathing & tempo
- Breathe and brace before each rep
- Hold through the press; exhale at lockout
- Press explosively off the chest
- Lower under control back to the collarbones

Common mistakes
- Pressing around the head → move head back, bar path straight
- Big lower-back lean → glutes tight, ribs down, lighter load
- Wrists bent back → bar low in palm, stack wrists
- Grip too wide → forearms roughly vertical mid-press
- Sneaky leg drive → keep knees locked for a strict press

Programming tips
- Hypertrophy: 3–4 sets of 6–10 reps, 1–3 reps in reserve
- Strength: 3–5 sets of 3–5 reps
- Rest 2–3 min; up to 4 min when heavy
- Progress slowly: microplates (0.5–1.25 kg) or add reps`,
  },
  {
    name: 'Bent Over Row (Barbell)',
    photos: photos('Bent_Over_Barbell_Row', 'Start: hinged, arms long', 'Top: bar pulled to lower ribs'),
    muscles: 'Lats, rhomboids, mid/lower traps, rear delts, biceps, spinal erectors',
    links: [
      'https://outlift.com/barbell-row/',
      'https://barbend.com/bent-over-row/',
    ],
    cues: `Setup
- Feet hip width; grip a bit wider than shoulders
- Hinge like an RDL; slight knee bend
- Torso between parallel and about 45°, as mobility allows
- Neutral spine, braced core, arms hanging straight

Execution
- Drive elbows back toward the hips
- Pull the bar to lower chest or upper stomach
- Squeeze shoulder blades together at the top
- Keep torso angle fixed; no standing up
- Lower fully; let shoulder blades spread for a stretch

Breathing & tempo
- Brace before the pull; exhale as the bar returns
- Pull smoothly, brief squeeze at the top
- Lower over 1–3 s; no dropping

Common mistakes
- Torso rises each rep → lighter load, hold the hip angle
- Heaving with the hips → strict reps, cut the weight
- Rounded lower back → brace, shorten hinge depth
- Pulling with arms only → lead with the elbows
- Short reps at the bottom → reach arms fully each rep

Programming tips
- Hypertrophy: 3–4 sets of 8–15 reps, 1–2 reps in reserve
- Strength: 3–5 sets of 5–6 reps
- Higher reps spare the lower back
- Rest 2–3 min
- Progress: reps first, then 2.5 kg`,
  },
  {
    name: 'Romanian Deadlift (Barbell)',
    photos: photos('Romanian_Deadlift', 'Bottom: hips back, bar below knees', 'Top: standing, soft knees'),
    muscles: 'Hamstrings, glutes, adductors, spinal erectors, grip',
    links: [
      'https://outlift.com/romanian-deadlift/',
      'https://www.nasm.org/resource-center/exercise-library/romanian-deadlift-barbell',
    ],
    cues: `Setup
- Start standing, bar from a rack or the floor
- Feet hip width, toes about forward
- Grip just outside the thighs; shoulders back and down
- Soft knees; brace core, neutral spine

Execution
- Push hips back; keep knees softly bent
- Bar slides down the thighs, close to the legs
- Shins stay near vertical
- Lower until a big hamstring stretch, often mid-shin
- Drive hips forward to stand; squeeze glutes

Breathing & tempo
- Breathe and brace at the top
- Hold through the rep; exhale at the top
- Slow lowering, 2–3 s
- No bouncing at the bottom

Common mistakes
- Rounded lower back → stop where the hips stop moving back
- Too much knee bend → hips back, knees soft only
- Bar drifts forward → lats on, bar touching legs
- Chasing the floor → depth is set by hamstring flexibility
- Going too heavy → choose a load you control

Programming tips
- Hypertrophy: 3–4 sets of 8–12 reps, 1–3 reps in reserve
- Strength: 3–4 sets of 5–8 reps
- Rest 2–3 min
- Straps are fine if grip limits your sets
- Progress: reps first, then add 2.5–5 kg`,
  },
  {
    name: 'Lat Pulldown (Cable)',
    photos: photos('Wide-Grip_Lat_Pulldown', 'Start: arms long, slight lean back', 'Bottom: bar to upper chest'),
    muscles: 'Lats, teres major, rhomboids, traps, rear delts, biceps',
    links: [
      'https://barbend.com/lat-pulldown/',
      'https://breakingmuscle.com/lat-pulldown/',
    ],
    cues: `Setup
- Thigh pad snug; feet flat on the floor
- Overhand grip a few inches wider than shoulders
- Bar in the middle of the palms; arms fully extended
- Sit tall, chest up, slight lean back

Execution
- Start by pulling the shoulder blades down
- Drive elbows down toward your back pockets
- Pull the bar to upper chest or chin level
- Keep torso still; minimal lean
- Return overhead under control to a full stretch

Breathing & tempo
- Exhale as you pull down
- Inhale as the bar returns
- 1 s pull, brief squeeze, 2–3 s return

Common mistakes
- Swinging the torso → lighter load, keep chest still
- Leaning way back → stay nearly upright
- Behind-the-neck pulls → pull to the front
- Half reps → full stretch at the top every rep
- Arms doing the work → think elbows, try a thumbless grip

Programming tips
- Hypertrophy: 3–4 sets of 8–12 reps, 1–2 reps in reserve
- Strength: 2–3 sets of 6–8 reps
- Rest 90 s–2 min
- Progress: add reps, then the next weight on the stack`,
  },
  {
    name: 'Pull Up',
    photos: photos('Pullups', 'Start: dead hang', 'Top: chin over the bar'),
    muscles: 'Lats, rhomboids, mid/lower traps, rear delts, biceps, core',
    links: [
      'https://www.nasm.org/resource-center/exercise-library/pull-up',
      'https://barbend.com/pull-up-guide/',
    ],
    cues: `Setup
- Overhand grip slightly wider than shoulders
- Bar across mid-palm; full grip
- Start from a still dead hang, arms straight
- Brace core; legs still or slightly in front

Execution
- Pull shoulder blades down first
- Drive elbows down toward your back pockets
- Pull until the chin clears the bar
- Lower to a full hang every rep
- Keep the body still; no kicking

Breathing & tempo
- Exhale on the way up
- Inhale on the way down
- Brief hold at the top; lower in 2–3 s

Common mistakes
- Kipping or swinging → pause in the dead hang, strict reps
- Half reps → full hang to chin over bar
- Yanking with the arms → start with the shoulder blades
- Dropping fast → control the descent
- Shrugging up to the ears → shoulders down, away from ears

Programming tips
- Hypertrophy: 3–4 sets of 6–12 reps, 1–2 reps in reserve
- Strength: 3–5 sets of 3–5 reps, add weight
- Rest 2–3 min
- Can't do one yet? Use bands, slow negatives, or pulldowns
- Progress: add reps, then a belt with 1–2.5 kg`,
  },
  {
    name: 'Seated Overhead Press (Dumbbell)',
    photos: photos('Seated_Dumbbell_Press', 'Top: arms extended, dumbbells over shoulders', 'Bottom: dumbbells at ear / shoulder level'),
    muscles: 'Front and side delts, triceps, upper chest, upper traps',
    links: [
      'https://barbend.com/dumbbell-shoulder-press/',
      'https://barbend.com/seated-vs-standing-shoulder-press/',
    ],
    cues: `Setup
- Bench nearly upright, one notch below vertical
- Back and hips against the pad; feet planted
- Dumbbells on knees; kick them up one at a time
- Dumbbells at shoulders, elbows under wrists
- Elbows slightly in front of the body, not straight out

Execution
- Press up and slightly in, over the shoulders
- Lock out without clanking the dumbbells together
- Lower to about shoulder or ear level
- Keep ribs down; head neutral

Breathing & tempo
- Breathe in at the bottom; brace
- Exhale as you press up
- Lower over 2–3 s under control

Common mistakes
- Leaning back into an incline press → back on the pad, lighter load
- Hips sliding forward → sit all the way back
- Short reps → lower to shoulder level each rep
- Elbows flared painfully → bring elbows slightly forward
- Dropping dumbbells after the set → bring them to your knees first

Programming tips
- Hypertrophy: 3–4 sets of 8–12 reps, 1–2 reps in reserve
- Strength focus: 3–4 sets of 6–8 reps
- Rest 90 s–2.5 min
- Progress: hit the top of the range, then the next dumbbell`,
  },
  {
    name: 'Incline Bench Press (Barbell)',
    photos: photos('Barbell_Incline_Bench_Press_-_Medium_Grip', 'Top: arms locked over the shoulders', 'Bottom: bar touches upper chest'),
    muscles: 'Upper chest, front delts, triceps',
    links: [
      'https://barbend.com/incline-barbell-bench-press-guide/',
      'https://www.barbellmedicine.com/blog/best-upper-chest-exercises-for-bigger-pecs/',
    ],
    cues: `Setup
- Bench at 30–45°; about 30° is a good start
- Feet planted, hips and upper back stay on the bench
- Grip slightly wider than shoulders; forearms vertical at the bottom
- Shoulder blades back and down, squeeze the bar hard
- Unrack, then bring the bar over your shoulders before lowering

Execution
- Lower under control to the upper chest, just below the collarbones
- Elbows under the bar, tucked about 45–70° from the torso
- Touch lightly or pause briefly, no bouncing
- Press up and slightly back over the shoulders
- Stop just short of a hard lockout, stay tight

Breathing & tempo
- Breathe in and brace before each rep
- Hold the breath on the way down, exhale near the top
- About 2–3 s down, press up with intent

Common mistakes
- Feeling it mostly in the shoulders → lower the bench angle
- Bouncing off the chest → brief pause on touch
- Shoulders roll forward off the bench → re-set shoulder blades before unracking
- Hard lower-back arch or butt lifting → glutes down, reduce load
- Elbows flared to 90° → tuck elbows slightly toward your sides

Programming tips
- Hypertrophy: 3–4 sets of 6–12 reps, 1–3 reps in reserve
- Strength: 3–5 sets of 3–6 reps, rest 3–5 min
- Rest 2–3 min on most sets; use safety pins or a spotter
- Progress: add reps within the range, then add 2.5–5 kg`,
  },
  {
    name: 'Incline Bench Press (Dumbbell)',
    photos: photos('Incline_Dumbbell_Press', 'Bottom: dumbbells at upper chest, elbows under wrists', 'Top: arms extended over the chest'),
    muscles: 'Upper chest, front delts, triceps',
    links: [
      'https://www.nasm.org/resource-center/exercise-library/two-arm-incline-dumbbell-chest-press',
      'https://www.acefitness.org/resources/everyone/exercise-library/25/incline-chest-press/',
    ],
    cues: `Setup
- Bench at 30–45°; steeper shifts work to the front delts
- Sit with dumbbells on your thighs, kick them up as you lie back
- Feet flat, shoulder blades back and down into the pad
- Start with dumbbells over the upper chest, wrists over elbows

Execution
- Lower toward the upper chest, slightly out toward the armpits
- Elbows about 45° from the torso, forearms vertical
- Deep, controlled stretch; stop before shoulders roll forward
- Press up and slightly in; dumbbells don't need to touch
- Keep wrists neutral, not bent back

Breathing & tempo
- Inhale on the way down, exhale as you press
- 2–3 s down, brief pause in the stretch
- Brace before each rep so the torso stays still

Common mistakes
- Bench too steep → set it to 30–45°
- Bouncing at the bottom → control the stretch, brief pause
- Elbows flared straight out → angle them ~45° from the torso
- Arching to finish reps → reduce the load, ribs down
- Dropping dumbbells to the sides → bring them to your thighs and sit up

Programming tips
- Hypertrophy: 3–4 sets of 8–12 reps, 1–2 reps in reserve
- Strength-focused: 3–4 sets of 6–8 reps
- Rest 2–3 min between sets
- Progress: top of the range on all sets, then the next dumbbell`,
  },
  {
    name: 'Iso-Lateral Row (Machine)',
    photos: photos('Leverage_Iso_Row', 'Start: arms long, chest on the pad', 'End: elbows driven back, shoulder blades squeezed'),
    muscles: 'Lats, mid traps, rhomboids, rear delts, biceps',
    links: [
      'https://www.lifefitness.com/en-eu/catalog/strength-training/plate-loaded/plate-loaded-iso-lateral-row',
      'https://barbend.com/chest-supported-row/',
    ],
    cues: `Setup
- Seat so the handles line up with mid-to-lower chest
- Sternum firmly on the chest pad, feet planted
- Grip: neutral favors lats, overhand favors upper back
- Start with arms long, shoulder blades reaching forward slightly

Execution
- Pull the shoulder blades back first, then drive the elbows back
- Pull toward the lower ribs: "elbows to back pockets"
- Pause briefly with shoulder blades squeezed
- Return slowly to a full stretch, arms straight
- Try one arm at a time to fix imbalances

Breathing & tempo
- Exhale as you pull, inhale on the way back
- About 1 s pull, 1 s squeeze, 2–3 s back
- Chest stays on the pad the whole set

Common mistakes
- Chest lifting off the pad → lighten the load, stay pinned
- Shrugging toward the ears → shoulders down, lead with the elbows
- Short reps → full stretch and full squeeze
- Yanking with the biceps → loose grip, "drive the elbows"
- Grip fails first → use straps on heavy sets

Programming tips
- Hypertrophy: 3–4 sets of 8–12 reps, 1–2 reps in reserve
- Strength: 4–5 sets of 5–6 reps
- Rest 1.5–2.5 min between sets
- Progress: add reps, then a small plate per side`,
  },
  {
    name: 'Face Pull (Cable)',
    photos: photos('Face_Pull', 'Start: arms extended toward the pulley', 'End: rope at the face, hands apart, elbows high'),
    muscles: 'Rear delts, mid traps, rhomboids, rotator cuff',
    links: [
      'https://www.nasm.org/resource-center/exercise-library/face-pull',
      'https://barbend.com/face-pulls/',
    ],
    cues: `Setup
- Rope on the pulley at about eye level or slightly higher
- Overhand or thumbs-back grip, step back until the cable is taut
- Staggered or square stance, soft knees, core braced
- Stand tall, ribs down, shoulders back and down

Execution
- Pull the middle of the rope toward your forehead / eyes
- Pull the rope ends apart as they reach your face
- Elbows high, at or above shoulder height
- Finish rotated out, knuckles up: "double-biceps" pose
- Return slowly until the arms are straight

Breathing & tempo
- Exhale as you pull, inhale on the return
- Pause 1 s at the face, 2 s return
- Smooth, no jerking

Common mistakes
- Elbows drop, it becomes a row → elbows high, pull to the face
- Leaning back to move the weight → lighten it, torso still
- Shrugging → shoulders down away from the ears
- Too heavy, half reps → light weight, full range

Programming tips
- 2–4 sets of 12–20 reps, light and controlled
- Also a good warm-up: 2–3 easy sets of 15–20
- Rest 60–90 s; pairs well with pressing
- Progress: more reps or a longer pause before adding weight`,
  },
  {
    name: 'Hammer Curl (Dumbbell)',
    photos: photos('Hammer_Curls', 'Start: arms straight, palms facing in', 'Top: curled up, elbows still by your sides'),
    muscles: 'Brachialis, brachioradialis, biceps',
    links: [
      'https://www.acefitness.org/resources/everyone/exercise-library/10/hammer-curl/',
      'https://barbend.com/hammer-curls/',
    ],
    cues: `Setup
- Stand tall, dumbbells at your sides, palms facing each other
- Brace your core, shoulders down and back
- Wrists straight, firm grip
- Upper arms against your sides

Execution
- Curl by bending only at the elbow
- Keep the neutral grip throughout, no twisting
- Bring the dumbbells toward the front of the shoulders
- Squeeze briefly at the top, elbows by your sides
- Lower all the way to full elbow extension

Breathing & tempo
- Exhale as you curl, inhale as you lower
- About 1 s up, brief squeeze, 2–3 s down
- Both arms together or alternating, same control

Common mistakes
- Swinging the torso → lighten the load, stand tall
- Elbows drift forward → pin upper arms to your sides
- Twisting the wrists → thumbs up the whole time
- Half reps at the bottom → straighten the arm fully
- Shrugging → shoulders down

Programming tips
- Hypertrophy: 3–4 sets of 8–15 reps, 0–2 reps in reserve
- Strength: 4–5 sets of 6–8 reps, rest about 2 min
- Rest 60–90 s for hypertrophy sets
- Progress: add reps first, then the next dumbbell`,
  },
  {
    name: 'Bulgarian Split Squat',
    photos: photos('Split_Squat_with_Dumbbells', 'Top: rear foot on the bench, standing tall', 'Bottom: back knee near the floor, front shin fairly vertical'),
    muscles: 'Quads, glutes, adductors, hamstrings, core',
    links: [
      'https://www.nasm.org/resource-center/exercise-library/bulgarian-split-squat',
      'https://catalystathletics.com/exercise/173/Bulgarian-Split-Squat/',
    ],
    cues: `Setup
- Rear foot laces-down on a knee-height bench
- Front foot about 2–3 foot-lengths ahead of the bench
- Test depth with one bodyweight rep, adjust your foot spot
- Dumbbells at your sides, or hold a support for balance
- Shorter stance = more quads, longer stance = more glutes

Execution
- Drop straight down, rear knee toward the floor
- Most of your weight stays on the front foot
- Front knee tracks over the toes, no caving in
- Go until the rear knee is just above the floor
- Drive up through the whole front foot

Breathing & tempo
- Inhale and brace at the top, exhale on the way up
- 2–3 s down, don't crash into the bottom
- Finish all reps on one leg, then switch

Common mistakes
- Front foot too close, heel lifts → step further forward
- Front knee caves in → push the knee out over the middle toes
- Pushing off the back leg → weight on the front foot
- Shallow reps → lighten the load, reach full depth
- Losing balance → use a support or lighter dumbbells first

Programming tips
- Hypertrophy: 2–4 sets of 8–15 reps per leg
- Strength: 3–4 sets of 5–8 reps per leg
- Rest 1.5–2 min; start with your weaker leg
- Progress: master bodyweight reps, then add dumbbells gradually`,
  },
  {
    name: 'Leg Extension (Machine)',
    photos: photos('Leg_Extensions', 'Start: knees bent ~90°, pad on lower shins', 'Top: legs straight, quads squeezed'),
    muscles: 'Quads',
    links: [
      'https://www.strongerbyscience.com/leg-extension-muscle-growth/',
      'https://barbend.com/leg-extension/',
    ],
    cues: `Setup
- Line up your knee joint with the machine's pivot
- Shin pad on the lower shin, just above the ankle
- Recline the back pad if possible: more stretch on the quads
- Hold the handles, hips down in the seat
- Start with knees bent about 90° or deeper

Execution
- Extend smoothly with the quads, no kicking
- Squeeze hard near full extension, don't snap the knees
- Lower slowly to the deepest bend you can control
- Hips and back stay still against the seat

Breathing & tempo
- Exhale as you extend, inhale as you lower
- About 1 s up, 1 s squeeze, 2–3 s down
- Keep tension at the bottom, no resting

Common mistakes
- Hips lift off the seat → hold the handles, lighten the load
- Swinging the weight up → control both directions
- Knee not lined up with the pivot → re-adjust back pad and shin pad
- Stack slams down → slow down the lowering
- Skipping the stretch → use the deepest range you can control

Programming tips
- Hypertrophy: 3–4 sets of 10–15 reps, 0–2 reps in reserve
- Not a strength lift; keep it mostly at 8+ reps
- Rest 1–2 min between sets
- Progress: add reps, then one plate; last set can go to failure`,
  },
  {
    name: 'Lying Leg Curl (Machine)',
    photos: photos('Lying_Leg_Curls', 'Start: legs straight, pad just above the heels', 'Top: curled up, hips still pressed down'),
    muscles: 'Hamstrings, calves assist',
    links: [
      'https://www.acefitness.org/resources/everyone/exercise-library/153/lying-hamstrings-curl/',
      'https://barbend.com/lying-leg-curl/',
    ],
    cues: `Setup
- Lie face down, knee joint lined up with the pivot
- Pad on the lower calves, just above the heels
- Kneecaps just off the edge of the bench, legs nearly straight
- Hold the handles, hips pressed into the pad

Execution
- Curl the heels toward the glutes, past 90°
- Keep hips down by pressing the thighs into the pad
- Squeeze briefly at the top
- Lower slowly to nearly straight legs

Breathing & tempo
- Exhale as you curl, inhale as you lower
- About 1 s up, 1 s squeeze, 2–3 s down
- Smooth, no momentum at the bottom

Common mistakes
- Hips lift off the pad → lighten the load, press hips down
- Lower back arches → brace abs, reduce the weight
- Partial reps → full stretch at the bottom, curl past 90°
- Jerking the weight up → slow, controlled reps

Programming tips
- Hypertrophy: 3–4 sets of 8–15 reps, 0–2 reps in reserve
- Rest 1–2 min between sets
- Progress: add reps, then add load in small steps
- If available, seated leg curls tend to grow hamstrings more`,
  },
  {
    name: 'Pec Deck (Machine)',
    photos: photos('Butterfly', 'Squeeze: handles together in front of the chest', 'Stretch: arms open, elbows slightly bent'),
    muscles: 'Chest, front delts',
    links: [
      'https://www.strengthlog.com/machine-chest-fly/',
      'https://gravitus.com/guides/exercises/machine-fly',
    ],
    cues: `Setup
- Seat so elbows sit level with or just below shoulders
- Set the start lever for a chest stretch, not a shoulder stretch
- Head, upper back and hips flat on the pad
- Feet flat, slight bend in the elbows

Execution
- Sweep the handles together in a wide arc in front of the chest
- Keep the elbow bend fixed the whole set
- Squeeze about 1 s when the handles nearly touch
- Open slowly back to a full chest stretch

Breathing & tempo
- Exhale as you bring the handles together
- Inhale as you open to the stretch
- About 1 s in, 1 s squeeze, 2–3 s back
- Don't let the stack touch between reps

Common mistakes
- Seat too low → raise it so elbows are near shoulder height
- Shoulders roll off the pad → upper back pinned, go lighter
- Lever set too far back → shorten the start; stretch chest, not shoulder
- Elbows bending/straightening → lock the angle, reduce weight
- Jerking from the stretch → start each rep smooth, no momentum

Programming tips
- Hypertrophy: 2–3 sets × 10–15 reps, 0–2 reps in reserve
- Not a strength lift; heavy low reps strain the elbows
- Rest 1–2 min
- 15 reps on every set → add a plate, drop to 10`,
  },
  {
    name: 'Shoulder Press (Machine)',
    photos: photos('Machine_Shoulder_Military_Press', 'Start: handles at shoulder height', 'Top: arms nearly straight overhead'),
    muscles: 'Front delts, triceps, side delts, upper chest',
    links: [
      'https://www.strengthlog.com/machine-shoulder-press/',
      'https://gravitus.com/guides/exercises/shoulder-press-machine',
    ],
    cues: `Setup
- Seat so the handles start at shoulder height
- Back and head against the pad, feet planted
- Neutral or overhand grip, wrists stacked over forearms
- Elbows slightly in front of your body
- Note your seat notch so you can reuse it

Execution
- Brace abs, press up until arms are nearly straight
- Let the shoulder blades move up naturally with the press
- Hips and back stay on the pad
- Lower under control to shoulder height

Breathing & tempo
- Breathe in and brace before each press
- Exhale through the top of the press
- About 1–2 s up, 2–3 s down
- Stop just before the stack touches

Common mistakes
- Seat too low → raise it so the bottom of the rep isn't cut off
- Arching off the pad → brace abs, back on the pad
- Shrugging before pressing → start each rep with shoulders relaxed
- Elbows flared behind the body → keep elbows slightly forward
- Dropping the weight → lower over 2–3 s

Programming tips
- Hypertrophy: 3–4 sets × 8–12 reps, 0–2 reps in reserve
- Strength: 3–5 sets × 5–8 reps, still controlled
- Rest 2–3 min
- 12 reps on every set → one pin heavier, drop to 8
- Neutral handles are usually easier on sore shoulders`,
  },
  {
    name: 'Triceps Pushdown (Cable - Straight Bar)',
    photos: photos('Triceps_Pushdown', 'Top: forearms about level, elbows pinned', 'Bottom: arms fully straight, triceps squeezed'),
    muscles: 'Triceps',
    links: [
      'https://www.strengthlog.com/tricep-pushdown/',
      'https://gravitus.com/guides/exercises/pushdown',
    ],
    cues: `Setup
- Pulley at the top, straight bar attached
- Overhand grip about shoulder width, wrists straight
- Stand close, feet hip-width, slight lean from the hips
- Pull the bar down until elbows are pinned at your sides

Execution
- Only the elbows move; upper arms stay still
- Push down until the arms are fully straight
- Squeeze the triceps briefly at the bottom
- Let the bar rise until forearms are about level with the floor

Breathing & tempo
- Exhale as you push down
- Inhale as the bar comes up
- About 1 s down, 2 s up
- Keep tension at the top; plates shouldn't touch

Common mistakes
- Elbows drift forward → pin them to your sides
- Leaning over the bar → stand taller, use less weight
- Wrists bending back → keep wrists straight or use a V-bar
- Cutting the top short → let forearms come back to level
- Bar flying up → control the return

Programming tips
- Hypertrophy: 3–4 sets × 8–15 reps, 0–2 reps in reserve
- Heavy low-rep sets often bother elbows; stay moderate-high reps
- Rest 1–2 min; do it after your presses
- Top of the range on every set → one pin heavier, restart low`,
  },
  {
    name: 'Lateral Raise (Dumbbell)',
    photos: photos('Side_Lateral_Raise', 'Start: dumbbells at your sides', 'Top: arms at shoulder height, slight elbow bend'),
    muscles: 'Side delts, front delts, upper traps',
    links: [
      'https://www.strengthlog.com/dumbbell-lateral-raise/',
      'https://gravitus.com/guides/exercises/dumbbell-lateral-raise',
    ],
    cues: `Setup
- Pick a weight you can raise for 10+ strict reps
- Feet hip-width, dumbbells at your sides, palms in
- Slight bend in the elbows, fixed for the whole set
- Brace abs, chest tall, shoulders down

Execution
- Raise the arms out to the sides, leading with the elbows
- Stop at about shoulder height, palms facing the floor
- Straight out or up to 30° forward both work
- Lower slowly to your sides

Breathing & tempo
- Exhale on the way up
- Inhale on the way down
- About 1–2 s up, 2–3 s down
- No bounce at the bottom

Common mistakes
- Swinging with hips/back → go lighter, torso still
- Shrugging → shoulders down, away from the ears
- Elbows bent to 90° → keep just a slight bend
- Thumbs down ("pouring the jug") → palms down or neutral
- Raising far above the shoulders → stop at shoulder height

Programming tips
- Hypertrophy: 3–4 sets × 10–20 reps, 0–2 reps in reserve
- Not a strength lift; light and strict wins
- Rest 1–2 min
- Add reps first; dumbbell jumps are big for this muscle`,
  },
  {
    name: 'Triceps Extension (Cable)',
    photos: photos('Cable_Rope_Overhead_Triceps_Extension', 'Stretch: elbows bent behind the head, arms by the ears', 'End: arms straight overhead'),
    muscles: 'Triceps (long head emphasis)',
    links: [
      'https://www.strengthlog.com/overhead-cable-triceps-extension/',
      'https://gravitus.com/guides/exercises/overhead-tricep-rope-extension',
    ],
    cues: `Setup
- Rope on the pulley at head height or a bit higher
- Face away, step out until the weight lifts
- Split stance, slight lean forward from the hips
- Upper arms beside your ears, rope ends beside the head

Execution
- Start with elbows bent at least 90° for a stretch
- Upper arms stay still; only the elbows move
- Straighten the arms fully; spread the rope ends slightly
- Return slowly to the deep stretch

Breathing & tempo
- Brace before the first rep so you aren't pulled back
- Exhale as you extend
- Inhale as you lower into the stretch
- About 1 s out, 2 s back; stack never touches

Common mistakes
- Elbows flare wide → point them forward, lighten the load
- Upper arms drop (pullover) → keep them by your ears
- Stopping short of the stretch → bend to at least 90°
- Lower back arching → brace abs, or kneel/sit
- Getting pulled backward → step farther out, stagger feet more

Programming tips
- Hypertrophy: 3–4 sets × 8–15 reps, 0–2 reps in reserve
- Avoid heavy low reps; elbows don't like them here
- Rest 1–2 min
- Overhead work grew triceps more than pushdowns in one study`,
  },
  {
    name: 'Reverse Fly (Machine)',
    photos: photos('Reverse_Machine_Flyes', 'Start: arms forward, chest on the pad', 'End: arms swept out in line with the body'),
    muscles: 'Rear delts, rotator cuff, mid/upper traps, rhomboids',
    links: [
      'https://www.strengthlog.com/reverse-machine-fly/',
      'https://barbend.com/reverse-pec-deck/',
    ],
    cues: `Setup
- Face the pad, chest against it
- Seat so the arms are parallel to the floor
- Handles in the narrowest position for full range
- Neutral (palms in) grip usually hits rear delts best

Execution
- Slight elbow bend, fixed throughout
- Sweep the arms out and back until in line with the body
- Think "part the air", not "pinch the shoulder blades"
- Return slowly until the handles nearly meet

Breathing & tempo
- Exhale as you sweep out
- Inhale as you return
- About 1–2 s out, brief hold, 2–3 s back
- Keep tension; don't rest at the front

Common mistakes
- Too heavy, traps/lats take over → lighter, feel the rear delts
- Seat too low → raise until arms are level with shoulders
- Pinching shoulder blades first → lead with the arms
- Chest leaving the pad → stay pressed in, no rocking

Programming tips
- Hypertrophy: 3–4 sets × 12–15 reps (up to 20)
- Beginners: 1–2 sets × 10–15 light reps
- Rest 1–2 min
- Add reps before weight; small jumps only`,
  },
  {
    name: 'Bicep Curl (Dumbbell)',
    photos: photos('Dumbbell_Bicep_Curl', 'Start: arms straight at your sides', 'Top: curled, elbows still at your sides'),
    muscles: 'Biceps, brachialis, forearm flexors',
    links: [
      'https://www.strengthlog.com/dumbbell-curl/',
      'https://gravitus.com/guides/exercises/dumbbell-curl',
    ],
    cues: `Setup
- Feet hip-width, knees soft, chest up
- Dumbbells at your sides, arms straight
- Shoulders slightly back and down, light core brace
- Palms forward (or turn them up once clear of the thighs)

Execution
- Elbows stay at your sides; only the elbows bend
- Palms face up by the time forearms are level
- Curl until forearms meet biceps, squeeze briefly
- Lower until the arms are fully straight

Breathing & tempo
- Exhale as you curl up
- Inhale as you lower
- About 1 s up, 2–3 s down
- Wrists straight throughout

Common mistakes
- Swinging torso/hips → go lighter, stand still
- Elbows drifting forward → keep them by your sides
- Half reps at the bottom → straighten the arms every rep
- Palms half-turned → rotate fully palm-up
- Bent wrists → keep wrists neutral and firm

Programming tips
- Hypertrophy: 3 sets × 8–15 reps, 0–2 reps in reserve
- Low reps (1–5) suit curls poorly and invite cheating
- Rest 1–2 min
- Top of the range on every set → +2.5 kg, restart low`,
  },
  {
    name: 'Calf Press on Leg Press',
    photos: photos('Calf_Press_On_The_Leg_Press_Machine', 'Stretch: heels lowered, balls of the feet on the edge', 'Top: pressed onto the balls of the feet'),
    muscles: 'Calves (gastrocnemius, soleus)',
    links: [
      'https://www.strengthlog.com/calf-raise-in-leg-press/',
      'https://gravitus.com/guides/exercises/calf-press-on-leg-press',
    ],
    cues: `Setup
- Set the safety stops one notch below your lowest heel drop
- Back and hips flat on the pad
- Balls of the feet on the platform's bottom edge, heels off
- Feet hip-width, toes forward
- Place feet before unracking; never move feet when loaded

Execution
- Legs straight but knees not locked
- Lower the heels to a deep calf stretch, pause 1–2 s
- Press through the balls of the feet as high as possible
- Only the ankles move; knees stay still
- Rack the sled before moving your feet

Breathing & tempo
- Exhale as you press up
- Inhale as you lower into the stretch
- About 1 s up, 1 s squeeze, 2 s down, pause at the bottom
- No bouncing out of the stretch

Common mistakes
- Bouncing at the bottom → pause in the stretch every rep
- Knees bending (mini leg press) → keep knees fixed
- On toe tips → keep the ball of the foot on the edge
- Heels on the platform → slide down so heels hang free

Programming tips
- Hypertrophy: 3–4 sets × 10–20 reps, 0–2 reps in reserve
- Calves respond well to 2–3 sessions per week
- Rest 1–2 min
- Every set hits 20 → add ~5 kg per side, drop to ~12`,
  },
  {
    name: 'Seated Row (Cable)',
    photos: photos('Seated_Cable_Rows', 'Stretch: arms long, back neutral', 'End: handle to the stomach, shoulder blades squeezed'),
    muscles: 'Lats, mid traps, rhomboids, rear delts, biceps',
    links: [
      'https://barbend.com/seated-cable-row/',
      'https://gravitus.com/guides/exercises/seated-cable-row',
    ],
    cues: `Setup
- V-handle on the low pulley, cable not twisted
- Feet on the platform, knees slightly bent
- Neutral grip, slide back until the weight lifts
- Chest up, lower back neutral (not rounded)

Execution
- Sit upright, drive the elbows back along your sides
- Pull the handle to your stomach, squeeze shoulder blades
- Reach forward slightly into the stretch, back stays neutral
- Torso mostly still; arms and shoulder blades move

Breathing & tempo
- Breathe in and brace before each pull
- Exhale as you pull to your stomach
- About 1 s pull, brief squeeze, 2–3 s return
- Control the stretch; don't get yanked forward

Common mistakes
- Leaning back to finish → weight too heavy, reduce it
- Rounding the lower back at the stretch → reach less, chest up
- Shrugging toward the ears → shoulders down
- Pulling with the arms only → lead with the elbows
- Pushing with the legs → legs still, no sliding

Programming tips
- Hypertrophy: 3–4 sets × 8–15 reps, 0–2 reps in reserve
- Strength: 3–5 sets × 5–10 reps, strict form
- Rest 1.5–3 min
- 12 reps on every set → one pin heavier, drop to 8`,
  },
  {
    name: 'Bicep Curl (Barbell)',
    photos: photos('Barbell_Curl', 'Start: bar at the thighs, arms straight', 'Top: curled up, body still'),
    muscles: 'Biceps, brachialis, forearm flexors',
    links: [
      'https://www.strengthlog.com/barbell-curl/',
      'https://gravitus.com/guides/exercises/barbell-curl',
    ],
    cues: `Setup
- Stand tall, feet hip-width, knees soft, core braced
- Underhand grip about shoulder width, hands outside the thighs
- Bar deep in the palms, wrists straight
- Forearms hang straight down from the elbows

Execution
- Curl by bending at the elbows; body stays still
- Elbows at your sides until the bar passes halfway
- A small elbow rise at the very top is fine
- Lower until the bar touches the thighs, no bounce

Breathing & tempo
- Exhale as you curl up
- Inhale as you lower
- About 1 s up, 2–3 s down
- Keep tension at the bottom of each rep

Common mistakes
- Swinging from rep one → reduce the weight, stay strict
- Elbows forward at the start → keep them pinned early
- Wrists bending back → keep the bar deep in the palms
- Wrists hurt → switch to an EZ bar

Programming tips
- Hypertrophy: 3–4 sets × 6–12 reps (up to 15), 0–2 reps in reserve
- Rest 1–2 min
- Top of the range on every set → smallest plates, restart low
- Cheat reps only on the last set, if at all`,
  },
  {
    name: 'Preacher Curl (Machine)',
    photos: photos('Machine_Preacher_Curls', 'Start: arms nearly straight on the pad', 'Top: curled, elbows down on the pad'),
    muscles: 'Biceps, brachialis, forearm flexors',
    links: [
      'https://www.strengthlog.com/machine-bicep-curl/',
      'https://gravitus.com/guides/exercises/bicep-curl-machine',
    ],
    cues: `Setup
- Adjust the seat so the elbows line up with the machine pivot
- Backs of the upper arms flat on the pad
- Underhand grip, wrists straight, arms nearly straight
- Test with two light reps; handles shouldn't slide

Execution
- Curl by bending only at the elbows
- Curl until forearms are close to vertical, squeeze briefly
- Elbows and shoulders stay down on the pad
- Lower to nearly straight arms, under control

Breathing & tempo
- Exhale as you curl
- Inhale as you lower
- About 1 s up, 2–3 s down
- Stop just before the plates touch the stack

Common mistakes
- Seat too high (pivot at the armpits) → lower it to the elbows
- Half reps at the bottom → lower to nearly straight arms
- Elbows lifting off the pad → reduce weight, arms down
- Leaning back to finish → lighten the load, stay upright
- Wrists curling at the top → keep wrists neutral

Programming tips
- Hypertrophy: 3 sets × 8–15 reps, 0–2 reps in reserve
- Good finisher after free-weight curls
- Rest 1–2 min; use the same seat notch every session
- Top of the range on every set → one pin heavier, restart low`,
  },
];

// Routine templates (the user's Strong routines). Created once automatically if a
// routine with the same name doesn't exist, and re-addable from Settings. A Strong
// import replaces an untouched template of the same name.
export const STARTER_ROUTINES = [
  {
    name: 'Push',
    exercises: ['Pec Deck (Machine)', 'Shoulder Press (Machine)', 'Incline Bench Press (Dumbbell)', 'Triceps Pushdown (Cable - Straight Bar)', 'Lateral Raise (Dumbbell)', 'Triceps Extension (Cable)'],
  },
  {
    name: 'Pull',
    exercises: ['Lat Pulldown (Cable)', 'Iso-Lateral Row (Machine)', 'Reverse Fly (Machine)', 'Hammer Curl (Dumbbell)', 'Bicep Curl (Dumbbell)'],
  },
  {
    name: 'Legs',
    exercises: ['Squat (Barbell)', 'Bulgarian Split Squat', 'Leg Extension (Machine)', 'Lying Leg Curl (Machine)', 'Calf Press on Leg Press'],
  },
  {
    name: 'Workout A',
    exercises: ['Squat (Barbell)', 'Bench Press (Barbell)', 'Bent Over Row (Barbell)'],
  },
  {
    name: 'Biceps',
    exercises: ['Deadlift (Barbell)', 'Seated Row (Cable)', 'Lat Pulldown (Cable)', 'Bicep Curl (Barbell)', 'Preacher Curl (Machine)'],
    // Added by the user on top of their Strong routine: appended to an existing "Biceps" routine too.
    ensure: ['Preacher Curl (Machine)'],
  },
];
