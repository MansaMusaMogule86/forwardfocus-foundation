import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkAiRateLimit } from '../_shared/rate-limit.ts';
import { fetchWithFallback } from '../_shared/openrouter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ResourceQuery {
  query: string;
  location?: string;
  county?: string;
  resourceType?: string;
  limit?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
    if (!OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY is not configured');
    }

    const rateLimit = await checkAiRateLimit(supabase, req, 'ai-resource-discovery');
    if (rateLimit.limited) {
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded. Please wait a few minutes.',
        response: "You've reached your limit. Please try again shortly or sign in for more access."
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { query, location, county, resourceType, limit = 10 }: ResourceQuery = await req.json();
    console.log('AI Resource Discovery Request:', { query, location, county, resourceType });

    let resourcesQuery = supabase.from('resources').select('*').limit(50);
    if (county) resourcesQuery = resourcesQuery.ilike('county', `%${county}%`);
    if (location) resourcesQuery = resourcesQuery.or(`city.ilike.%${location}%,county.ilike.%${location}%`);
    if (resourceType) resourcesQuery = resourcesQuery.ilike('type', `%${resourceType}%`);

    const { data: resources, error: resourceError } = await resourcesQuery;
    if (resourceError) {
      console.error('Database error:', resourceError);
      return new Response(JSON.stringify({ error: 'Failed to fetch resources' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resourceContext = resources?.map(r => ({
      name: r.name, organization: r.organization, type: r.type, city: r.city, county: r.county,
      description: r.description, phone: r.phone, website: r.website, verified: r.verified, justice_friendly: r.justice_friendly
    })) || [];

    const systemPrompt = `You are Coach Kay, the lead resource navigator for "The Collective" (AI & Life Transformation Hub) at Forward Focus Elevation. You specialize in Ohio community resources and AI & Life Transformation support services across all 88 counties.

### Tone and Style
- Use clear markdown headers (##) for structure.
- Use bullet points for resource lists or action steps.
- Maintain an objective, professional, and sympathetic tone.
- Avoid conversational filler. Provide pure, structured, and informative output.

### Core Principles
1. **Guided Interaction**: Always ask exactly ONE guided question at the end of your response.
2. **Resource Richness**: Provide detailed information about services, locations, and contact details.
3. **Ohio-Wide Support**: Ensure coverage across all 88 Ohio counties.
4. **Empowerment**: Mention if a resource is "justice-friendly" and prioritize verified partner resources.

### Available Resources Context
${JSON.stringify(resourceContext, null, 2)}

### Important Guidelines:
- If you don't have exact matches, suggest similar or related resources.
- Encourage users to call resources directly for current information.
- For immediate crisis, prioritize 988 or 911.

Remember: You are the hub for second chances. Provide verified, structured resource information.`;

    const { content: aiResponseText } = await fetchWithFallback({
      apiKey: OPENROUTER_API_KEY,
      models: ['qwen/qwen3-next-80b-a3b-instruct:free', 'meta-llama/llama-3.3-70b-instruct:free'],
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query }
      ],
      maxTokens: 800,
    });
    const relevantResources = resources?.slice(0, limit) || [];

    return new Response(JSON.stringify({
      response: aiResponseText,
      curatedResources: relevantResources,
      totalFound: resources?.length || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in AI resource discovery:', error);

    let fallbackResources = [];
    try {
      const { data: basicResources } = await supabase.from('resources').select('*').limit(10);
      fallbackResources = basicResources || [];
    } catch (dbError) {
      console.error('Fallback database error:', dbError);
    }

    const guidanceMessage = fallbackResources.length > 0
      ? `I found ${fallbackResources.length} Ohio resources in our database. While I'm experiencing technical difficulties, these resources should help you get started.`
      : `I'm having technical difficulties right now. Please try refreshing the page, or visit our resource directory directly.`;

    return new Response(JSON.stringify({
      response: guidanceMessage,
      resources: fallbackResources,
      totalFound: fallbackResources.length
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});