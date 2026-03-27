

## Add Fallback Models to All 7 Edge Functions

### Approach
Create a shared `fetchWithFallback` helper in `_shared/openrouter.ts` that every edge function imports. It tries the primary model, and if it gets a 429, 402, 500, or network error, automatically retries with a fallback model.

### New file: `supabase/functions/_shared/openrouter.ts`

```typescript
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_HEADERS = {
  'HTTP-Referer': 'https://forwardfocuselevation.org',
  'X-Title': 'Forward Focus Elevation',
  'Content-Type': 'application/json',
};

export async function fetchWithFallback(opts: {
  apiKey: string;
  models: string[];       // [primary, fallback1, fallback2...]
  messages: any[];
  maxTokens?: number;
  temperature?: number;
}): Promise<{ content: string; model: string }> {
  for (const model of opts.models) {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: { ...OPENROUTER_HEADERS, Authorization: `Bearer ${opts.apiKey}` },
      body: JSON.stringify({
        model,
        messages: opts.messages,
        stream: false,
        max_tokens: opts.maxTokens ?? 1000,
        temperature: opts.temperature,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return { content: data.choices?.[0]?.message?.content || '', model };
    }
    const errText = await res.text();
    console.warn(`Model ${model} failed (${res.status}): ${errText}`);
    if (res.status !== 429 && res.status !== 402 && res.status !== 503) {
      throw new Error(`OpenRouter error ${res.status}: ${errText}`);
    }
    // 429/402/503 → try next model
  }
  throw new Error('All models exhausted');
}
```

### Fallback model assignments

| Function | Primary | Fallback |
|---|---|---|
| `coach-k` | `meta-llama/llama-3.3-70b-instruct:free` | `google/gemma-3-27b-it:free` |
| `chat` | `meta-llama/llama-3.3-70b-instruct:free` | `google/gemma-3-27b-it:free` |
| `crisis-support-ai` | `google/gemma-3-27b-it:free` | `meta-llama/llama-3.3-70b-instruct:free` |
| `crisis-emergency-ai` | `google/gemma-3-27b-it:free` | `meta-llama/llama-3.3-70b-instruct:free` |
| `victim-support-ai` | `nousresearch/hermes-3-405b-instruct:free` | `meta-llama/llama-3.3-70b-instruct:free` |
| `ai-resource-discovery` | `qwen/qwen3-next-80b-a3b-instruct:free` | `meta-llama/llama-3.3-70b-instruct:free` |
| `reentry-navigator-ai` | `nvidia/llama-3.1-nemotron-70b-instruct:free` | `meta-llama/llama-3.3-70b-instruct:free` |

Llama 3.3 70B serves as the universal fallback since it's the most reliable free model.

### Per-function changes

Each function replaces its inline `fetch()` + error handling block with:

```typescript
import { fetchWithFallback } from '../_shared/openrouter.ts';

const { content, model } = await fetchWithFallback({
  apiKey: OPENROUTER_API_KEY,
  models: ['<primary>:free', 'meta-llama/llama-3.3-70b-instruct:free'],
  messages,
  maxTokens: 1000,
});
console.log(`Used model: ${model}`);
```

The existing 429/402 error responses in each function become a single catch block — if `fetchWithFallback` throws "All models exhausted", return the friendly fallback message with crisis hotlines. All other logic (DB queries, resource filtering, response format) stays unchanged.

### Files modified
1. **New**: `supabase/functions/_shared/openrouter.ts` — shared helper
2. `supabase/functions/coach-k/index.ts` — use helper with 2 models
3. `supabase/functions/chat/index.ts` — use helper with 2 models
4. `supabase/functions/crisis-support-ai/index.ts` — use helper with 2 models
5. `supabase/functions/crisis-emergency-ai/index.ts` — use helper with 2 models
6. `supabase/functions/victim-support-ai/index.ts` — use helper with 2 models
7. `supabase/functions/ai-resource-discovery/index.ts` — use helper with 2 models
8. `supabase/functions/reentry-navigator-ai/index.ts` — use helper with 2 models

