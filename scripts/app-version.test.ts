import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readAppVersion, releaseVersion } from './app-version';

describe('releaseVersion', () => {
  it('adds the releases to the last number', () => {
    expect(releaseVersion('0.1.0', 0)).toBe('v0.1.0');
    expect(releaseVersion('0.1.0', 12)).toBe('v0.1.12');
    expect(releaseVersion('1.2.3', 2)).toBe('v1.2.5');
  });

  it('rejects a version it cannot count from', () => {
    expect(() => releaseVersion('0.1', 0)).toThrow();
  });
});

describe('readAppVersion', () => {
  let repo: string;
  const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
  const commit = (file: string, text: string) => {
    writeFileSync(join(repo, file), text);
    git('add', file);
    git('commit', '-q', '-m', file);
  };
  const setVersion = (version: string) => {
    commit('package.json', JSON.stringify({ name: 'x', version }, null, 2));
  };

  const createRepo = () => {
    repo = mkdtempSync(join(tmpdir(), 'app-version-'));
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'Test');
    git('config', 'commit.gpgsign', 'false');
  };

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it('starts at the package.json version and counts each commit after it', () => {
    createRepo();
    setVersion('0.1.0');
    expect(readAppVersion(repo).label).toBe('v0.1.0');
    commit('a.txt', 'a');
    commit('b.txt', 'b');
    expect(readAppVersion(repo).label).toBe('v0.1.2');
    expect(readAppVersion(repo).commit).toMatch(/^[0-9a-f]{7}$/);
  });

  it('counts a merged branch once, however many commits it had', () => {
    createRepo();
    setVersion('0.1.0');
    git('checkout', '-q', '-b', 'feature');
    commit('a.txt', 'a');
    commit('b.txt', 'b');
    git('checkout', '-q', 'main');
    git('merge', '-q', '--no-ff', '-m', 'Merge feature', 'feature');
    expect(readAppVersion(repo).label).toBe('v0.1.1');
  });

  it('starts again when the version is changed, including through a merge', () => {
    createRepo();
    setVersion('0.1.0');
    commit('a.txt', 'a');
    git('checkout', '-q', '-b', 'bump');
    setVersion('0.2.0');
    git('checkout', '-q', 'main');
    git('merge', '-q', '--no-ff', '-m', 'Merge bump', 'bump');
    expect(readAppVersion(repo).label).toBe('v0.2.0');
    commit('b.txt', 'b');
    expect(readAppVersion(repo).label).toBe('v0.2.1');
  });

  it('says "dev" outside a git repository', () => {
    repo = mkdtempSync(join(tmpdir(), 'app-version-'));
    expect(readAppVersion(repo)).toEqual({ label: 'dev', commit: null });
  });
});
