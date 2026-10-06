// Optional OpenAI provider, using Chat Completions with a strict JSON schema.
import OpenAI from 'openai';
import { COPY_SCHEMA } from '../copy.js';
import { SYSTEM_PROMPT, buildUserPrompt } from '../prompt.js';

export const DEFAULT_OPENAI_MODEL = 'gpt-5.5';

export function createOpenAIProvider({ model, client } = {}) {
  const resolvedModel = model || process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;
  const api = client || new OpenAI(); // reads OPENAI_API_KEY
  return {
    name: 'openai',
    model: resolvedModel,
    async generateCopy(brief, { feedback = [] } = {}) {
      const completion = await api.chat.completions.create({
        model: resolvedModel,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(brief, feedback) },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'site_copy', strict: true, schema: COPY_SCHEMA },
        },
      });
      const message = completion.choices[0]?.message;
      if (message?.refusal) throw new Error(`OpenAI declined the request: ${message.refusal}`);
      return JSON.parse(message?.content ?? '');
    },
  };
}
