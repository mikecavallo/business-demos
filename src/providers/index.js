import { createMockProvider } from './mock.js';

export const PROVIDERS = ['mock', 'anthropic', 'openai'];

/** Create a provider by name. LLM SDKs are imported lazily so mock runs need no keys. */
export async function createProvider(name, options = {}) {
  switch (name) {
    case 'mock':
      return createMockProvider(options);
    case 'anthropic': {
      const { createAnthropicProvider } = await import('./anthropic.js');
      return createAnthropicProvider(options);
    }
    case 'openai': {
      const { createOpenAIProvider } = await import('./openai.js');
      return createOpenAIProvider(options);
    }
    default:
      throw new Error(`Unknown provider "${name}". Use one of: ${PROVIDERS.join(', ')}`);
  }
}
