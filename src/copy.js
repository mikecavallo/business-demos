// The copy contract between providers and templates, plus the guardrails
// that keep generated text from inventing facts about a business.

export const COPY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'metaDescription', 'heroHeadline', 'heroSubhead', 'intro', 'services',
    'highlights', 'aboutHeadline', 'aboutParagraphs', 'serviceAreaText',
    'ctaHeadline', 'ctaText', 'contactIntro',
  ],
  properties: {
    metaDescription: { type: 'string', description: 'Under 160 characters.' },
    heroHeadline: { type: 'string', description: 'Under 70 characters.' },
    heroSubhead: { type: 'string' },
    intro: { type: 'string', description: 'One home-page paragraph.' },
    services: {
      type: 'array',
      description: 'One entry per service in the brief, same order, same names.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'description'],
        properties: { name: { type: 'string' }, description: { type: 'string' } },
      },
    },
    highlights: {
      type: 'array',
      description: 'Exactly 3 reasons to choose the business, based only on brief facts.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'text'],
        properties: { title: { type: 'string' }, text: { type: 'string' } },
      },
    },
    aboutHeadline: { type: 'string' },
    aboutParagraphs: { type: 'array', items: { type: 'string' }, description: '2 or 3 paragraphs.' },
    serviceAreaText: { type: 'string' },
    ctaHeadline: { type: 'string' },
    ctaText: { type: 'string' },
    contactIntro: { type: 'string' },
  },
};

export class CopyError extends Error {
  constructor(problems) {
    super(`Generated copy rejected:\n  - ${problems.join('\n  - ')}`);
    this.name = 'CopyError';
    this.problems = problems;
  }
}

/** Structural check: every field present with the right type and counts. */
export function validateCopyShape(copy, brief) {
  const problems = [];
  if (!copy || typeof copy !== 'object') throw new CopyError(['copy must be an object']);
  for (const key of COPY_SCHEMA.required) {
    if (!(key in copy)) problems.push(`missing field "${key}"`);
  }
  const strings = ['metaDescription', 'heroHeadline', 'heroSubhead', 'intro', 'aboutHeadline',
    'serviceAreaText', 'ctaHeadline', 'ctaText', 'contactIntro'];
  for (const key of strings) {
    if (key in copy && (typeof copy[key] !== 'string' || !copy[key].trim())) {
      problems.push(`"${key}" must be a non-empty string`);
    }
  }
  if (!Array.isArray(copy.services) || copy.services.length !== brief.services.length) {
    problems.push(`"services" must have exactly ${brief.services.length} entries`);
  } else {
    copy.services.forEach((s, i) => {
      if (!s || typeof s.description !== 'string' || !s.description.trim()) {
        problems.push(`services[${i}].description must be a non-empty string`);
      }
    });
  }
  if (!Array.isArray(copy.highlights) || copy.highlights.length !== 3) {
    problems.push('"highlights" must have exactly 3 entries');
  }
  if (!Array.isArray(copy.aboutParagraphs) || copy.aboutParagraphs.length < 1 || copy.aboutParagraphs.length > 3) {
    problems.push('"aboutParagraphs" must have 1 to 3 entries');
  }
  if (problems.length) throw new CopyError(problems);

  // Service names always come from the brief, never from the model.
  return {
    ...copy,
    services: copy.services.map((s, i) => ({ name: brief.services[i].name, description: s.description.trim() })),
  };
}

function allCopyText(copy) {
  const parts = [];
  const walk = (value) => {
    if (typeof value === 'string') parts.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(copy);
  return parts.join('\n');
}

// Words that signal social proof. Reviews may only appear when supplied in the
// brief, and they are rendered by the template, never written by the model.
const SOCIAL_PROOF = /\b(testimonials?|reviews?|reviewed|rated|ratings?|five[- ]star|5[- ]star|stars|customers (say|love)|clients (say|love))\b/i;

// Claims that need a source. Allowed only if the same word appears in the brief.
const CLAIM_WORDS = ['licensed', 'bonded', 'insured', 'certified', 'accredited', 'award', 'award-winning',
  'guarantee', 'guaranteed', 'warranty', 'background-checked', 'family-owned', 'veteran-owned'];

const SUPERLATIVES = /\b(top[- ]rated|best in|#1|number one|trusted by|most trusted|voted)\b/i;

/**
 * Content check: reject copy that invents testimonials, credentials, numbers
 * or superlatives not present in the brief. Returns the list of problems.
 */
export function findFabrications(copy, brief) {
  const problems = [];
  const text = allCopyText(copy);
  const briefText = JSON.stringify({ ...brief, reviews: [] }).toLowerCase();

  const proof = text.match(SOCIAL_PROOF);
  if (proof) problems.push(`mentions social proof ("${proof[0]}"); reviews come only from brief data`);

  for (const word of CLAIM_WORDS) {
    const re = new RegExp(`\\b${word}\\b`, 'i');
    if (re.test(text) && !briefText.includes(word)) {
      problems.push(`claims "${word}" but the brief does not`);
    }
  }

  const sup = text.match(SUPERLATIVES);
  if (sup && !briefText.includes(sup[0].toLowerCase())) {
    problems.push(`unsupported superlative "${sup[0]}"`);
  }

  // Every number in the copy (years, counts, percentages, hours) must appear in the brief.
  const numbers = new Set(text.match(/\d+(?:[.,]\d+)?/g) || []);
  for (const n of numbers) {
    if (!briefText.includes(n.toLowerCase())) problems.push(`number "${n}" does not appear in the brief`);
  }

  // Phone numbers and emails are placed by templates, never by copy.
  if (/\(\d{3}\)\s*\d{3}-\d{4}|\b\d{3}-\d{3}-\d{4}\b/.test(text)) problems.push('copy contains a phone number');
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(text)) problems.push('copy contains an email address');

  return problems;
}
