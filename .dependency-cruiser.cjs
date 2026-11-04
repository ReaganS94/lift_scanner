/**
 * Import rules from docs/ARCHITECTURE.md ("Dependency rules").
 * Run with `pnpm deps:check`. CI fails if any rule is broken.
 */

/** Pure modules: no browser APIs, no React, testable in Node. */
const PURE = '^src/(core|geometry|signal|view|reps|lifts|analysis|report|testing)/';

/**
 * What each layer may import from inside src/. Anything not listed is forbidden, so a new
 * shortcut between layers fails the build instead of slipping through review.
 */
const LAYERS = {
  core: [],
  geometry: ['signal'],
  signal: ['geometry'],
  view: ['geometry', 'signal'],
  reps: ['geometry', 'signal'],
  lifts: ['geometry', 'signal'],
  report: [],
  analysis: ['geometry', 'signal', 'view', 'reps', 'lifts', 'report'],
  adapters: [],
  testing: [],
};

const layerRules = Object.entries(LAYERS).map(([layer, allowed]) => {
  const allowedPaths = [layer, 'core', ...allowed].join('|');
  return {
    name: `${layer}-imports-only-allowed-layers`,
    severity: 'error',
    comment:
      `src/${layer}/ may only import from: ${[layer, 'core', ...allowed].join(', ')}. ` +
      'See docs/ARCHITECTURE.md, "Dependency rules".',
    from: { path: `^src/${layer}/`, pathNot: '\\.test\\.tsx?$' },
    to: { path: '^src/', pathNot: `^src/(${allowedPaths})/` },
  };
});

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular imports make modules impossible to read or test on their own.',
      from: {},
      to: { circular: true },
    },
    ...layerRules,
    {
      name: 'tests-import-only-their-layer-and-test-helpers',
      severity: 'error',
      comment: 'A test may import its own layer, the layers it may use, and src/testing.',
      from: {
        path: '^src/(core|geometry|signal|view|reps|lifts|report|analysis)/.+\\.test\\.tsx?$',
      },
      to: { path: '^src/(adapters|ui)/' },
    },
    {
      name: 'pure-modules-no-react',
      severity: 'error',
      comment: 'Only ui/ renders. Pure modules must not import React.',
      from: { path: PURE },
      to: { path: 'node_modules/(react|react-dom)/' },
    },
    {
      name: 'lifts-do-not-import-each-other',
      severity: 'error',
      comment: 'Each lift is self-contained. Shared helpers belong in geometry or signal.',
      from: { path: '^src/lifts/([^/]+)/' },
      to: { path: '^src/lifts/[^/]+/', pathNot: '^src/lifts/$1/' },
    },
    {
      name: 'only-tests-use-test-helpers',
      severity: 'error',
      comment: 'src/testing/ builds fake data for tests. App code must not depend on it.',
      from: { path: '^src/', pathNot: ['\\.test\\.tsx?$', '^src/testing/'] },
      to: { path: '^src/testing/' },
    },
    {
      name: 'no-test-code-in-app',
      severity: 'error',
      comment: 'App code must not import test files.',
      from: { pathNot: '\\.test\\.tsx?$' },
      to: { path: '\\.test\\.tsx?$' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.app.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.tsx', '.js', '.d.ts'],
    },
  },
};
