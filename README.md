# Lift Scanner

Review your squat, deadlift and bench press form from a video recorded on your
phone. Everything runs in the browser on your device: the video is never uploaded.

**Status:** finds and times your reps and shows the tracked skeleton over the
video. Form checks are next. The design is in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); read it before adding code.

## How it will work

1. Record a set with the phone side-on (or front-on for some checks), with your
   whole body in frame.
2. Open Lift Scanner, choose the lift and the clip.
3. Confirm the camera view the app detected.
4. Get a rep-by-rep report, with each issue linked to the moment in the video.

## Development

Needs Node 22 or later and pnpm (`corepack enable` sets up the right version).

```sh
pnpm install
pnpm dev        # start the dev server
pnpm test       # run the tests once
pnpm check      # everything CI runs: types, lint, formatting, import rules, tests
pnpm build      # production build into dist/
```

| Script              | What it does                                                |
| ------------------- | ----------------------------------------------------------- |
| `pnpm typecheck`    | Strict TypeScript check                                     |
| `pnpm lint`         | ESLint, including a ban on browser APIs in the pure modules |
| `pnpm format:check` | Prettier check (`pnpm format` fixes it)                     |
| `pnpm deps:check`   | dependency-cruiser: enforces the import rules from the doc  |
| `pnpm test`         | Vitest unit tests (`pnpm test:watch` to re-run on save)     |

## Deployment

Every push to `main` builds the app and deploys it to GitHub Pages. In the repo's
**Settings → Pages**, set **Source** to **GitHub Actions** once.
