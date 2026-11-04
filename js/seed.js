// Default cues and reference photos for common lifts. Names match Strong's naming
// so they attach to exercises imported from a Strong export. Photos are bundled in
// defaults/images (public domain, see defaults/CREDITS.md).

const photos = (id, ...captions) => captions.map((caption, i) => ({ src: `defaults/images/${id}/${i}.jpg`, caption }));

export const STARTER = [
  {
    name: 'Squat (Barbell)',
    photos: photos('Barbell_Squat', 'Top: standing tall, bar on upper back', 'Bottom: hips just below knees, chest up'),
    muscles: 'Quads, glutes, adductors',
    cues: `Setup
- Bar on upper traps (high bar) or rear delts (low bar), hands just outside shoulders
- Feet shoulder width, toes out 15–30°
- Big breath into the belly, brace before each rep

Execution
- Break at hips and knees together, knees track over toes
- Sit down between your heels, chest stays up
- Hit at least parallel (hip crease at knee level)
- Drive up through mid-foot, keep the bar over mid-foot

Common mistakes
- Knees caving in → push them out
- Heels lifting → sit back more, check ankle mobility
- Good-morning out of the hole → lead with the chest`,
  },
  {
    name: 'Bench Press (Barbell)',
    photos: photos('Barbell_Bench_Press_-_Medium_Grip', 'Top: arms locked, bar over shoulders', 'Bottom: bar touches lower chest'),
    muscles: 'Chest, front delts, triceps',
    cues: `Setup
- Eyes under the bar, shoulder blades squeezed back and down
- Slight arch, feet planted, glutes on the bench
- Grip ~1.5× shoulder width, wrists stacked over elbows

Execution
- Unrack, bar over shoulders
- Lower to lower chest / sternum, elbows ~45–70° from torso
- Touch, then press up and slightly back toward the face
- Keep shoulder blades pinned the whole set

Common mistakes
- Elbows flared at 90° → tuck slightly
- Bouncing off the chest → controlled touch
- Butt leaving the bench`,
  },
  {
    name: 'Deadlift (Barbell)',
    photos: photos('Barbell_Deadlift', 'Setup: bar over mid-foot, back flat', 'Lockout: standing tall, glutes squeezed'),
    muscles: 'Hamstrings, glutes, back',
    cues: `Setup
- Bar over mid-foot (~3 cm from shins), feet hip width
- Hinge down, grip just outside legs
- Shins touch bar, chest up, lats tight ("protect your armpits")
- Brace hard, take the slack out of the bar

Execution
- Push the floor away, bar drags up the legs
- Hips and shoulders rise together
- Finish standing tall, glutes squeezed — no leaning back
- Lower by pushing hips back first, then bend knees past them

Common mistakes
- Hips shooting up first
- Rounded lower back → reset, brace, lighter weight
- Bar drifting away from the body`,
  },
  {
    name: 'Overhead Press (Barbell)',
    photos: photos('Standing_Military_Press', 'Start: bar on front delts', 'Lockout: bar over mid-foot'),
    muscles: 'Shoulders, triceps, upper chest',
    cues: `Setup
- Grip just outside shoulders, forearms vertical
- Bar on front delts, elbows slightly in front of the bar
- Squeeze glutes and quads, brace

Execution
- Press straight up, move the head back out of the way
- Once the bar passes the forehead, push the head "through the window"
- Lockout with bar over mid-foot, shrug up at the top

Common mistakes
- Leaning back excessively → squeeze glutes harder
- Bar path looping forward around the face`,
  },
  {
    name: 'Bent Over Row (Barbell)',
    photos: photos('Bent_Over_Barbell_Row', 'Start: hinged, arms long', 'Top: bar pulled to lower ribs'),
    muscles: 'Upper back, lats, biceps',
    cues: `Setup
- Hinge to ~45°, soft knees, flat back
- Grip a bit wider than shoulders

Execution
- Pull to the lower ribs / belly button
- Lead with the elbows, squeeze shoulder blades together
- Lower under control to a full stretch

Common mistakes
- Standing up more each rep → keep torso angle fixed
- Jerking the weight with the hips`,
  },
  {
    name: 'Romanian Deadlift (Barbell)',
    photos: photos('Romanian_Deadlift', 'Bottom: hips back, bar below knees', 'Top: standing, soft knees'),
    muscles: 'Hamstrings, glutes',
    cues: `Setup
- Start standing with the bar, soft knees (fixed bend)

Execution
- Push hips straight back, bar slides down the thighs
- Go until you feel a strong hamstring stretch (usually just below knee)
- Back stays flat, then drive hips forward to stand

Common mistakes
- Bending the knees more as you go down (turns into a squat)
- Rounding the back to reach lower`,
  },
  {
    name: 'Lat Pulldown (Cable)',
    photos: photos('Wide-Grip_Lat_Pulldown', 'Start: arms long, slight lean back', 'Bottom: bar to upper chest'),
    muscles: 'Lats, biceps',
    cues: `Setup
- Thighs locked under the pad, grip slightly wider than shoulders
- Slight lean back

Execution
- Start by pulling shoulders down, then drive elbows to your sides
- Bar to upper chest, chest up to meet it
- Control the way up to a full stretch

Common mistakes
- Pulling behind the neck
- Swinging the torso to move the weight`,
  },
  {
    name: 'Pull Up',
    photos: photos('Pullups', 'Start: dead hang', 'Top: chin over the bar'),
    muscles: 'Lats, biceps, upper back',
    cues: `Execution
- Dead hang, then pull shoulders down and back
- Drive elbows down toward hips, chest to the bar
- Chin clears the bar, lower all the way under control

Common mistakes
- Half reps → full hang at the bottom
- Kipping / swinging`,
  },
  {
    name: 'Seated Overhead Press (Dumbbell)',
    photos: photos('Seated_Dumbbell_Press', 'Top: arms extended, dumbbells over shoulders', 'Bottom: dumbbells at ear / shoulder level'),
    muscles: 'Shoulders, triceps',
    cues: `Setup
- Bench upright (80–90°), back and head on the pad
- Dumbbells at shoulder height, palms forward, forearms vertical
- Feet planted wide, brace your core

Execution
- Press up and slightly in, dumbbells meet above the head without clanking
- Lower under control until dumbbells reach ear / shoulder level
- Keep ribs down: don't arch the lower back off the pad

Common mistakes
- Elbows flaring straight out to the sides → keep them slightly forward
- Half reps at the bottom
- Leaning back to turn it into an incline press`,
  },
  {
    name: 'Incline Bench Press (Barbell)',
    photos: photos('Barbell_Incline_Bench_Press_-_Medium_Grip', 'Top: arms locked over the shoulders', 'Bottom: bar touches upper chest'),
    muscles: 'Upper chest, front delts, triceps',
    cues: `Setup
- Bench at 30–45°, eyes under the bar
- Shoulder blades back and down, feet planted
- Grip slightly wider than shoulders

Execution
- Lower to the upper chest (just below the collarbone)
- Elbows ~45–60° from the torso
- Press straight up over the shoulders

Common mistakes
- Bench too steep → turns into a shoulder press
- Bouncing the bar off the chest
- Shoulders rolling forward at the top`,
  },
  {
    name: 'Incline Bench Press (Dumbbell)',
    photos: photos('Incline_Dumbbell_Press', 'Bottom: dumbbells at upper chest, elbows under wrists', 'Top: arms extended over the chest'),
    muscles: 'Upper chest, front delts, triceps',
    cues: `Setup
- Bench at 30–45°, kick the dumbbells up off your knees one at a time
- Shoulder blades squeezed back, feet planted

Execution
- Lower until dumbbells are beside the upper chest, deep stretch
- Wrists stacked over elbows, elbows ~45° from torso
- Press up and slightly together, don't clank at the top

Common mistakes
- Elbows flared at 90°
- Cutting the range short at the bottom
- Dropping the dumbbells to the side when finished → bring them back to your knees`,
  },
  {
    name: 'Iso-Lateral Row (Machine)',
    photos: photos('Leverage_Iso_Row', 'Start: arms long, chest on the pad', 'End: elbows driven back, shoulder blades squeezed'),
    muscles: 'Lats, upper back, biceps',
    cues: `Setup
- Seat height so handles are at mid/lower chest
- Chest firmly on the pad the whole set

Execution
- Start by pulling the shoulder blades back, then drive elbows behind you
- Pause and squeeze at the back
- Return slowly to a full stretch, let the shoulder blades come forward

Common mistakes
- Chest coming off the pad to cheat the weight
- Shrugging the shoulders up to the ears
- Short range: no stretch at the front`,
  },
  {
    name: 'Face Pull (Cable)',
    photos: photos('Face_Pull', 'Start: arms extended toward the pulley', 'End: rope at the face, hands apart, elbows high'),
    muscles: 'Rear delts, upper back, rotator cuff',
    cues: `Setup
- Rope on a high pulley (about forehead height)
- Overhand or thumbs-back grip, step back, slight lean

Execution
- Pull toward the forehead, pulling the rope apart
- Elbows high and out, finish with the hands beside the ears ("double biceps" pose)
- Pause, then return slowly

Common mistakes
- Going too heavy and leaning back to row it
- Elbows dropping → it turns into a row
- Rushing the return`,
  },
  {
    name: 'Hammer Curl (Dumbbell)',
    photos: photos('Hammer_Curls', 'Start: arms straight, palms facing in', 'Top: curled up, elbows still by your sides'),
    muscles: 'Biceps, brachialis, forearms',
    cues: `Setup
- Stand tall, dumbbells at your sides, palms facing each other

Execution
- Curl up keeping palms facing in (like holding a hammer)
- Elbows stay pinned to your sides
- Lower slowly all the way down

Common mistakes
- Swinging the body to lift the weight
- Elbows drifting forward
- Dropping the weight on the way down`,
  },
  {
    name: 'Bulgarian Split Squat',
    photos: photos('Split_Squat_with_Dumbbells', 'Top: rear foot on the bench, standing tall', 'Bottom: back knee near the floor, front shin fairly vertical'),
    muscles: 'Quads, glutes, adductors',
    cues: `Setup
- Rear foot laces-down on a bench, front foot about a big step forward
- Test the stance: at the bottom the front heel stays down

Execution
- Lower straight down until the back knee nearly touches the floor
- Most weight on the front foot, drive up through the whole front foot
- Slight forward lean = more glutes, upright torso = more quads

Common mistakes
- Front foot too close → heel lifts, knee pain
- Pushing off the back leg
- Front knee caving in`,
  },
  {
    name: 'Leg Extension (Machine)',
    photos: photos('Leg_Extensions', 'Start: knees bent ~90°, pad on lower shins', 'Top: legs straight, quads squeezed'),
    muscles: 'Quads',
    cues: `Setup
- Knee joint lined up with the machine's pivot
- Pad on the lower shin just above the ankles
- Hold the handles, hips down in the seat

Execution
- Extend until the legs are straight, squeeze the quads for a second
- Lower under control, don't let the stack slam

Common mistakes
- Kicking the weight up with momentum
- Hips lifting off the seat
- Partial reps`,
  },
  {
    name: 'Lying Leg Curl (Machine)',
    photos: photos('Lying_Leg_Curls', 'Start: legs straight, pad just above the heels', 'Top: curled up, hips still pressed down'),
    muscles: 'Hamstrings',
    cues: `Setup
- Knees just off the end of the bench, lined up with the pivot
- Pad on the back of the ankles, above the heels
- Hold the handles, hips pressed into the pad

Execution
- Curl the heels toward the glutes
- Squeeze at the top, then lower slowly to almost straight

Common mistakes
- Hips rising off the pad
- Swinging the weight up
- Letting the weight drop on the way down`,
  },
];
