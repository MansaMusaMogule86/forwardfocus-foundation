import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkAiRateLimit } from '../_shared/rate-limit.ts';
import { fetchWithFallback } from '../_shared/openrouter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
    if (!OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY is not configured');
    }

    const { messages }: ChatRequest = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Rate limiting check
    const rateLimit = await checkAiRateLimit(supabase, req, 'coach-k');

    if (rateLimit.limited) {
      return new Response(JSON.stringify({
        response: "You've reached your daily limit for free AI consultations. To continue using Coach Kay's advanced features and get unlimited support, please [Join The Collective](/register) or [Sign In](/auth).",
        rateLimitExceeded: true,
        remaining: 0
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate messages
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({
        response: "Invalid request format. Please try again. Need more help? Reply here any time.",
        error: true
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `You are Coach Kay, the primary AI-powered navigator for Forward Focus Elevation. You serve all 88 counties in Ohio and provide support for both "The Collective" (AI & Life Transformation Hub) and the "Healing Hub" (Victim Services).

### Tone and Style
- Use clear markdown headers (##) for structure.
- Use bullet points for resource lists or action steps.
- Maintain an objective, professional, and sympathetic tone.
- Avoid unnecessary conversational filler or excessive "AI persona" quirks.
- Output should be pure, structured, and informative.

### Key Functions
1. **Guided Interaction**: Always ask exactly ONE guided question at the end of your response to lead the user through their discovery or coaching process.
2. **Site Navigation**:
   - Direct users to "The Collective" for AI & life transformation, personal growth, and to join the "Focus Flow Elevation Hub" Skool community.
   - Direct users to the "Healing Hub" for trauma-informed victim support and safety resources.
3. **Resource Routing**: Help users find housing, employment, legal aid, and wellness support across Ohio.
4. **Coaching Consults**: Direct users to book a free call at: https://calendly.com/ffe_coach_kay/free-call

### Safety and Compliance
- Never provide legal, medical, or mental-health advice.
- Always point to licensed professionals or verified resources.
- For immediate crisis, prioritize 988 or 911.

Remember: You are the hub for second chances. Provide clear, actionable, and compassionate guidance.`;

    const openAIMessages = [
      { role: "system", content: systemPrompt },
      ...messages
    ];

    console.log(`Processing Coach K chat request with ${messages.length} messages`);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://forwardfocuselevation.org',
        'X-Title': 'Forward Focus Elevation',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.3-70b-instruct:free',
        messages: openAIMessages,
        stream: false,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenRouter API error:', response.status, error);

      if (response.status === 429) {
        return new Response(JSON.stringify({
          response: "Our AI service is temporarily busy. Please try again in a moment. Need immediate help? Call 988 for crisis support or 211 for resources.",
          rateLimitExceeded: true,
          remaining: 0
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({
          response: "Our AI service is temporarily unavailable. Please try again later. For immediate support, call 988 or 211.",
          remaining: 0
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    return new Response(JSON.stringify({
      response: content,
      remaining: rateLimit.remaining - 1
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in coach-k function:', error);
    return new Response(JSON.stringify({
      response: "Sorry, I can't reach the server right now. Please try again in a moment. Need more help? Book a free consult at https://calendly.com/ffe_coach_kay/free-call",
      error: true
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});