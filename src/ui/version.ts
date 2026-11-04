/** The short commit this build came from, or "dev" for a local build. */
export const APP_VERSION = String(import.meta.env.VITE_APP_VERSION ?? 'dev');
