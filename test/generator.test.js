import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { BriefError, normalizeBrief, slugify } from '../src/brief.js';
import { CopyError, findFabrications, validateCopyShape } from '../src/copy.js';
import { buildManifest, generateCopy, generateSite } from '../src/generator.js';
import { buildUserPrompt } from '../src/prompt.js';
import { createAnthropicProvider, DEFAULT_ANTHROPIC_MODEL } from '../src/providers/anthropic.js';
import { createProvider } from '../src/providers/index.js';
import { mockCopy } from '../src/providers/mock.js';
import { createOpenAIProvider } from '../src/providers/openai.js';
import { esc, readableOn, renderSite } from '../src/render.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = promisify(execFile);

const baseBrief = () => ({
  name: 'Example Pipe Co (fictional demo)',
  demo: true,
  trade: 'Plumbing',
  city: 'Testville, NC',
  phone: '(910) 555-0100',
  services: ['Drain cleaning', { name: 'Water heaters', details: 'Repair and replacement' }],
  colors: { primary: '#0f4c5c', accent: '#f4a259' },
  tone: 'friendly',
});

let tmp;
before(async () => { tmp = await mkdtemp(path.join(os.tmpdir(), 'sitegen-')); });
after(async () => { await rm(tmp, { recursive: true, force: true }); });

describe('brief validation', () => {
  it('normalizes a minimal brief with defaults', () => {
    const brief = normalizeBrief(baseBrief());
    assert.equal(brief.slug, 'example-pipe-co');
    assert.deepEqual(brief.services[0], { name: 'Drain cleaning', details: '' });
    assert.deepEqual(brief.reviews, []);
    assert.equal(brief.formEndpoint, null);
  });

  it('reports every problem at once', () => {
    const bad = { ...baseBrief(), name: '', phone: undefined, colors: { primary: 'blue' }, tone: 'snarky' };
    assert.throws(() => normalizeBrief(bad), (err) => {
      assert.ok(err instanceof BriefError);
      assert.ok(err.problems.length >= 4, err.message);
      return true;
    });
  });

  it('requires https form endpoints and complete reviews', () => {
    assert.throws(() => normalizeBrief({ ...baseBrief(), formEndpoint: 'http://x.test' }), BriefError);
    assert.throws(() => normalizeBrief({ ...baseBrief(), reviews: [{ text: 'no author' }] }), BriefError);
  });

  it('slugifies names', () => {
    assert.equal(slugify('Gullwing Heating & Air (fictional demo)'), 'gullwing-heating-and-air');
  });
});

describe('copy guardrails', () => {
  const brief = normalizeBrief(baseBrief());
  const good = () => mockCopy(brief);

  it('accepts the mock copy', () => {
    assert.deepEqual(findFabrications(validateCopyShape(good(), brief), brief), []);
  });

  for (const [label, text] of [
    ['testimonials', 'Read what our customers say in these testimonials.'],
    ['star ratings', 'A 5-star plumber.'],
    ['unlisted credentials', 'Fully licensed and insured.'],
    ['invented years', 'Serving Testville since 1998.'],
    ['superlatives', 'The top-rated plumber in town.'],
    ['phone numbers', 'Call 910-555-0199 today.'],
  ]) {
    it(`rejects ${label}`, () => {
      const copy = { ...good(), intro: text };
      assert.ok(findFabrications(copy, brief).length > 0, text);
    });
  }

  it('allows a claim when the brief supplies it', () => {
    const withCreds = normalizeBrief({ ...baseBrief(), credentials: ['Licensed in North Carolina'], yearFounded: 1998 });
    const copy = { ...mockCopy(withCreds), intro: 'Licensed plumbers serving Testville since 1998.' };
    assert.deepEqual(findFabrications(copy, withCreds), []);
  });

  it('rejects malformed copy and keeps service names from the brief', () => {
    assert.throws(() => validateCopyShape({ ...good(), highlights: [] }, brief), CopyError);
    const renamed = { ...good(), services: good().services.map((s) => ({ ...s, name: 'Something else' })) };
    assert.equal(validateCopyShape(renamed, brief).services[0].name, 'Drain cleaning');
  });

  it('retries with feedback, then gives up', async () => {
    const calls = [];
    const flaky = {
      name: 'fake', model: 'fake',
      async generateCopy(b, { feedback }) {
        calls.push(feedback);
        return calls.length === 1 ? { ...mockCopy(b), intro: 'Rated 5 stars.' } : mockCopy(b);
      },
    };
    await generateCopy(brief, flaky);
    assert.equal(calls.length, 2);
    assert.ok(calls[1].some((f) => f.includes('social proof')));

    const stubborn = { name: 'bad', model: 'bad', async generateCopy(b) { return { ...mockCopy(b), intro: 'Award winning!' }; } };
    await assert.rejects(generateCopy(brief, stubborn), CopyError);
  });

  it('puts the feedback into the next prompt', () => {
    assert.match(buildUserPrompt(brief, ['number "12" does not appear in the brief']), /rejected[\s\S]*number "12"/);
  });
});

describe('rendering', () => {
  const brief = normalizeBrief(baseBrief());
  const files = renderSite(brief, mockCopy(brief));
  const html = Object.entries(files).filter(([f]) => f.endsWith('.html'));

  it('produces four pages and a stylesheet', () => {
    assert.deepEqual(Object.keys(files).sort(), ['about.html', 'contact.html', 'index.html', 'services.html', 'style.css']);
  });

  it('has no dead links, testimonials or review sections without brief data', () => {
    for (const [name, page] of html) {
      assert.doesNotMatch(page, /href="#"|action="#"/, name);
      assert.doesNotMatch(page, /testimonial|id="reviews"/i, name);
    }
  });

  it('shows the fictional-business ribbon on every page of a demo', () => {
    for (const [name, page] of html) assert.match(page, /Demo site, fictional business/, name);
    const real = normalizeBrief({ ...baseBrief(), demo: false });
    assert.doesNotMatch(renderSite(real, mockCopy(real))['index.html'], /class="ribbon"/);
  });

  it('shows a demo notice on the form when no endpoint is configured', () => {
    assert.match(files['contact.html'], /data-demo-form/);
    assert.match(files['contact.html'], /not connected/);
    assert.doesNotMatch(files['contact.html'], /<form[^>]*action=/);
  });

  it('posts the form to a configured endpoint', () => {
    const b = normalizeBrief({ ...baseBrief(), formEndpoint: 'https://forms.example.com/f/abc' });
    const page = renderSite(b, mockCopy(b))['contact.html'];
    assert.match(page, /<form action="https:\/\/forms\.example\.com\/f\/abc" method="post">/);
    assert.doesNotMatch(page, /data-demo-form/);
  });

  it('renders reviews only from brief data, escaped', () => {
    const b = normalizeBrief({ ...baseBrief(), reviews: [{ author: 'A. Tester', text: 'Fixed it <fast>', source: 'Google' }] });
    const page = renderSite(b, mockCopy(b))['index.html'];
    assert.match(page, /id="reviews"/);
    assert.match(page, /Fixed it &lt;fast&gt;/);
    assert.match(page, /A\. Tester, via Google/);
  });

  it('escapes HTML and picks readable text colors', () => {
    assert.equal(esc('<a href="x">&\''), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
    assert.equal(readableOn('#0f4c5c'), '#ffffff');
    assert.equal(readableOn('#facc15'), '#111827');
  });
});

describe('providers', () => {
  it('mock provider is deterministic', async () => {
    const p = await createProvider('mock');
    const brief = normalizeBrief(baseBrief());
    assert.deepEqual(await p.generateCopy(brief), await p.generateCopy(brief));
  });

  it('rejects unknown providers', async () => {
    await assert.rejects(createProvider('nope'), /Unknown provider/);
  });

  it('anthropic provider sends a structured-output request and parses JSON', async () => {
    const brief = normalizeBrief(baseBrief());
    let request;
    const client = { messages: { async create(req) {
      request = req;
      return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(mockCopy(brief)) }] };
    } } };
    const provider = createAnthropicProvider({ client });
    assert.equal(provider.model, DEFAULT_ANTHROPIC_MODEL);
    assert.equal(DEFAULT_ANTHROPIC_MODEL, 'claude-sonnet-5-5');
    const copy = await provider.generateCopy(brief);
    assert.equal(request.model, 'claude-sonnet-5-5');
    assert.equal(request.output_config.format.type, 'json_schema');
    assert.doesNotMatch(request.messages[0].content, /fictional demo/);
    assert.equal(copy.services.length, 2);
  });

  it('anthropic provider surfaces refusals', async () => {
    const client = { messages: { async create() { return { stop_reason: 'refusal', stop_details: { category: 'test' }, content: [] }; } } };
    await assert.rejects(createAnthropicProvider({ client }).generateCopy(normalizeBrief(baseBrief())), /declined/);
  });

  it('openai provider requests a strict JSON schema', async () => {
    const brief = normalizeBrief(baseBrief());
    let request;
    const client = { chat: { completions: { async create(req) {
      request = req;
      return { choices: [{ message: { content: JSON.stringify(mockCopy(brief)) } }] };
    } } } };
    const copy = await createOpenAIProvider({ client, model: 'test-model' }).generateCopy(brief);
    assert.equal(request.model, 'test-model');
    assert.equal(request.response_format.json_schema.strict, true);
    assert.equal(copy.highlights.length, 3);
  });
});

describe('site generation and CLI', () => {
  it('writes a site and a manifest', async () => {
    const sitesDir = path.join(tmp, 'api-sites');
    const provider = await createProvider('mock');
    const { meta } = await generateSite(baseBrief(), { provider, sitesDir });
    assert.equal(meta.provider, 'mock');
    const sites = await buildManifest(sitesDir, path.join(tmp, 'api-sites.json'));
    assert.equal(sites.length, 1);
    assert.equal(sites[0].path, 'api-sites/example-pipe-co/');
  });

  it('runs end to end from the command line', async () => {
    const briefPath = path.join(tmp, 'brief.json');
    await writeFile(briefPath, JSON.stringify(baseBrief()));
    const out = path.join(tmp, 'cli-sites');
    const manifest = path.join(tmp, 'cli.json');
    const { stdout } = await run('node', [path.join(root, 'bin/generate.js'), '--brief', briefPath,
      '--provider', 'mock', '--out', out, '--manifest', manifest, '--form-endpoint', 'https://forms.example.com/x']);
    assert.match(stdout, /Generated Example Pipe Co/);
    assert.deepEqual((await readdir(path.join(out, 'example-pipe-co'))).sort(),
      ['about.html', 'contact.html', 'index.html', 'services.html', 'site.json', 'style.css']);
    assert.match(await readFile(path.join(out, 'example-pipe-co', 'contact.html'), 'utf8'), /action="https:\/\/forms\.example\.com\/x"/);
    assert.equal(JSON.parse(await readFile(manifest, 'utf8')).sites.length, 1);
  });

  it('exits non-zero with a readable message for a bad brief', async () => {
    const briefPath = path.join(tmp, 'bad.json');
    await writeFile(briefPath, JSON.stringify({ name: 'x' }));
    await assert.rejects(
      run('node', [path.join(root, 'bin/generate.js'), '--brief', briefPath, '--provider', 'mock', '--out', path.join(tmp, 'bad')]),
      (err) => { assert.equal(err.code, 1); assert.match(err.stderr, /Invalid brief/); return true; },
    );
  });
});

describe('committed demos', () => {
  it('every brief is fictional, uses a 555-01xx number and passes the guardrails', async () => {
    const files = (await readdir(path.join(root, 'briefs'))).filter((f) => f.endsWith('.json'));
    assert.ok(files.length >= 2);
    for (const file of files) {
      const brief = normalizeBrief(JSON.parse(await readFile(path.join(root, 'briefs', file), 'utf8')));
      assert.equal(brief.demo, true, file);
      assert.match(brief.name, /\(fictional demo\)/, file);
      assert.match(brief.phone, /555-01\d\d$/, file);
      assert.deepEqual(findFabrications(mockCopy(brief), brief), [], file);
    }
  });
});
