/**
 * App version, shared by the settings screen, the local error log and battle resume.
 * Both values are injected at build time by vite.config.ts (from package.json and from the simulation
 * sources); outside a Vite build (e.g. a plain tsx script) they fall back to 'dev'.
 */
declare const __APP_VERSION__: string | undefined;
declare const __REPLAY_BUILD__: string | undefined;

export const VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

/** Changes whenever the simulation or the record format changes. */
export const REPLAY_BUILD: string = typeof __REPLAY_BUILD__ === 'string' ? __REPLAY_BUILD__ : 'dev';

/** A saved battle is replayed only by exactly this build; any other value means "discard the record". */
export const RESUME_VER = `${VERSION}+${REPLAY_BUILD}`;
