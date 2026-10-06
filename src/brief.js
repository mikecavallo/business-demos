// Brief loading and validation. A brief is the only source of facts about a
// business: anything the generator publishes (phone, credentials, reviews,
// years in business) must come from here, never from the model.

const HEX = /^#[0-9a-fA-F]{6}$/;
const TONES = ['friendly', 'professional', 'premium', 'no-nonsense'];

export class BriefError extends Error {
  constructor(problems) {
    super(`Invalid brief:\n  - ${problems.join('\n  - ')}`);
    this.name = 'BriefError';
    this.problems = problems;
  }
}

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validate a raw brief object and return a normalized copy with defaults.
 * Throws BriefError listing every problem found.
 */
export function normalizeBrief(raw) {
  const problems = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new BriefError(['brief must be a JSON object']);
  }

  for (const key of ['name', 'trade', 'city', 'phone']) {
    if (!isNonEmptyString(raw[key])) problems.push(`"${key}" is required (non-empty string)`);
  }

  const services = Array.isArray(raw.services) ? raw.services : [];
  if (services.length < 1 || services.length > 8) {
    problems.push('"services" must be an array of 1 to 8 items');
  }
  const normalizedServices = services.map((service, i) => {
    if (typeof service === 'string') return { name: service.trim(), details: '' };
    if (service && isNonEmptyString(service.name)) {
      return { name: service.name.trim(), details: isNonEmptyString(service.details) ? service.details.trim() : '' };
    }
    problems.push(`services[${i}] must be a string or { "name": string, "details"?: string }`);
    return null;
  }).filter(Boolean);

  const colors = { primary: '#1d4ed8', accent: '#f59e0b', ...(raw.colors || {}) };
  for (const key of ['primary', 'accent']) {
    if (!HEX.test(colors[key])) problems.push(`colors.${key} must be a 6-digit hex color like #1d4ed8`);
  }

  const tone = raw.tone ?? 'friendly';
  if (!TONES.includes(tone)) problems.push(`"tone" must be one of: ${TONES.join(', ')}`);

  const reviews = raw.reviews ?? [];
  if (!Array.isArray(reviews)) problems.push('"reviews" must be an array when present');
  const normalizedReviews = (Array.isArray(reviews) ? reviews : []).map((review, i) => {
    if (!review || !isNonEmptyString(review.text) || !isNonEmptyString(review.author)) {
      problems.push(`reviews[${i}] needs "author" and "text"`);
      return null;
    }
    return {
      author: review.author.trim(),
      text: review.text.trim(),
      source: isNonEmptyString(review.source) ? review.source.trim() : '',
    };
  }).filter(Boolean);

  const credentials = raw.credentials ?? [];
  if (!Array.isArray(credentials) || !credentials.every(isNonEmptyString)) {
    problems.push('"credentials" must be an array of strings when present');
  }

  if (raw.yearFounded !== undefined && !(Number.isInteger(raw.yearFounded) && raw.yearFounded > 1800)) {
    problems.push('"yearFounded" must be an integer year when present');
  }

  if (raw.formEndpoint !== undefined && raw.formEndpoint !== null) {
    if (!isNonEmptyString(raw.formEndpoint) || !/^https:\/\//.test(raw.formEndpoint)) {
      problems.push('"formEndpoint" must be an https:// URL when present');
    }
  }

  if (raw.email !== undefined && !(isNonEmptyString(raw.email) && raw.email.includes('@'))) {
    problems.push('"email" must be an email address when present');
  }

  if (problems.length) throw new BriefError(problems);

  return {
    name: raw.name.trim(),
    slug: isNonEmptyString(raw.slug) ? slugify(raw.slug) : slugify(raw.name),
    trade: raw.trade.trim(),
    city: raw.city.trim(),
    serviceArea: Array.isArray(raw.serviceArea) ? raw.serviceArea.filter(isNonEmptyString) : [],
    phone: raw.phone.trim(),
    email: isNonEmptyString(raw.email) ? raw.email.trim() : '',
    hours: isNonEmptyString(raw.hours) ? raw.hours.trim() : '',
    services: normalizedServices,
    colors,
    tone,
    audience: isNonEmptyString(raw.audience) ? raw.audience.trim() : '',
    differentiators: (Array.isArray(raw.differentiators) ? raw.differentiators : []).map((d) => {
      if (isNonEmptyString(d)) return { title: d.trim(), detail: '' };
      if (d && isNonEmptyString(d.title)) return { title: d.title.trim(), detail: isNonEmptyString(d.detail) ? d.detail.trim() : '' };
      return null;
    }).filter(Boolean),
    credentials: credentials.map((c) => c.trim()),
    yearFounded: raw.yearFounded ?? null,
    reviews: normalizedReviews,
    formEndpoint: raw.formEndpoint || null,
    demo: raw.demo === true,
  };
}
