// Deterministic offline provider. It assembles copy from the brief with fixed
// sentence patterns, so tests, CI and the committed demos run without an API
// key and produce byte-identical output on every run. It is not an LLM: the
// prose is plainer than what the Claude or OpenAI providers write.

const TONE = {
  friendly: {
    heroLead: (b) => `Friendly ${b.trade.toLowerCase()} help for ${b.city} homes`,
    cta: 'Ready when you are',
    sign: 'We would be glad to help.',
  },
  professional: {
    heroLead: (b) => `${b.trade} services in ${b.city}`,
    cta: 'Schedule service',
    sign: 'We look forward to working with you.',
  },
  premium: {
    heroLead: (b) => `Careful, detail-minded ${b.trade.toLowerCase()} work in ${b.city}`,
    cta: 'Book a consultation',
    sign: 'We take on a limited number of projects so each one gets our full attention.',
  },
  'no-nonsense': {
    heroLead: (b) => `${b.trade}. Done right in ${b.city}.`,
    cta: 'Get it handled',
    sign: 'Call, tell us the problem, and we will tell you straight what it takes.',
  },
};

function displayName(brief) {
  return brief.name.replace(/\s*\(fictional demo\)\s*/i, '');
}

function sentence(text) {
  const t = text.trim().replace(/\s+/g, ' ');
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

function lowerFirst(text) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function listJoin(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function mockCopy(brief) {
  const tone = TONE[brief.tone] || TONE.friendly;
  const name = displayName(brief);
  const area = brief.serviceArea.length ? listJoin([brief.city, ...brief.serviceArea]) : brief.city;
  const serviceNames = brief.services.map((s) => (/^[A-Z]{2}/.test(s.name) ? s.name : lowerFirst(s.name)));
  const audience = brief.audience || `homeowners and businesses in ${brief.city}`;

  const fallbackHighlights = [
    { title: 'Clear communication', text: 'You hear what we found and what it will take before any work starts.' },
    { title: 'Local to you', text: `We work in ${area}, so we know the homes and conditions here.` },
    { title: 'Focused services', text: `We stick to what we do well: ${listJoin(serviceNames)}.` },
  ];
  const highlights = brief.differentiators.slice(0, 3).map((d) => ({
    title: d.title.replace(/\.$/, ''),
    text: d.detail ? sentence(d.detail) : sentence(d.title),
  }));
  while (highlights.length < 3) highlights.push(fallbackHighlights[highlights.length]);

  const credentialLine = brief.credentials.length ? ` ${sentence(listJoin(brief.credentials))}` : '';
  const foundedLine = brief.yearFounded ? ` ${name} has served the area since ${brief.yearFounded}.` : '';

  return {
    metaDescription: sentence(`${name} offers ${listJoin(serviceNames)} in ${brief.city}`).slice(0, 158),
    heroHeadline: tone.heroLead(brief),
    heroSubhead: sentence(`${brief.services.slice(0, 3).map((s) => s.name).join(', ')} for ${audience}`),
    intro: `${name} provides ${listJoin(serviceNames)} for ${audience}.${foundedLine} ${tone.sign}`,
    services: brief.services.map((s) => ({
      name: s.name,
      description: s.details
        ? sentence(s.details)
        : sentence(`${s.name} for ${audience}, with a clear explanation of the work before we start`),
    })),
    highlights,
    aboutHeadline: `About ${name}`,
    aboutParagraphs: [
      `${name} is a ${brief.trade.toLowerCase()} business serving ${area}.${foundedLine}`,
      `Our work centers on ${listJoin(serviceNames)}.${credentialLine}`,
      brief.differentiators.length
        ? `What we care about: ${listJoin(brief.differentiators.map((d) => lowerFirst(d.title.replace(/\.$/, ''))))}.`
        : tone.sign,
    ],
    serviceAreaText: `We serve ${area}.`,
    ctaHeadline: tone.cta,
    ctaText: sentence(`Tell us what you need and ${name} will follow up to schedule a visit`),
    contactIntro: brief.hours
      ? `Call or send a message. Office hours: ${brief.hours}.`
      : 'Call or send a message and we will get back to you.',
  };
}

export function createMockProvider() {
  return {
    name: 'mock',
    model: 'mock-template-v1',
    async generateCopy(brief) {
      return mockCopy(brief);
    },
  };
}
