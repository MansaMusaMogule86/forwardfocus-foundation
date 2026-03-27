import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkAiRateLimit } from '../_shared/rate-limit.ts';
import { fetchWithFallback } from '../_shared/openrouter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface EmergencyQuery {
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

  try {
    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
    if (!OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY is not configured');
    }

    const { query, location, county, urgencyLevel = 'moderate', previousContext = [] }: EmergencyQuery = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const rateLimit = await checkAiRateLimit(supabase, req, 'crisis-emergency-ai');
    if (rateLimit.limited) {
      return new Response(JSON.stringify({
        error: "You've reached your daily limit for free AI consultations. For immediate support, please call 988 or 211.",
        resources: [],
        rateLimitExceeded: true
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let resourceQuery = supabase
      .from('resources')
      .select('*')
      .or('type.ilike.%crisis%,type.ilike.%emergency%,type.ilike.%mental health%,type.ilike.%support%,type.ilike.%advocacy%')
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

    const systemPrompt = `You are Coach Kay, the lead Crisis Emergency navigator for Forward Focus Elevation. You serve all 88 counties across Ohio, providing immediate support and connecting users with the Healing Hub or emergency services.

### Tone and Style
- Use clear markdown headers (##) for structure.
- Use bullet points for resource lists or action steps.
- Maintain an objective, professional, and sympathetic tone.
- Avoid conversational filler. Provide pure, structured, and informative output.

### Core Principles
1. **Guided Interaction**: Always ask exactly ONE guided question at the end of your response.
2. **Immediate Assessment**: Quickly assess the person's current situation and safety. Focus on immediate stabilization.
3. **Ohio-Wide Support**: Prioritize local Ohio resources and emergency services across all 88 counties.
4. **Sympathy & Alertness**: Be alert to danger signs and respond with professional sympathy and actionable help.

### Available Ohio Resources
${JSON.stringify(resources?.slice(0, 10) || [])}

### Important Guidelines:
- For immediate danger, prioritize 911.
- For suicide/crisis support, emphasize 988.
- For domestic violence, emphasize 1-800-799-7233.

Remember: Safety first. Your role is to stabilize and connect users with verified Ohio help and second chances.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...previousContext,
      { role: 'user', content: query }
    ];

    const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://forwardfocuselevation.org',
        'X-Title': 'Forward Focus Elevation',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemma-3-27b-it:free',
        messages,
        stream: false,
        max_tokens: 1000,
      }),
    });

    if (!aiResponse.ok) {
      console.error('OpenRouter API error:', aiResponse.status, await aiResponse.text());
      throw new Error('Failed to generate AI response');
    }

    const aiData = await aiResponse.json();
    const aiMessage = aiData.choices[0].message.content;

    const relevantResources = resources?.filter(resource => {
      const queryLower = query.toLowerCase();
      const resourceType = resource.type?.toLowerCase() || '';
      if (queryLower.includes('crisis') || queryLower.includes('emergency') || queryLower.includes('help')) {
        return resourceType.includes('crisis') || resourceType.includes('emergency') || resourceType.includes('support');
      }
      if (queryLower.includes('mental health') || queryLower.includes('depression') || queryLower.includes('anxiety')) {
        return resourceType.includes('mental health') || resourceType.includes('counseling');
      }
      return resourceType.includes('crisis') || resourceType.includes('support');
    })?.slice(0, 8) || [];

    return new Response(JSON.stringify({
      response: aiMessage,
      resources: relevantResources,
      urgencyLevel,
      totalResources: resources?.length || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Crisis Emergency AI error:', error);
    return new Response(JSON.stringify({
      error: 'I apologize for the technical difficulty. Let me connect you with local Ohio crisis support resources in your area.',
      resources: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});