import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8')) as { version: string };

/**
 * Fingerprint of everything a battle replay depends on (the simulation and the record format). A saved
 * battle is only resumed by a build with the same fingerprint, so a game update that changes the
 * simulation discards old records instead of replaying them into a different battle.
 */
function replayBuildId(): string {
  const h = createHash('sha256');
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.ts$/.test(e.name)) files.push(p);
    }
  };
  walk(join(here, 'src/sim'));
  files.push(join(here, 'src/ui/resume.ts'));
  for (const f of files) {
    h.update(f.slice(here.length).replace(/\\/g, '/'));
    // line endings must not change the id (checkouts on different systems)
    h.update(readFileSync(f, 'utf8').replace(/\r\n/g, '\n'));
  }
  return h.digest('hex').slice(0, 12);
}

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __REPLAY_BUILD__: JSON.stringify(replayBuildId()),
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 900,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 120000,
  },
} as any);
