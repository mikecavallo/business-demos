// Anthropic Claude provider. Uses structured outputs so the response is JSON
// matching COPY_SCHEMA.
import Anthropic from '@anthropic-ai/sdk';
import { COPY_SCHEMA } from '../copy.js';
import { SYSTEM_PROMPT, buildUserPrompt } from '../prompt.js';

export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-5-5';

export function createAnthropicProvider({ model, client } = {}) {
  const resolvedModel = model || process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL;
  // The SDK resolves credentials from ANTHROPIC_API_KEY (or an `ant auth login` profile).
  const api = client || new Anthropic();
  return {
    name: 'anthropic',
    model: resolvedModel,
    async generateCopy(brief, { feedback = [] } = {}) {
      const response = await api.messages.create({
        model: resolvedModel,
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserPrompt(brief, feedback) }],
        output_config: { effort: 'low', format: { type: 'json_schema', schema: COPY_SCHEMA } },
      });
      if (response.stop_reason === 'refusal') {
        throw new Error(`Claude declined the request (${response.stop_details?.category ?? 'no category'})`);
      }
      if (response.stop_reason === 'max_tokens') {
        throw new Error('Claude response was cut off at max_tokens');
      }
      const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
      return JSON.parse(text);
    },
  };
}
