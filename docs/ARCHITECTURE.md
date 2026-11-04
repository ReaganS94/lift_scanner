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
- Tracking the barbell itself. The pose model tracks the body only, so bar
  position is approximated from the hands (see [Known limits](#known-limits)).

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
  lifts/         One folder per lift, plus the lift registry.
    registry.ts
    squat/
      index.ts         The lift definition (views, rep signal, checks).
      checks/
        depth.ts
        torso-angle.ts
        knee-valgus.ts
      squat.test.ts
    deadlift/
    bench/
  analysis/      The pipeline that wires the steps together.
  report/        The report model and its serialisation.
  adapters/      Code that talks to the outside world, behind interfaces
    pose/          from core/. Swappable and mockable.
      mediapipe.ts
    video/
      html-video.ts
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
| `report`               | nothing                                                 |
| `analysis`             | `geometry`, `signal`, `view`, `reps`, `lifts`, `report` |
| `adapters`             | nothing                                                 |
| `ui`                   | anything except `testing`                               |
| `testing` (tests only) | nothing; only `*.test.ts` files may import it           |

- `core`, `geometry`, `signal`, `view`, `reps`, `lifts`, `analysis` and `report`
  are **pure TypeScript**. They don't touch the DOM, the camera, files or
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
about 29°. To avoid that, **pose adapters convert landmarks into one shared unit,
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

| Lift     | Rep signal                               | Rest position |
| -------- | ---------------------------------------- | ------------- |
| Squat    | Hip drop below standing                  | Standing      |
| Deadlift | Hand (bar) rise above the floor position | Bar on floor  |
| Bench    | Hand (bar) drop below lockout            | Lockout       |

The detector uses two thresholds (hysteresis): a rep starts when the signal
climbs past half its typical peak and ends when it falls back below a fifth of it,
so jitter near one threshold can't split a rep. A rep only counts if the lifter is
seen at rest both before and after it, so a clip that starts or ends mid-rep
doesn't produce a half rep. Each lift sets a minimum movement and duration.

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

View detection uses simple ratios (for example, apparent shoulder width compared
to torso length). It shows its guess and lets the user correct it, because a wrong
view would make every check unreliable.

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
| Bench    | Touch point and bar path (from wrists) | Side         |
| Bench    | Full lockout                           | Side         |
| Bench    | Uneven press (one arm lagging)         | Front / back |
| All      | Rep tempo (time down and up)           | Any          |

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

CI runs type checking, lint, the import rules and tests on every pull request. On
`main`, it deploys to GitHub Pages only after those checks pass.

## Performance

- The video is processed after recording, so analysis can take a few seconds and
  doesn't need to keep up in real time. A progress bar covers it.
- Pose estimation runs in a Web Worker where the browser supports it, so the UI
  stays responsive.
- Frames are sampled at a fixed rate (start at 30 per second) rather than every
  decoded frame, so results don't depend on the phone's recording frame rate.

## Known limits

- **Bench press is the hardest lift to track.** The lifter is lying down and the
  plates can hide the arms, so pose confidence drops. Bench checks will be rougher
  than squat and deadlift checks, and skip more often.
- **The bar isn't tracked directly.** Bar path is approximated from the hands. A
  later version could add a small object detector for the plate.
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
