import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizeBrief } from './brief.js';
import { CopyError, findFabrications, validateCopyShape } from './copy.js';
import { renderSite } from './render.js';

export const GENERATOR_VERSION = '1.0.0';

/**
 * Ask the provider for copy, validate it, and retry with the rejection reasons
 * as feedback. Throws CopyError if the provider never produces clean copy.
 */
export async function generateCopy(brief, provider, { attempts = 3 } = {}) {
  let feedback = [];
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let copy;
    try {
      copy = validateCopyShape(await provider.generateCopy(brief, { feedback }), brief);
    } catch (err) {
      if (!(err instanceof CopyError || err instanceof SyntaxError)) throw err;
      feedback = err.problems || [`response was not valid JSON: ${err.message}`];
      continue;
    }
    const problems = findFabrications(copy, brief);
    if (!problems.length) return copy;
    feedback = problems;
  }
  throw new CopyError(feedback);
}

/** Generate one site from a raw brief object into `<sitesDir>/<slug>/`. */
export async function generateSite(rawBrief, { provider, sitesDir, formEndpoint } = {}) {
  const brief = normalizeBrief(rawBrief);
  if (formEndpoint) brief.formEndpoint = formEndpoint;
  const copy = await generateCopy(brief, provider);
  const files = renderSite(brief, copy);

  const outDir = path.join(sitesDir, brief.slug);
  await mkdir(outDir, { recursive: true });
  for (const [name, contents] of Object.entries(files)) {
    await writeFile(path.join(outDir, name), contents);
  }
  const meta = {
    name: brief.name,
    slug: brief.slug,
    trade: brief.trade,
    city: brief.city,
    demo: brief.demo,
    summary: copy.metaDescription,
    colors: brief.colors,
    provider: provider.name,
    model: provider.model,
    generator: GENERATOR_VERSION,
    pages: Object.keys(files).filter((f) => f.endsWith('.html')),
  };
  await writeFile(path.join(outDir, 'site.json'), `${JSON.stringify(meta, null, 2)}\n`);
  return { brief, copy, meta, outDir };
}

/** Scan `<sitesDir>/*\/site.json` and write the manifest the root index reads. */
export async function buildManifest(sitesDir, manifestPath) {
  let entries = [];
  try {
    entries = await readdir(sitesDir, { withFileTypes: true });
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  const sites = [];
  for (const entry of entries.filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    try {
      const meta = JSON.parse(await readFile(path.join(sitesDir, entry.name, 'site.json'), 'utf8'));
      const rel = path.relative(path.dirname(manifestPath), path.join(sitesDir, entry.name)).split(path.sep).join('/');
      sites.push({ ...meta, path: `${rel}/` });
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }
  await writeFile(manifestPath, `${JSON.stringify({ sites }, null, 2)}\n`);
  return sites;
}
