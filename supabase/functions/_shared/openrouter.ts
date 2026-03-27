const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_HEADERS = {
  'HTTP-Referer': 'https://forwardfocuselevation.org',
  'X-Title': 'Forward Focus Elevation',
  'Content-Type': 'application/json',
};

export interface FetchWithFallbackOpts {
  apiKey: string;
  models: string[];
  messages: Array<{ role: string; content: string }>;
  maxTokens?: number;
  temperature?: number;
}

export async function fetchWithFallback(opts: FetchWithFallbackOpts): Promise<{ content: string; model: string }> {
  const { apiKey, models, messages, maxTokens = 1000, temperature } = opts;

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: { ...OPENROUTER_HEADERS, Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          max_tokens: maxTokens,
          ...(temperature !== undefined && { temperature }),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || '';
        if (i > 0) console.log(`Fallback succeeded with model: ${model}`);
        return { content, model };
      }

      const errText = await res.text();
      console.warn(`Model ${model} failed (${res.status}): ${errText.slice(0, 200)}`);

      // Only retry on rate-limit / billing / service errors
      if (res.status !== 429 && res.status !== 402 && res.status !== 503 && res.status !== 500) {
        throw new Error(`OpenRouter error ${res.status}: ${errText}`);
      }
      // Fall through to try next model
    } catch (err) {
      // Network errors — try next model if available
      if (i < models.length - 1) {
        console.warn(`Model ${model} network error, trying fallback:`, err);
        continue;
      }
      throw err;
    }
  }

  throw new Error('All models exhausted — no response generated');
}
