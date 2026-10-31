/** Netlify build-time source stamp; COMMIT_REF is not available to Functions at runtime. */
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const SHA = /^[a-f0-9]{40}$/;
export function renderBuildMeta(commitRef) {
  const sha = typeof commitRef === 'string' && SHA.test(commitRef) ? commitRef : null;
  return `// Generated during Netlify build. Never include tokens here.\nexport const BUILD_COMMIT_SHA = ${JSON.stringify(sha)};\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const destination = fileURLToPath(new URL('../netlify/functions/zoo-build-meta.mjs', import.meta.url));
  writeFileSync(destination, renderBuildMeta(process.env.COMMIT_REF), 'utf8');
  process.stdout.write(`ZOO build stamp: ${SHA.test(process.env.COMMIT_REF ?? '') ? 'source SHA recorded' : 'source SHA UNKNOWN'}\n`);
}
