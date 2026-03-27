import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkAiRateLimit } from '../_shared/rate-limit.ts';
import { fetchWithFallback } from '../_shared/openrouter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface VictimSupportQuery {
  query: string;
  location?: string;
  county?: string;
  victimType?: 'domestic_violence' | 'sexual_assault' | 'violent_crime' | 'property_crime' | 'other';
  traumaLevel?: 'recent' | 'ongoing' | 'past' | 'complex';
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

    const rateLimit = await checkAiRateLimit(supabase, req, 'victim-support-ai');
    if (rateLimit.limited) {
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded. Please wait a few minutes before trying again.',
        supportMessage: 'For immediate victim support, please call the National Domestic Violence Hotline at 1-800-799-7233.',
        retryAfter: 300
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '300' },
      });
    }

    const { query, location, county, victimType, traumaLevel = 'ongoing', previousContext = [] }: VictimSupportQuery = await req.json();

    let resourceQuery = supabase
      .from('resources')
      .select('*')
      .or('type.ilike.%victim%,type.ilike.%legal aid%,type.ilike.%compensation%,type.ilike.%counseling%,type.ilike.%trauma%,type.ilike.%advocacy%,type.ilike.%domestic violence%,type.ilike.%sexual assault%')
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

    const systemPrompt = `You are Coach Kay, the trauma-informed navigator for the Healing Hub at Forward Focus Elevation. You serve all 88 counties across Ohio, specializing in support for crime victims and survivors.

### Tone and Style
- Use clear markdown headers (##) for structure.
- Use bullet points for resource lists or action steps.
- Maintain an objective, professional, and sympathetic tone.
- Avoid conversational filler. Provide pure, structured, and informative output.

### Core Principles
1. **Guided Interaction**: Always ask exactly ONE guided question at the end of your response to lead the user through their discovery or healing process.
2. **Trauma-Informed Care**: Acknowledge strength, validate experiences without judgment, and emphasize that what happened was not their fault.
3. **Ohio-Wide Expertise**: Provide guidance on legal rights, victim compensation, trauma counseling, and safety planning across all 88 Ohio counties.
4. **Resource Richness**: Prioritize immediate safety and verified resources. Include contact information (phone/website) for all recommendations.

### Available Ohio Resources
${JSON.stringify(resources?.slice(0, 10) || [])}

### Communication Guidelines
- Use "survivor" language when appropriate.
- Respect autonomy and provide hope while remaining realistic.
- For immediate crisis, prioritize 988 or 911.

Remember: You are the guide for healing and second chances. Provide verified, structured resource information.`;

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
        model: 'nousresearch/hermes-3-405b-instruct:free',
        messages,
        stream: false,
        max_tokens: 1200,
      }),
    });

    if (!aiResponse.ok) {
      console.error('OpenRouter API error:', aiResponse.status, await aiResponse.text());
      throw new Error('Failed to generate AI response');
    }

    const aiData = await aiResponse.json();
    const aiMessage = aiData.choices[0].message.content;

    // Filter resources
    const relevantResources = resources?.filter(resource => {
      const queryLower = query.toLowerCase();
      const resourceType = resource.type?.toLowerCase() || '';
      if (queryLower.includes('legal') || queryLower.includes('rights')) return resourceType.includes('legal aid') || resourceType.includes('advocacy');
      if (queryLower.includes('compensation') || queryLower.includes('financial')) return resourceType.includes('compensation') || resourceType.includes('financial');
      if (queryLower.includes('counseling') || queryLower.includes('therapy')) return resourceType.includes('counseling') || resourceType.includes('trauma') || resourceType.includes('mental health');
      if (queryLower.includes('domestic violence') || queryLower.includes('abuse')) return resourceType.includes('domestic violence');
      if (queryLower.includes('sexual assault')) return resourceType.includes('sexual assault');
      return resourceType.includes('victim') || resourceType.includes('advocacy');
    })?.slice(0, 8) || [];

    return new Response(JSON.stringify({
      response: aiMessage,
      resources: relevantResources,
      victimType,
      traumaLevel,
      totalResources: resources?.length || 0,
      rateLimitRemaining: rateLimit.remaining - 1,
      supportServices: {
        domesticViolence: "1-800-799-7233",
        sexualAssault: "1-800-656-4673",
        crisisSupport: "988",
        ohioVictimCompensation: "https://www.ohioattorneygeneral.gov/Individuals-and-Families/Victims"
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Victim Support AI error:', error);
    return new Response(JSON.stringify({
      error: 'I apologize for the technical difficulty. Let me connect you with local Ohio victim services and family justice centers in your area that can provide immediate support.',
      resources: [],
      supportServices: {
        domesticViolence: "1-800-799-7233",
        sexualAssault: "1-800-656-4673",
        crisisSupport: "988"
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});