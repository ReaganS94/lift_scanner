/** The release this build is, such as "v0.1.3", or "dev". Worked out by scripts/app-version.ts. */
export const APP_VERSION = String(import.meta.env.VITE_APP_VERSION ?? 'dev');

/** The short commit this build came from, or "" when unknown. */
export const APP_COMMIT = String(import.meta.env.VITE_APP_COMMIT ?? '');
