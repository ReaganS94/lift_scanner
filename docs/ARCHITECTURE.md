# Lift Scanner architecture

Lift Scanner reviews a recorded set of a barbell lift and reports, rep by rep, what
the lifter's form looked like. It runs entirely in the phone's browser: the video
never leaves the device, and there is no server.

This document describes how the code is organised and why. It is the reference for
where new code goes. If a change doesn't fit the structure below, update this
document in the same pull request.

## Goals

- **Review after the set, not during it.** The user records a set, then opens the
  clip in the app.
- **Squat, deadlift and bench press first, more lifts later.** Adding a lift must not
  require touching the pipeline.
- **Readable by any developer.** Small single-purpose modules, clear boundaries,
  and a core that can be tested without a browser.
- **Free.** Free libraries, free hosting (GitHub Pages), no paid APIs.
- **Honest output.** When a check can't be measured reliably from a clip (wrong
  camera angle, body out of frame, low confidence), it is reported as skipped,
  never guessed.

## Non-goals (for now)

- Live feedback while lifting.
- Accounts, sync, or sharing.
- Detecting the barbell with a trained object model. The bar is followed through
  the near plate, found as a circle (see [Following the bar](#following-the-bar)),
  or the hands when the plate isn't found.

## How a clip becomes a report

```
 video file
     │
     ▼
 ┌──────────┐   frames    ┌──────────┐   raw poses   ┌──────────┐
 │  video   │ ──────────▶ │   pose   │ ────────────▶ │  signal  │
 │ (adapter)│             │ (adapter)│               │ smoothing│
 └──────────┘             └──────────┘               └────┬─────┘
                                                          │ clean pose sequence
                                                          ▼
                     ┌──────────┐   view    ┌──────────┐  reps  ┌──────────┐
                     │   view   │ ────────▶ │   reps   │ ─────▶ │  checks  │
                     │ detection│           │ segmenter│        │ (per lift)│
                     └──────────┘           └──────────┘        └────┬─────┘
                                                                     │
                                                                     ▼
                                                                ┌──────────┐
                                                                │  report  │
                                                                └──────────┘
```

1. **Video**: decode the user's file and step through it at a fixed sample rate.
2. **Pose**: run the pose model on each frame and get 33 body landmarks with a
   confidence score each.
3. **Signal**: fill short gaps, drop low-confidence points and smooth jitter.
4. **View**: work out whether the clip is a side view or a front/back view (the
   user can override this).
5. **Reps**: split the sequence into reps using a lift-specific signal, for
   example hip height for a squat.
6. **Checks**: run the lift's form checks on each rep. Each check declares which
   views it supports and is skipped on any other view.
7. **Report**: collect results into a report the UI renders and storage saves.

The orchestration lives in one place, `src/analysis/`, so the whole flow can be
read top to bottom in a single file.

## Folder layout

```
src/
  core/          Shared types and interfaces. No dependencies.
  geometry/      Pure maths: vectors, joint angles, segment angles.
  signal/        Pure maths on time series: smoothing, gap filling, peaks.
  view/          Camera view detection from a pose sequence.
  reps/          Generic rep segmentation driven by a signal.
  bar/           Follows the near plate (the bar's end) as a circle in the frame.
  lifts/         One folder per lift, plus the lift registry.
    registry.ts
    squat/
      index.ts         The lift definition (views, rep signal, checks).
      rep-signal.ts
      bottom.ts        Finds the bottom of a rep, shared by the side-view checks.
      checks/          One file per check, each with its own test.
        depth.ts
        torso-angle.ts
        knees-caving.ts
    deadlift/
      pull.ts          Finds the floor, liftoff and knee height, shared by the checks.
      checks/
        hips-rise-first.ts
        lockout.ts
        bar-path.ts
    bench/
      checks/
        touch-point.ts
        lockout.ts
        uneven-press.ts
  analysis/      The pipeline that wires the steps together.
  report/        The report model and its serialisation.
  adapters/      Code that talks to the outside world, behind interfaces
    pose/          from core/. Swappable and mockable.
      mediapipe-pose-estimator.ts
    video/
      video-frame-source.ts
    storage/
      indexeddb.ts
  ui/            React screens and components. The only layer that renders.
  testing/       Builders for fake pose data. Only tests may import it.
  main.tsx       App entry point: builds adapters and mounts the React app.
tests/
  fixtures/      Recorded pose sequences (JSON) from real clips.
docs/
  ARCHITECTURE.md
  adr/           Short records of decisions and why they were made.
```

### Dependency rules

Arrows point from a module to what it may import. Every layer may also import
`core`.

```
ui ──▶ analysis ──▶ view, reps, lifts ──▶ geometry ──▶ signal ──▶ core
 │         └──────▶ report ─────────────────────────────────────────▲
 └──▶ adapters ─────────────────────────────────────────────────────┘
```

| Layer                  | May import (besides itself and `core`)                  |
| ---------------------- | ------------------------------------------------------- |
| `core`                 | nothing                                                 |
| `geometry`             | `signal`                                                |
| `signal`               | nothing                                                 |
| `view`                 | `geometry`, `signal`                                    |
| `reps`                 | `geometry`, `signal`                                    |
| `lifts`                | `geometry`, `signal` (and never another lift's folder)  |
| `bar`                  | `geometry`, `signal`                                    |
| `report`               | nothing                                                 |
| `analysis`             | `geometry`, `signal`, `view`, `reps`, `lifts`, `report` |
| `adapters`             | nothing                                                 |
| `ui`                   | anything except `testing`                               |
| `testing` (tests only) | nothing; only `*.test.ts` files may import it           |

- `core`, `geometry`, `signal`, `view`, `reps`, `lifts`, `bar`, `analysis` and
  `report` are **pure TypeScript**. They don't touch the DOM, the camera, files or
  storage. That makes them fast to unit test in Node with recorded fixtures.
- Only `adapters` and `ui` touch browser APIs.
- `analysis` receives adapters as arguments (dependency injection), so tests can
  pass fakes.
- The image type that flows from a `FrameSource` to a `PoseEstimator` is a type
  parameter, so `core` never names a browser type. The adapters agree on it.

Three tools enforce this in CI, so a wrong import fails the build instead of
relying on review:

- `dependency-cruiser` checks the table above (`.dependency-cruiser.cjs`).
- `tsconfig.pure.json` type-checks the pure folders a second time without the DOM
  or Node type definitions, so `document`, `URL`, `setTimeout` and the like are
  type errors there.
- ESLint bans the common browser globals in the pure folders with a readable
  message.

## Coordinates

The pose model reports positions as fractions of the frame's width and height.
On a portrait 9:16 clip that squashes the x axis, so a true 45° angle would read
about 29° from horizontal (61° from vertical). To avoid that, **pose adapters convert landmarks into one shared unit,
the frame's height**: y runs from 0 (top) to 1 (bottom) and x from 0 to the
frame's aspect ratio. Distances and angles are then true to the image everywhere
downstream, and no other module needs to know the video's shape.
`PoseSequence.aspectRatio` is kept for drawing the skeleton over the video.

Distances are compared in **torso lengths** (median shoulder-to-hip distance over
the clip), so thresholds work whether the lifter is near or far from the camera.

## Key interfaces

These live in `src/core/` and are the contracts every other module is written
against. The code in `src/core/` is the source of truth; this is a summary.

```ts
type View = 'side' | 'front' | 'back';

interface Landmark {
  x: number; // 0..aspect ratio, in units of frame height (see Coordinates)
  y: number; // 0..1, grows downwards
  z: number; // model's depth estimate; treat as rough
  visibility: number; // 0..1 confidence
}

interface PoseFrame {
  timeMs: number;
  landmarks: Landmark[] | null; // null when no person was found
}

interface PoseSequence {
  sampleFps: number;
  aspectRatio: number;
  frames: PoseFrame[];
}

interface PoseEstimator<TImage> {
  init(): Promise<void>;
  estimate(frame: SampledFrame<TImage>, aspectRatio: number): Promise<PoseFrame>;
  dispose(): void;
}

// Every frame index in the app refers to the whole clip's PoseSequence.
interface Rep {
  index: number;
  startFrame: number; // last frame at rest before the rep
  turnFrame: number; // furthest from rest: squat bottom, bar on chest, deadlift lockout
  endFrame: number; // first frame back at rest
}

type CheckResult =
  | { checkId; status: 'pass' | 'warn' | 'fail'; message; value?; frameIndex? }
  | { checkId; status: 'skipped'; message }; // message says why

interface ClipContext {
  sequence: PoseSequence; // cleaned
  view: View; // confirmed by the user
  torsoLength: number;
}

interface RepContext extends ClipContext {
  rep: Rep;
}

interface FormCheck {
  id: string;
  label: string;
  supportedViews: View[];
  evaluate(context: RepContext): CheckResult;
}

interface LiftDefinition {
  id: string; // 'squat'
  name: string; // 'Back squat'
  supportedViews: View[];
  repSignal(clip: ClipContext): (number | null)[]; // see Rep detection
  repDetection: { minAmplitude: number; minDurationSeconds: number };
  checks: FormCheck[];
}
```

Each check is a small pure function of one `RepContext`, so it is easy to test on
its own.

### Rep detection

Each lift supplies a **rep signal**: per frame, how far the lifter is from their
rest position, in torso lengths. The rest position is where the lifter waits
between reps: standing for a squat, arms locked out for a bench press, bar on the
floor for a deadlift. So every lift's signal sits near 0 at rest and peaks once
per rep, whether the lift starts at the top (squat, bench) or the bottom
(deadlift), and one generic rep detector in `reps/` works for all of them.

| Lift     | Rep signal                             | Rest position |
| -------- | -------------------------------------- | ------------- |
| Squat    | Hip drop below standing                | Standing      |
| Deadlift | Shoulder rise above the floor position | Bar on floor  |
| Bench    | Hand (bar) drop below lockout          | Lockout       |

Because the signal is already in torso lengths from rest, the detector uses fixed
thresholds rather than fractions of the set's own peak, so a single heavy rep in
a long clip is found as reliably as a set of ten. A rep starts at the last frame
within 0.1 torso lengths of rest, must climb past the lift's minimum amplitude,
and ends at the first frame back within 0.1 of rest. The gap between those two
levels (hysteresis) stops jitter from splitting a rep. A rep only counts if the
lifter is seen at rest both before and after it, so a clip that starts or ends
mid-rep doesn't produce a half rep, and standing around before a deadlift isn't
mistaken for a lockout.

Touch-and-go reps don't return fully to rest between reps, so a rep also ends at
a bounce: a dip that comes back below the lift's minimum amplitude (close to
rest) and is at least half the minimum amplitude below the rep's peak, followed
by a climb of at least as much past the minimum amplitude. The next rep starts at
the bottom of that dip. Smaller wobbles, and a grinding rep that sinks back
partway through without getting near rest, don't split a rep.

The last rep of a clip may not get back to rest either: after the final
deadlift, a lifter often puts the bar down and stands straight up, so their
shoulders never return to the set position (in the first real clip they came
back to about 0.45 torso lengths above it). A rep still open when the clip ends
therefore counts if, after its peak, the signal came at least halfway back to
rest, and it ends at its lowest point after the peak. A clip cut off at or near
the top of a rep still doesn't count it.

## Adding a new lift

1. Create `src/lifts/<lift-name>/index.ts` exporting a `LiftDefinition`.
2. Put each check in its own file under `checks/`, with its thresholds as named
   constants at the top.
3. Register the lift in `src/lifts/registry.ts`.
4. Add a fixture from a real clip to `tests/fixtures/` and a test next to the lift.

Nothing in `analysis`, `ui` or `adapters` should need to change.

## Camera views

A single phone camera gives a flat image, so angles only read correctly when the
camera is roughly square to the movement. Each check declares the views it
supports:

| View         | Good for                                                        |
| ------------ | --------------------------------------------------------------- |
| Side         | Squat depth, torso angle, bar path, hip vs shoulder rise timing |
| Front / back | Knees caving in, left/right imbalance, stance and grip width    |
| ~45°         | Not supported. Most measurements are distorted.                 |

View detection compares apparent shoulder width to torso length. Shoulder width
shrinks with the cosine of the camera's angle off square-on (about 0.8 of torso
length when facing the camera), so the cut-offs accept up to 30° off square-on
and return no guess in between. It measures only frames where the torso looks
full length, because leaning towards the camera shortens the torso and would
skew the ratio. It runs on the raw poses, before cleanup drops the faint far
side of a side view. Front and back are told apart by whether the face is
visible and which shoulder appears on which side, and only a clear, agreeing
answer gets high confidence. The app shows its guess and lets the user correct
it, because a wrong view would make every check unreliable.

## Initial checks

These are starting points. Thresholds are tuned against real clips before they
are trusted.

| Lift     | Check                                  | View         |
| -------- | -------------------------------------- | ------------ |
| Squat    | Depth (hip crease vs top of knee)      | Side         |
| Squat    | Torso angle at the bottom              | Side         |
| Squat    | Knees caving in                        | Front / back |
| Deadlift | Hips rising before shoulders off floor | Side         |
| Deadlift | Full lockout (hips and knees extended) | Side         |
| Deadlift | Hands drifting away from the legs      | Side         |
| Bench    | Touch point (from wrists)              | Side         |
| Bench    | Full lockout                           | Side         |
| Bench    | Uneven press (one arm lagging)         | Front / back |
| All      | Rep tempo (time down and up)           | Any          |

### Squat checks

Built. Depth and torso angle need a side view and measure the near side of the
body at the bottom of the rep: the frame within 0.25 s of where the hips were
lowest that has the thigh furthest below parallel. Knees caving in needs a
front or back view and looks at every frame of the rep. These thresholds are
starting points, to be tuned on real clips.

| Check           | Measures                                                              | Pass                 | Warn            | Fail                |
| --------------- | --------------------------------------------------------------------- | -------------------- | --------------- | ------------------- |
| Depth           | Thigh angle, hip joint vs knee joint                                  | At parallel or below | Up to 10° above | More than 10° above |
| Torso angle     | Hip-to-shoulder lean from vertical                                    | Up to 55°            | Over 55°        | Never               |
| Knees caving in | Knee gap as a share of ankle gap, vs standing at the start of the rep | Narrows by up to 10% | 10% to 20%      | Over 20%            |

- **Depth** uses joint centres, because the model doesn't find the hip crease or
  the top of the knee. Hip joint level with the knee joint is a little shallower
  than the competition rule (hip crease below the top of the knee), so a rep
  that only just passes here might not pass in a meet.
- **Torso angle** never fails a rep. How far the torso leans mostly comes down to
  build (thigh length against torso length) and bar position, not technique, so
  a long-legged lifter can lean past any fixed line on every good rep. It warns
  past 55°, loose enough for a typical low-bar squat. Faults that show up as
  lean, such as the chest dropping out of the hole, need their own checks.
- **Knees caving in** compares each rep with its own start, so a wide or narrow
  stance doesn't matter. The knee gap is smoothed with a rolling median over
  0.25 s first, so narrowing has to last about 0.15 s to count: the narrowest
  single frame is usually landmark jitter. On synthetic reps with realistic
  jitter, this cut false warnings on good reps from about 1 in 4 to about 1 in 70.
  It skips reps with the feet close together, where small knee movements look
  large.
- **Camera tilt** shifts depth and torso angle one for one, because both are
  measured against the edges of the picture. The filming tips ask for a level
  phone. A later version could estimate the tilt from the clip.
- **Around parallel**, depth is probably only good to a few degrees. Once real
  clips show the actual spread, a small "about parallel" band may be fairer than
  a hard line at 0°.

### Deadlift checks

Built. All three need a side view and measure the near side of the body. They
share `pull.ts`, which finds the pull: from the last frame with the bar on the
floor up to lockout. A rep starts at its last frame near rest, which for a
deadlift can be a little way off the floor, so the floor is the lowest point of
whatever follows the bar in the second before the rep. The lifter faces the way
that point is from the hips at the floor.

What follows the bar is chosen per rep: the near plate when the bar tracker found
it in at least 80% of the rep's frames (see [Following the bar](#following-the-bar)),
then the hands when they're seen in 80%, otherwise the shoulders. Filmed from the
side, the near plate covers the hands (and the knees) for the whole pull; in the
first real clip the hands were seen in 92 of 1,259 frames and the shoulders in
all of them. With the plate or the hands, the floor frame is the last one near the floor searching back
from lockout, which skips a dip-and-rip setup. With the shoulders, it is the
frame before they first rise, searching forward, because hips shooting up keep
the shoulders low after the bar has left the floor. The bar reaches the knees
when the plate's centre or the hands pass the knee point, if they are tracked and
the knees are seen in 80% of the pull. Otherwise it counts as at the knees once the tracked
point has covered a third of its rise to lockout, which is where the hands pass
the knees in a conventional pull (later with the hips set higher, so this is an
estimate). A pull whose
tracked point rises less than 0.5 torso lengths started above the knees.

The rep signal always uses the shoulders. Mixing hands and shoulders frame by
frame would make the signal jump, as they rise by different amounts at
different times.

| Check             | Measures                                                                    | Pass                                 | Warn       | Fail     |
| ----------------- | --------------------------------------------------------------------------- | ------------------------------------ | ---------- | -------- |
| Hips rising first | How far the torso tips forward from liftoff until the bar reaches the knees | Up to 10°                            | 10° to 20° | Over 20° |
| Lockout           | Bend left at the hip and knee at the top, whichever is worse                | Up to 10°                            | 10° to 20° | Over 20° |
| Bar path          | How far the bar moves forward from where it left the floor                  | Up to 0.1 torso lengths (about 5 cm) | 0.1 to 0.2 | Over 0.2 |

- **Hips rising first** measures from the moment the bar leaves the floor (lean
  steadied with a rolling median over ±0.1 s), and takes the most tipped moment
  before the hands reach the knees. Hip movement before liftoff isn't judged:
  many lifters drop the hips and rise into position as they take the slack out
  (a dip-and-rip setup), and with only the hands to follow the bar that looks
  the same as the hips rising too early. The cost is that tipping before the bar
  has risen about 2.5 cm isn't counted. It skips pulls that start with the bar
  above the knees. Following the shoulders it is more lenient: hips shooting up
  barely lift the shoulders, so liftoff is found a little late (a synthetic pull
  tipping 21° with the hands measures 18° with the shoulders).
- **Lockout** uses signed tilts (`forwardTilt`) rather than joint angles, so
  leaning back at the top counts as locked out instead of as a hip that hasn't
  straightened. It takes the best moment within 0.25 s of where the bar was
  highest. From the side the near plate covers the knees at the top, and the
  model still places the knee, often confidently and wrongly (Reagan's first gym
  clip read 32° of knee bend on straight legs). So a knee inside the tracked
  plate's circle, or not seen, isn't judged: the hips are then measured against
  the hip-to-ankle line, which is the thigh's line when the knee is straight, and
  the message says only the hips were checked. With the knee slightly bent the
  hip-to-ankle line leans less than the thigh, so the hips read a little lenient.
- **Bar path** follows the plate's centre, or the hands where the plate wasn't
  found, and skips reps where neither was followed. Positions are steadied with a
  median over 2 frames either side, so one misplaced frame can't fail a rep.
  Moving back towards
  the body as the knees straighten is normal and isn't counted. With the camera
  off square-on, forward drift is foreshortened, so it can be under-reported but
  never over-reported.
- **Jitter**: on 200 seeded synthetic good reps with jitter of 0.006 frame
  heights on every point, cleaned as the pipeline does, none of the three checks
  raised a false warning. The worst readings were 0° tipping (a good pull only
  gets more upright after liftoff), 4° of bend and 0.05 torso lengths of drift.

### Bench checks

Built. Touch point and lockout need a side view and measure the near side of the
body. Uneven press needs the camera along the bench, at the feet or the head:
choose front or back, either works. The bench rep starts and ends at lockout,
with the hands lowest at the turn.

| Check        | Measures                                                                                                  | Pass            | Warn            | Fail     |
| ------------ | --------------------------------------------------------------------------------------------------------- | --------------- | --------------- | -------- |
| Touch point  | Where the wrist is at the bottom, along the body from the shoulder joint (0) to the hip joint (1)         | 0.15 to 0.6     | Higher or lower | Never    |
| Lockout      | Bend left at the elbow at the top                                                                         | Up to 15°       | 15° to 25°      | Over 25° |
| Uneven press | How much lower one hand is than the other on the way up, against the start of the rep, in shoulder widths | Up to 0.1 (10%) | 0.1 to 0.2      | Over 0.2 |

- **Touch point** only warns. Where the bar should touch depends on grip width,
  arch and arm length, so a touch outside the usual range is worth a look rather
  than a fault. It's the median over 0.1 s either side of where the hands were
  lowest, and it reads the same whichever way the lifter lies in the video. The
  message also says whether the touch was on the upper, middle or lower chest.
- **Lockout** takes the straightest moment from 0.25 s before the rep ends to
  0.5 s after it, since the hands are back near the top a little before the arms
  finish straightening. The bend is smoothed with a rolling median over three
  frames first, so one lucky frame can't pass a soft lockout. A longer window
  would be steadier but warned on most touch-and-go reps, where the arms are
  straight for only a moment. The pass line allows 15° because the model's
  shoulder, elbow and wrist don't line up perfectly even on a straight arm. Near
  straight, a little bend makes almost no difference to reach (20° shortens the
  arm by about 1.5%), so the elbow angle is what's measured, not the hands'
  height.
- **Uneven press** judges only the way up. Comparing with the start of each rep,
  at lockout, cancels a camera that isn't level. Shoulder width is the scale
  because filming along the bench makes the torso look short. The message names
  the lagging hand and which side of the video it's on, because left and right
  swap between filming from the feet and from the head, and the model's left
  and right labels haven't yet been checked on a lifter lying down.
- **Bar path is not judged yet.** A good bench bar path isn't straight: it
  curves from over the shoulders at lockout to the chest and back. What counts
  as normal is best learnt from real clips.
- **Jitter**: on 200 seeded synthetic reps with jitter of 0.006 frame heights on
  every point, cleaned as the pipeline does, none raised a false warning on a
  good touch or an even press, and none on a held lockout. A touch-and-go
  lockout passed 198 of 200 times (a 0.25 s window passed 58). The smoothing
  still flags a soft lockout of 21° 190 times in 200 (taking the single
  straightest frame flagged 183) and a hand lagging by 15% of shoulder width 192
  times in 200.
- **Rep finding from the feet**: there the torso looks short, so the hands'
  travel is many torso lengths and so is any jitter at lockout. On jittered
  synthetic sets every rep was still found, but this is one to watch on real
  clips.

## Testing

- **Unit tests** (Vitest) for `geometry`, `signal`, `reps` and each check.
- **Fixture tests**: real clips are run once through the pose model with a small
  dev tool, and the resulting pose sequences are saved as JSON in
  `tests/fixtures/`. Tests assert things like "this clip has 5 reps and rep 3
  fails the depth check". Videos themselves are not committed, for size and
  privacy.
- **Adapter tests** are kept thin; the adapters should hold as little logic as
  possible.

## Tooling

| Concern            | Choice                                                                | Cost |
| ------------------ | --------------------------------------------------------------------- | ---- |
| Language           | TypeScript, `strict` mode                                             | Free |
| UI                 | React                                                                 | Free |
| Package manager    | pnpm                                                                  | Free |
| Build / dev server | Vite                                                                  | Free |
| Pose model         | MediaPipe Pose Landmarker (`@mediapipe/tasks-vision`), runs on device | Free |
| Tests              | Vitest                                                                | Free |
| Lint / format      | ESLint and Prettier                                                   | Free |
| Import rules       | dependency-cruiser                                                    | Free |
| Local history      | IndexedDB, via a small wrapper                                        | Free |
| CI and hosting     | GitHub Actions and GitHub Pages                                       | Free |
| Installable app    | vite-plugin-pwa (web manifest and Workbox service worker)             | Free |

CI runs type checking, lint, the import rules and tests on every pull request. On
`main`, it deploys to GitHub Pages only after those checks pass.

## Performance

- The video is processed after recording, so analysis doesn't need to keep up in
  real time. A progress bar covers it, and it can be cancelled.
- Frames are sampled at a fixed rate (30 per second) by seeking to each sample
  time, rather than playing the video, so no frame is skipped and results don't
  depend on the phone's recording frame rate. Seeking is the slower approach; if
  it proves too slow on a phone, `requestVideoFrameCallback` during playback is
  the alternative.
- The pose model runs on the GPU when available and falls back to the CPU.
- Not done yet: running the pose model in a Web Worker to keep the page fully
  responsive during analysis.

## Adapters

- Adapters are built in one place, `main.tsx`, and passed to the screens as
  `AnalysisAdapters`, so the screens can run with fakes.
- `adapters/video/VideoFrameSource` loads a video from a URL (the screens' hook
  owns the object URL for the picked file) and seeks frame by frame. Each load
  and seek has a timeout, so a video the browser can't decode fails with a
  message instead of hanging. After each seek it also waits for the new frame
  to be shown (`requestVideoFrameCallback`), because Safari can report a seek
  as done before the frame is decoded.
- Each analysis run has its own `AbortController`. Cancel works during every
  slow step, including loading the video and downloading the model.
- `adapters/pose/MediaPipePoseEstimator` wraps MediaPipe Pose Landmarker in video
  mode and converts its output with `toSharedUnits` (see Coordinates). MediaPipe
  needs timestamps that only increase, so it offsets each new clip's times. It
  uses the GPU, and falls back to the CPU if the GPU fails at start-up or on
  the first frame.
- MediaPipe's WebAssembly runtime is copied from `node_modules` into
  `public/mediapipe/` by `scripts/copy-mediapipe-wasm.mjs` after every install,
  so the app serves it itself at exactly the installed version. The model file
  (about 9 MB, pinned version) is downloaded from Google's model storage on first
  use and then kept by the service worker (see Installing on a phone). No video
  data is sent anywhere.

## Installing on a phone

The app is a progressive web app (PWA): it can be added to the phone's home
screen and opens full screen like an installed app, with no app store.
`vite-plugin-pwa` writes the web manifest and a service worker at build time; the
settings are in `vite.config.ts`.

- **What's kept on the phone.** When the app is first opened, the service worker
  stores the app itself and MediaPipe's runtime (about 15 MB). The pose model
  (about 9 MB) is stored the first time a clip is analysed. After that the app
  works with no connection, which helps in a gym with poor signal. Only the
  runtime build the pose estimator loads is stored, not the ES-module copy.
- **Updates.** Each deploy changes the stored files' revisions. The phone fetches
  the new version in the background, checking when the app opens or comes back
  into view, and `ui/components/UpdateNotice` offers a reload. It never reloads by
  itself, because that would lose an analysis in progress. "Later" hides the
  notice until the app is next opened.
- **Version number.** The start screen shows a release number such as
  `v0.1.3 · 9eb18b5`, so it's easy to see when the phone has picked up a new
  deploy. `scripts/app-version.ts` works it out at build time: the last number
  is the base version in `package.json` plus the commits on main since that
  version line last changed (one per merged PR, counted with `--first-parent`).
  To start a new series, change the version in `package.json`, for example to
  `0.2.0`. Nothing is committed back to main, and CI checks out the full history
  so the count is right.
- **The model's URL names its version**, so the stored copy is used without
  checking for a newer one. A new model means a new URL, which is downloaded
  afresh.
- **Not in development.** Only `pnpm build` makes the service worker, so
  `pnpm dev` never serves stale files. Try it with `pnpm build && pnpm preview`.
- **iPhone**: Safari has no install prompt; Share → Add to Home Screen installs
  it, with the icon from `apple-touch-icon.png`. Chrome on Android offers to
  install it.
- **Icons** are drawn in `public/icons/icon.svg`. It's full-bleed, with
  everything inside the central safe zone, so the same image works as a maskable
  icon. The PNGs are rendered from it at 180, 192 and 512 px; render them again
  if the SVG changes.

## Look and feel

- **Theme.** `ui/styles/theme.css` holds the colour tokens and base styles: dark
  only, one electric-lime accent, and pass, warn and fail colours kept apart from
  the accent. Components use the tokens, never raw colours.
- **Type.** Headings, buttons and big numbers use Barlow Condensed (OFL), from
  `@fontsource/barlow-condensed`, imported in `ui/styles/fonts.ts`. It's bundled
  and precached with the app, so it works offline. Body text uses the system
  font.
- **Motion.** `ui/styles/motion.css` slides each screen in and pops result
  badges in one after another (`badgeStagger`). All of it is switched off under
  `prefers-reduced-motion`.
- **Other apps' music keeps playing.** The app has no sound, so at startup
  `ui/platform/audio-session.ts` sets WebKit's `navigator.audioSession.type` to
  `ambient` (Safari 17+). That tells iOS not to pause Spotify or Apple Music
  when the app opens or a muted video plays. Videos are muted before their
  source is set.
- **Haptics.** `ui/platform/haptics.ts` buzzes when the results arrive (a double
  buzz if anything failed). Android only: iPhones ignore the Vibration API.
- **Showing a result on the video.** Each check lists the joints it looks at
  (`FormCheck.focus`, side-less, display only). Tapping a result pauses on its
  frame, draws those joints and the lines between them in the result's colour,
  and lays the result's message over the video. It clears once playback moves
  off that frame.

## Following the bar

The pose model sees the body only, and from the side the near plate hides the
hands. So for lifts that set `followsBar` (the deadlift), the plate itself is
followed while the poses are found: `extractPoses` takes a `trackBar` callback,
and the results become `PoseSequence.barTrack`, one `BarPoint` (centre, radius,
confidence) or null per frame. Frames are read through the `RegionReader` port,
which returns a small greyscale picture of part of the frame
(`adapters/video/CanvasRegionReader` draws the video into a canvas). Everything
else is pure, in `src/bar/`.

- **Finding a circle** (`find-circle.ts`): Sobel edges vote for the points one
  radius away along their gradient, on both sides, since a plate can be darker or
  lighter than what's behind it. The centre with the most votes per unit of
  circumference wins. Its score is measured directly, as the share of 72 points
  around the circle with an edge facing the centre within 2 pixels.
- **Finding the plate the first time** (`plate-tracker.ts`): around the middle of
  the feet, its centre about 0.4 torso lengths above the ankles, at radii of 0.3
  to 1.3 torso lengths. A 45 cm plate is about 0.45 from a few metres away, but
  it is nearer the camera than the lifter, so it looks bigger when the camera is
  close: 0.85 in Reagan's first gym clip, filmed from about 1.5 m at floor level.
  With the range capped at 0.6 that clip locked onto a kettlebell instead. It needs 65% of the edge,
  in the same place three frames in a row, because curves such as a bent leg can
  look like part of a circle.
- **Following it**: each frame looks within 0.3 torso lengths of where it was
  (widening by 0.1 per missed frame), for a circle within 15% of the size it was
  first found at, with at least 30% of the edge. After 15 missed frames in a row
  (0.5 s) it starts again from the feet. Missed frames are null, never guessed.
- Pictures are read at a scale that makes the plate about 24 pixels in radius,
  so each frame's search is small next to the pose model's.
- The results video draws the plate's outline and the last 3 s of its path, so
  what the tracker found can be checked by eye.
- On a made-up clip (the sample photo with a plate drawn on, rising 200 px and
  drifting 40 px) it followed the plate in 178 of 181 frames, within 3 px.
- On Reagan's first gym clip (27 s, iPhone, side-on from floor level) it found
  the plate after 8 frames and followed it in every frame after, through the
  lift and lockout, at about 4 ms a frame in Node.
- `pullOf` only takes the plate (or the hands) as the bar if it rises at least
  half as much as the shoulders over the rep. A round thing that stays put, such
  as a plate leaning on a wall, falls back to the shoulders, so a wrong lock can
  cost bar path but never the other checks.
- It also needs a median confidence of at least 0.7 over the rep. Straight
  side-on the plate is a clean circle (median 0.83 on that clip). On a clip
  filmed about 35° off side-on the plate is an oval, and the tracker settled on
  part of it while still rising with the bar (median 0.49), which would have
  placed the bar wrongly. There the hands are in view, so they follow the bar
  instead. On a clip filmed along the bar, it found the far plate face-on, which
  never moved, so the rise guard rejected it.

## Known limits

- **Bench press is the hardest lift to track.** The lifter is lying down and the
  plates can hide the arms, so pose confidence drops. Bench checks will be rougher
  than squat and deadlift checks, and skip more often. The model was trained
  mostly on people standing, so its left and right labels for a lifter lying
  down are least sure.
- **The bar is found as a circle, not recognised.** The plate tracker looks for
  the clearest circle of plate size near the feet, so a round shape there of the
  same size could be mistaken for it, and a plate that blends into the background
  may not be found. It has been tested on made-up video only so far.
- **Side-view deadlifts hide the hands.** Filmed straight side-on, the near plate
  sits between the camera and the hands at any practical camera height, so bar
  path relies on the plate tracker. The other deadlift checks use the shoulders,
  hips and knees, which stay in view. Turning the camera to show the hands would distort
  the hip and knee angles, so the deadlift filming tips say to stay side-on.
- **Depth (`z`) from the model is an estimate.** Checks rely on `x` and `y` and
  treat `z` as a hint only.
- **Clothing, lighting and other people in frame** all reduce accuracy. The
  report says so when confidence is low.

## Decisions

- **UI framework: React.** The UI is a thin layer over `analysis`, so components
  only render results and call into the pipeline.
- **Package manager: pnpm.**
- **Camera view: guess and confirm.** The user always picks the lift. The app
  guesses the view (side or front/back) from body proportions, shows the guess,
  and the user confirms or corrects it before checks run.
- **On the phone: a PWA.** It's free, works with GitHub Pages hosting, and
  installs from the browser on iPhone and Android. A native wrapper such as
  Capacitor would need a paid Apple developer account to install on an iPhone,
  and adds nothing this app needs: it only reads video files, which the browser
  already allows.
