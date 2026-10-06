// Regenerate every committed demo site from briefs/ with the deterministic
// mock provider, then rebuild sites.json. CI runs this and fails if the
// output differs from what is committed.
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildManifest, generateSite } from '../src/generator.js';
import { createProvider } from '../src/providers/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const briefsDir = path.join(root, 'briefs');
const sitesDir = path.join(root, 'sites');
const provider = await createProvider(process.env.SITEGEN_PROVIDER || 'mock');

for (const file of (await readdir(briefsDir)).filter((f) => f.endsWith('.json')).sort()) {
  const brief = JSON.parse(await readFile(path.join(briefsDir, file), 'utf8'));
  const { meta } = await generateSite(brief, { provider, sitesDir });
  console.log(`${file} -> sites/${meta.slug}/ (${meta.provider})`);
}
const sites = await buildManifest(sitesDir, path.join(root, 'sites.json'));
console.log(`sites.json lists ${sites.length} site(s)`);
