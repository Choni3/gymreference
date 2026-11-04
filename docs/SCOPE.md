# GymReference: scope

## Problem

Strong tracks sets and reps well, but its exercise descriptions are short. While
still learning the movements, I want a quick reminder of technique *at the gym*:
lots of photos (often frames grabbed from tutorial videos) plus my own cues and
advice, organised by the routine I'm running that day.

## Goals (MVP)

1. **Works on iPhone, lightweight.** Opens fast from the home screen, works
   offline in a basement gym, no App Store, no account.
2. **Routines.** Create routines (e.g. "Push A") with an ordered list of
   exercises, and target sets × reps per exercise.
3. **Exercise reference card.** Per exercise: a photo gallery, technique cues
   (setup / execution / common mistakes), free notes, and links to videos.
4. **Lots of photos, easily.**
   - Add many photos at once from the camera roll (screenshots of videos).
   - **Grab frames from a video**: pick a video, scrub to the right moment,
     tap "Capture frame". Repeat for each key position.
   - Each photo can have a short caption ("bottom position, knees out").
   - Photos are downscaled/compressed on device so storage stays small.
5. **Defaults + personal additions.** Known lifts come with default cues; adding
   photos, video frames or a quick dated note is one tap from the exercise page.
6. **Get started quickly.**
   - Import routines and exercise names from a Strong CSV export.
   - Optional starter cues for common lifts.
7. **Don't lose data.** Export / import a full backup file (includes photos).

## Non-goals (for now)

- Logging sets/weights (Strong already does it).
- Accounts, cloud sync, sharing between devices (backup file covers it).
- Native iOS app / App Store.
- Storing whole videos (frames are enough and far lighter).

## Approach

A static **Progressive Web App**: plain HTML/CSS/JS ES modules, no build step,
no framework, no backend.

| Concern | Choice | Why |
| --- | --- | --- |
| Hosting | GitHub Pages | Free, HTTPS (needed for PWA), zero ops |
| Storage | IndexedDB on device | Holds photo blobs; works offline |
| Offline | Service worker, cache-first app shell | Gym connectivity is bad |
| iOS install | "Add to Home Screen" + `apple-mobile-web-app-*` meta | Full-screen, app-like |
| Persistence | `navigator.storage.persist()` + backup export | Safari can evict site data for non-installed sites; home-screen apps are exempt |
| Images | Canvas downscale to 1600px max, JPEG q≈0.82 | ~150–300 KB per photo |
| Video frames | `<video>` + seek + `canvas.drawImage` | Runs fully on device |

### Data model (IndexedDB `gymreference`)

- `exercises`: `{ id, name, muscles, cues, notes, links[], photoIds[], updatedAt }`
- `routines`: `{ id, name, items: [{ exerciseId, sets, reps, note }], updatedAt }`
- `photos`: `{ id, blob, caption }`

### Screens

- **Home**: routine list, "All exercises", settings.
- **Routine**: ordered exercise cards with first photo + sets × reps. Tap → exercise.
  Edit mode: add/remove/reorder exercises, edit sets/reps.
- **Exercise**: swipeable photo gallery with captions, cues, notes, links.
- **Exercise edit**: fields, add photos, grab frames from video, caption/reorder/delete photos.
- **Settings**: Strong CSV import, starter cues, backup export/import, storage usage.

## Later ideas

- iCloud/Drive sync via backup file automation, or a tiny backend.
- "Today" mode: step through the routine one exercise at a time with big photos.
- Short looping clips (GIF-like) instead of single frames.
- Search/filter by muscle group.

## Risks

- **iOS storage eviction** if used from a Safari tab rather than the home
  screen. Mitigation: ask for persistent storage, nudge to install, backup export.
- **Strong CSV format drift** (delimiter, column names). Mitigation: detect
  delimiter, match columns by header name, fail with a clear message.
- **HEIC photos / large videos**: Safari decodes HEIC itself when drawn to a
  canvas; frames are grabbed without uploading the video anywhere.
