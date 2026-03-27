

## Migrate 6 AI Edge Functions to OpenRouter + Fix Trial System

### Secret needed
- `OPENROUTER_API_KEY` — user provides value

### Model assignments

| Function | Model | Streaming |
|---|---|---|
| `coach-k` | `meta-llama/llama-3.3-70b-instruct:free` | `false` → JSON |
| `crisis-support-ai` | `google/gemma-3-27b-it:free` | `false` → JSON |
| `crisis-emergency-ai` | `google/gemma-3-27b-it:free` | `false` → JSON |
| `victim-support-ai` | `nousresearch/hermes-3-405b-instruct:free` | `false` → JSON |
| `ai-resource-discovery` | `qwen/qwen3-next-80b-a3b-instruct:free` | `false` → JSON |
| `reentry-navigator-ai` | `nvidia/llama-3.1-nemotron-70b-instruct:free` | `false` → JSON |

`chat/index.ts` also migrated (uses topic routing, called by YouthGames) — model `meta-llama/llama-3.3-70b-instruct:free`.

---

### Shared pattern applied to all 7 functions

```typescript
const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
if (!OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is not configured');

const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
    'HTTP-Referer': 'https://forwardfocuselevation.org',
    'X-Title': 'Forward Focus Elevation',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: '<per-function model>',
    messages,
    stream: false,
    max_tokens: 1000,
  }),
});
if (response.status === 429) return /* friendly rate limit response */;
if (response.status === 402) return /* friendly quota response */;
const data = await response.json();
const content = data.choices[0].message.content;
```

Updated CORS headers (all functions):
```
authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version
```

---

### Per-function changes

**1. `coach-k/index.ts`** — Llama 3.3 70B
- Replace `OPENAI_API_KEY` → `OPENROUTER_API_KEY`, OpenAI URL → OpenRouter
- **Convert SSE → JSON**: return `{ response: content }` instead of piping stream
- Rate-limit errors also become JSON (not SSE ReadableStream)
- Delete entire Perplexity web search block (lines 104-134)
- Keep shared `_shared/rate-limit.ts` import, keep full system prompt

**2. `chat/index.ts`** — Llama 3.3 70B
- Replace `OPENAI_API_KEY` → `OPENROUTER_API_KEY`, OpenAI → OpenRouter
- **Always JSON** `{ response: content }` — remove SSE branch and `stream` parameter handling
- Add `import { checkAiRateLimit } from '../_shared/rate-limit.ts'` + Supabase client
- YouthGames already calls with `stream: false` via `supabase.functions.invoke` — will work as-is

**3. `crisis-support-ai/index.ts`** — Gemma 3 27B
- Delete inline `checkRateLimit`, `recordRequest`, `getClientIdentifier` (lines 18-75)
- Add `import { checkAiRateLimit } from '../_shared/rate-limit.ts'`, use it
- Replace OpenAI → OpenRouter, delete `recordRequest` call
- Delete Perplexity block (lines 254-287), remove `webResources` from response
- Delete all 3 `log_ai_usage` RPC calls
- Keep DB queries, system prompt, resource filtering, fallback messages

**4. `victim-support-ai/index.ts`** — Hermes 3 405B
- Delete inline `checkRateLimit`, `recordRequest`, `getClientIdentifier` (lines 19-73)
- Add `import { checkAiRateLimit } from '../_shared/rate-limit.ts'`
- Replace OpenAI → OpenRouter, delete `recordRequest` call (line 116)
- Delete Perplexity block (lines 191-224), remove `webResources` from response
- Keep DB queries, system prompt, resource filtering

**5. `crisis-emergency-ai/index.ts`** — Gemma 3 27B
- Already imports shared rate-limit — keep it
- Replace `OPENAI_API_KEY` → `OPENROUTER_API_KEY`, OpenAI → OpenRouter
- Delete Perplexity block (lines 120-152), remove `webResources` from response
- Delete 2 `log_ai_usage` RPC calls (lines 178-186, 209-217)

**6. `ai-resource-discovery/index.ts`** — Qwen3 80B
- Add `import { checkAiRateLimit } from '../_shared/rate-limit.ts'` + use it
- Replace `OPENAI_API_KEY` → `OPENROUTER_API_KEY`, OpenAI → OpenRouter
- Delete Perplexity block (lines 166-222), remove `webResources` from response
- Delete 3 `log_ai_usage` RPC calls
- Keep DB queries, system prompt, resource context building

**7. `reentry-navigator-ai/index.ts`** — Nemotron 70B
- Replace `LOVABLE_API_KEY` → `OPENROUTER_API_KEY`, Lovable Gateway → OpenRouter + headers
- Delete Perplexity block (lines 117-150), remove `webResources` from response
- Keep shared rate-limit import, keep all coach persona system prompts, keep DB queries

---

### `_shared/rate-limit.ts` — Update limits

- `GUEST_MAX_REQUESTS`: 5 → **10**
- `AUTHED_MAX_REQUESTS`: 50 → stays 50
- Add `SOFT_LIMIT_GUEST = 7` export (used by frontend)
- Return `remaining` count in rate-limit response so frontend can show soft nudge

---

### Frontend changes

**8. `AskCoachKay.tsx`** — coach-k now returns JSON
- Replace SSE stream reader (lines 90-124) with:
  ```typescript
  const data = await response.json();
  const content = data.response || '';
  setMessages(prev => {
    const updated = [...prev];
    updated[updated.length - 1].content = content;
    return updated;
  });
  ```

**9. `AIWithTrial.tsx`** — Fix trial/usage system
- Change `turnsRemaining` default from 5 → **10**
- Change authenticated limit from 50 → stays 50
- At 7+ messages (for guests): show soft nudge banner ("Sign up for unlimited access")
- At 10+ messages: show the `TrialExpiredPrompt`
- Remove dependency on broken `track_anonymous_ai_usage` RPC — use the rate-limit `remaining` count returned from edge function responses instead

**10. `useAnonymousSession.ts`** — Simplify
- Change hardcoded `5` → `10` for turns calculation (line 69)
- The core logic stays (localStorage session token, trial tracking)

**11. `ChatbotPopup.tsx`** — DELETE this file
- It's a redundant duplicate of AskCoachKay that also uses SSE parsing

**12. `AboutUs.tsx`** — Remove `ChatbotPopup` import, replace with `AskCoachKay` or remove

---

### What stays untouched
- `_shared/rate-limit.ts` structure (just constant changes)
- All system prompts — preserved as-is in every function
- All DB resource queries — preserved as-is
- All coach persona prompts in `reentry-navigator-ai` — preserved
- `generate-success-story`, `generate-marketing-image`, `ai-recommend-resources` — keep Lovable Gateway
- `YouthGames.tsx` — already uses `supabase.functions.invoke('chat')` with non-streaming, works as-is

