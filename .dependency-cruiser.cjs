/**
 * Import rules from docs/ARCHITECTURE.md ("Dependency rules").
 * Run with `pnpm deps:check`. CI fails if any rule is broken.
 */
const PURE = '^src/(core|geometry|signal|view|reps|lifts|analysis|report)/';

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
    {
      name: 'core-has-no-dependencies',
      severity: 'error',
      comment: 'core/ holds shared types and interfaces only. It imports nothing else from src.',
      from: { path: '^src/core/' },
      to: { path: '^src/', pathNot: '^src/core/' },
    },
    {
      name: 'pure-modules-stay-pure',
      severity: 'error',
      comment:
        'Pure modules must not reach into adapters or the UI, so they stay testable in Node.',
      from: { path: PURE },
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
      name: 'math-modules-only-use-core',
      severity: 'error',
      comment: 'geometry/ and signal/ are low-level maths and may only use core/ and each other.',
      from: { path: '^src/(geometry|signal)/' },
      to: { path: '^src/', pathNot: '^src/(core|geometry|signal)/' },
    },
    {
      name: 'lifts-do-not-import-each-other',
      severity: 'error',
      comment: 'Each lift is self-contained. Shared helpers belong in geometry, signal or reps.',
      from: { path: '^src/lifts/([^/]+)/' },
      to: { path: '^src/lifts/[^/]+/', pathNot: '^src/lifts/$1/' },
    },
    {
      name: 'adapters-only-use-core',
      severity: 'error',
      comment: 'Adapters implement interfaces from core/ and hold no analysis logic.',
      from: { path: '^src/adapters/' },
      to: { path: '^src/', pathNot: '^src/(core|adapters)/' },
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
