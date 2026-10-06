// Prompt construction shared by the LLM providers.

export const SYSTEM_PROMPT = `You write website copy for small local service businesses.
You will receive a JSON business brief. Write copy for a 4-page site (home, services, about, contact)
and return it as JSON matching the provided schema.

Facts rule: the brief is the only source of facts. Do not invent:
- testimonials, reviews, ratings, star counts, or quotes from customers
- licenses, insurance, certifications, awards, warranties or guarantees not listed in the brief
- years in business, founding dates, job counts, percentages, response times or any other number not in the brief
- superlatives such as "top-rated", "#1", "best in", "trusted by"
- phone numbers, emails or addresses (the templates insert contact details)
If the brief is thin, write shorter, plainer copy rather than filling gaps with claims.

Style: match the requested tone, write for the stated audience, keep sentences short and concrete,
use plain American English, and never use em dashes.`;

export function buildUserPrompt(brief, feedback = []) {
  const facts = {
    name: brief.name.replace(/\s*\(fictional demo\)\s*/i, ''),
    trade: brief.trade,
    city: brief.city,
    serviceArea: brief.serviceArea,
    services: brief.services,
    tone: brief.tone,
    audience: brief.audience,
    differentiators: brief.differentiators,
    credentials: brief.credentials,
    yearFounded: brief.yearFounded,
    hours: brief.hours,
  };
  let prompt = `Business brief:\n${JSON.stringify(facts, null, 2)}\n\n` +
    `Return exactly ${brief.services.length} service entries in the same order as the brief, and exactly 3 highlights.`;
  if (feedback.length) {
    prompt += `\n\nYour previous draft was rejected for these reasons. Fix every one:\n- ${feedback.join('\n- ')}`;
  }
  return prompt;
}
