#!/usr/bin/env node
// generate --brief brief.json [--provider mock|anthropic|openai] [--model ID]
//          [--out sites] [--manifest sites.json] [--form-endpoint https://...]
import { realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { BriefError } from '../src/brief.js';
import { CopyError } from '../src/copy.js';
import { buildManifest, generateSite } from '../src/generator.js';
import { PROVIDERS, createProvider } from '../src/providers/index.js';

const USAGE = `Usage: generate --brief <brief.json> [options]

Options:
  --brief <file>          Business brief (JSON). See briefs/ for examples.
  --provider <name>       ${PROVIDERS.join(' | ')} (default: anthropic, or $SITEGEN_PROVIDER)
  --model <id>            Override the provider's default model
  --out <dir>             Output directory for sites (default: sites)
  --manifest <file>       Manifest file to update (default: sites.json)
  --form-endpoint <url>   Contact form POST target (overrides the brief)
  --manifest-only         Rebuild the manifest without generating
  -h, --help              Show this help
`;

export async function main(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      brief: { type: 'string' },
      provider: { type: 'string' },
      model: { type: 'string' },
      out: { type: 'string', default: 'sites' },
      manifest: { type: 'string', default: 'sites.json' },
      'form-endpoint': { type: 'string' },
      'manifest-only': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help) {
    process.stdout.write(USAGE);
    return 0;
  }
  const sitesDir = path.resolve(values.out);
  const manifestPath = path.resolve(values.manifest);

  if (!values['manifest-only']) {
    if (!values.brief) {
      process.stderr.write(USAGE);
      return 2;
    }
    const raw = JSON.parse(await readFile(values.brief, 'utf8'));
    const provider = await createProvider(values.provider || process.env.SITEGEN_PROVIDER || 'anthropic', { model: values.model });
    const { meta, outDir } = await generateSite(raw, { provider, sitesDir, formEndpoint: values['form-endpoint'] });
    process.stdout.write(`Generated ${meta.name} with ${meta.provider} (${meta.model}) -> ${path.relative(process.cwd(), outDir) || outDir}\n`);
  }

  const sites = await buildManifest(sitesDir, manifestPath);
  process.stdout.write(`Manifest lists ${sites.length} site(s) -> ${path.relative(process.cwd(), manifestPath)}\n`);
  return 0;
}

const isDirectRun = process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().then((code) => { process.exitCode = code; }, (err) => {
    if (err instanceof BriefError || err instanceof CopyError) {
      process.stderr.write(`${err.message}\n`);
    } else {
      process.stderr.write(`Error: ${err.message}\n`);
    }
    process.exitCode = 1;
  });
}
