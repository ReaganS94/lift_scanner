import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * The version the app shows, worked out from git when the app is built.
 *
 * package.json holds the base version, such as 0.1.0. Every release (each commit on main since
 * that version line last changed, so one per merged PR) adds one to the last number: the deploy
 * after 0.1.0 is 0.1.1, then 0.1.2. Changing the version in package.json starts the count again
 * from there. Nothing is written back to the repository, so main needs no bot commits.
 */
export interface AppVersion {
  /** For example "v0.1.3", or "dev" when git can't tell. */
  readonly label: string;
  /** The short commit, for example "9eb18b5", or null when git can't tell. */
  readonly commit: string | null;
}

/** Adds the number of releases since the base version to its last number. */
export function releaseVersion(base: string, releasesSince: number): string {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(base);
  if (!match) throw new Error(`package.json version "${base}" is not in the form 1.2.3`);
  const [, major, minor, patch] = match;
  return `v${major}.${minor}.${String(Number(patch) + releasesSince)}`;
}

/** Reads the version from package.json and the git history in `cwd`. */
export function readAppVersion(cwd: string): AppVersion {
  const git = (...args: string[]) =>
    execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

  let commit: string;
  try {
    commit = git('rev-parse', '--short=7', 'HEAD');
  } catch {
    return { label: 'dev', commit: null };
  }

  // A shallow clone is missing the history the count needs, and would show a wrong number.
  if (git('rev-parse', '--is-shallow-repository') === 'true') {
    throw new Error('Building the app version needs the full git history (fetch-depth: 0).');
  }

  const { version } = JSON.parse(readFileSync(`${cwd}/package.json`, 'utf8')) as {
    version: string;
  };
  // --first-parent follows main itself, so a merged PR counts once however many commits it had.
  const versionSetAt = git(
    'log',
    '--first-parent',
    '-1',
    '--format=%H',
    '-G',
    '"version"',
    '--',
    'package.json',
  );
  const releasesSince = versionSetAt
    ? Number(git('rev-list', '--count', '--first-parent', `${versionSetAt}..HEAD`))
    : 0;

  return { label: releaseVersion(version, releasesSince), commit };
}
