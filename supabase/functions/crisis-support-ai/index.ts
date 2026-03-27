import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkAiRateLimit } from '../_shared/rate-limit.ts';
import { fetchWithFallback } from '../_shared/openrouter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface CrisisQuery {
  query: string;
  location?: string;
  county?: string;
  urgencyLevel?: 'immediate' | 'urgent' | 'moderate' | 'informational';
  previousContext?: Array<{role: string, content: string}>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
    if (!OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY is not configured');
    }

    // Rate limiting
    const rateLimit = await checkAiRateLimit(supabase, req, 'crisis-support-ai');
    if (rateLimit.limited) {
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded. Please wait a few minutes before trying again.',
        supportMessage: 'For immediate crisis support, please call 988 (Suicide & Crisis Lifeline) or 911.',
        retryAfter: 300
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '300' },
      });
    }

    const { query, location, county, urgencyLevel = 'moderate', previousContext = [] }: CrisisQuery = await req.json();

    // Fetch crisis resources from DB
    let resourceQuery = supabase
      .from('resources')
      .select('*')
      .or('type.ilike.%crisis%,type.ilike.%emergency%,type.ilike.%mental health%,type.ilike.%suicide%,type.ilike.%domestic violence%,type.ilike.%substance abuse%')
      .eq('verified', true)
      .limit(15);

    if (location || county) {
      const searchLocation = location || county;
      resourceQuery = resourceQuery.or(`city.ilike.%${searchLocation}%,county.ilike.%${searchLocation}%`);
    }

    const { data: resources, error: dbError } = await resourceQuery;
    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to fetch resources');
    }

    const systemPrompt = `You are Coach Kay, the Crisis Support companion for the Healing Hub at Forward Focus Elevation, serving all 88 counties across Ohio. You specialize in immediate crisis intervention, safety planning, and connecting people with the "Healing Hub" for long-term support.

### Tone and Style
- Use clear markdown headers (##) for structure.
- Use bullet points for resource lists or action steps.
- Maintain an objective, professional, and sympathetic tone.
- Eliminate conversational filler. Provide pure, structured guidance.

### Crisis Intervention Principles
1. **Guided Interaction**: Always ask exactly ONE guided question at the end of your response to lead the user through their discovery process or safety assessment.
2. **Immediate Safety**: Focus on immediate safety and practical next steps.
3. **Ohio-Wide Support**: Prioritize local community resources, family justice centers, and Ohio-specific support systems across all 88 counties.
4. **Sympathy & Alertness**: Be alert to danger signs and respond with professional sympathy and actionable help.

### Available Ohio Resources
${JSON.stringify(resources?.slice(0, 10) || [])}

### Important Guidelines
- For immediate danger, prioritize 911.
- For suicide/crisis support, emphasize 988.
- For domestic violence, emphasize 1-800-799-7233.

Remember: You are the companion for second chances and healing. Provide verified, structured resource information.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...previousContext,
      { role: 'user', content: query }
    ];

    const { content: aiMessage } = await fetchWithFallback({
      apiKey: OPENROUTER_API_KEY,
      models: ['google/gemma-3-27b-it:free', 'meta-llama/llama-3.3-70b-instruct:free'],
      messages,
      maxTokens: 1000,
    });

    return new Response(JSON.stringify({
      response: aiMessage,
      resources: relevantResources,
      urgencyLevel,
      totalResources: resources?.length || 0,
      rateLimitRemaining: rateLimit.remaining - 1
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Crisis Support AI error:', error);

    const fallbackMessage = `I am here to support you. While I am experiencing technical difficulties, your safety is the highest priority.

## Immediate Crisis Support
- **Emergency:** Call 911
- **Suicide & Crisis Lifeline:** Call 988
- **Crisis Text Line:** Text HOME to 741741
- **Domestic Violence Hotline:** Call 1-800-799-7233`;

    let fallbackResources = [];
    try {
      const { data: dbResources } = await supabase
        .from('resources')
        .select('*')
        .or('type.ilike.%crisis%,type.ilike.%emergency%,type.ilike.%mental health%')
        .eq('verified', true)
        .limit(5);
      fallbackResources = dbResources || [];
    } catch (dbError) {
      console.error('Fallback database error:', dbError);
    }

    return new Response(JSON.stringify({
      response: fallbackMessage,
      resources: fallbackResources,
      urgencyLevel: 'urgent',
      totalResources: fallbackResources.length
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});