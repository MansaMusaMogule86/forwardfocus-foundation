import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkAiRateLimit } from '../_shared/rate-limit.ts';
import { fetchWithFallback } from '../_shared/openrouter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ReentryQuery {
  query: string;
  location?: string;
  county?: string;
  reentryStage?: 'preparing' | 'recently_released' | 'long_term' | 'family_member';
  priorityNeeds?: Array<'housing' | 'employment' | 'legal' | 'education' | 'healthcare' | 'family' | 'financial'>;
  selectedCoach?: {
    name: string;
    specialty: string;
    description: string;
  };
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

    const rateLimit = await checkAiRateLimit(supabase, req, 'reentry-navigator-ai');
    if (rateLimit.limited) {
      return new Response(JSON.stringify({
        error: "You've reached your daily limit for free AI consultations. To get unlimited access, please sign in.",
        supportMessage: 'For immediate reentry support, please call 211 for resource navigation.',
        rateLimitExceeded: true
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { query, location, county, reentryStage = 'recently_released', priorityNeeds = [], selectedCoach, previousContext = [] }: ReentryQuery = await req.json();

    let resourceQuery = supabase
      .from('resources')
      .select('*')
      .or('type.ilike.%housing%,type.ilike.%employment%,type.ilike.%job training%,type.ilike.%education%,type.ilike.%reentry%,type.ilike.%legal aid%,type.ilike.%mental health%,type.ilike.%substance abuse%,type.ilike.%healthcare%,type.ilike.%transportation%')
      .eq('verified', true)
      .limit(20);

    if (location || county) {
      const searchLocation = location || county;
      resourceQuery = resourceQuery.or(`city.ilike.%${searchLocation}%,county.ilike.%${searchLocation}%`);
    }

    const { data: resources, error: dbError } = await resourceQuery;
    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to fetch resources');
    }

    const systemPrompt = getCoachSystemPrompt(selectedCoach, resources?.slice(0, 12) || []);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...previousContext,
      { role: 'user', content: query }
    ];

    const { content: aiMessage } = await fetchWithFallback({
      apiKey: OPENROUTER_API_KEY,
      models: ['nvidia/llama-3.1-nemotron-70b-instruct:free', 'meta-llama/llama-3.3-70b-instruct:free'],
      messages,
      maxTokens: 1500,
    });

    const relevantResources = resources?.filter(resource => {
      const queryLower = query.toLowerCase();
      const resourceType = resource.type?.toLowerCase() || '';
      if (queryLower.includes('housing') || queryLower.includes('shelter')) return resourceType.includes('housing') || resourceType.includes('transitional');
      if (queryLower.includes('job') || queryLower.includes('employment')) return resourceType.includes('employment') || resourceType.includes('job training') || resource.justice_friendly;
      if (queryLower.includes('legal') || queryLower.includes('expungement')) return resourceType.includes('legal aid') || resourceType.includes('advocacy');
      if (queryLower.includes('education') || queryLower.includes('school')) return resourceType.includes('education') || resourceType.includes('training');
      if (queryLower.includes('healthcare') || queryLower.includes('mental health')) return resourceType.includes('healthcare') || resourceType.includes('mental health');
      if (queryLower.includes('family') || queryLower.includes('children')) return resourceType.includes('family') || resourceType.includes('support');
      return resourceType.includes('reentry') || resource.justice_friendly;
    })?.slice(0, 10) || [];

    return new Response(JSON.stringify({
      response: aiMessage,
      resources: relevantResources,
      reentryStage,
      priorityNeeds,
      totalResources: resources?.length || 0,
      rateLimitRemaining: rateLimit.remaining - 1,
      keyServices: {
        housing: "Transitional and permanent housing options",
        employment: "Job training and fair-chance employers",
        legal: "Expungement and legal document assistance",
        education: "GED, college, and vocational training",
        support: "211 Ohio comprehensive resource navigation"
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Reentry Navigator AI error:', error);
    return new Response(JSON.stringify({
      error: 'I apologize for the technical issue. For immediate reentry support, please call 211 for comprehensive resource navigation or visit your local reentry program.',
      keyServices: {
        general: "Call 211 for resource navigation",
        housing: "Contact local housing authorities",
        employment: "Visit Ohio Means Jobs centers"
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function getCoachSystemPrompt(coach?: { name: string; specialty: string; description: string; }, resources: any[] = []): string {
  const basePrompt = `You are Coach Kay, the lead navigator for "The Collective" (AI & Life Transformation Hub) at Forward Focus Elevation. You serve all 88 counties across Ohio, specializing in AI & Life Transformation for individuals seeking a second chance.

### Tone and Style
- Use clear markdown headers (##) for structure.
- Use bullet points for resource lists or action steps.
- Maintain an objective, professional, and sympathetic tone.
- Avoid conversational filler. Provide pure, structured, and informative output.

### Core Principles
1. **Guided Interaction**: Always ask exactly ONE guided question at the end of your response.
2. **Transformation Expertise**: Provide guidance on housing, employment, legal aid, mindfulness-based success, financial foundations, and AI-driven growth.
3. **Ohio-Wide Support**: Ensure coverage across all 88 Ohio counties, prioritizing Columbus/Franklin County when applicable.
4. **Resource Richness**: Connect users with verified, justice-friendly resources. Include contact info for all recommendations.

### Available Ohio Resources
${JSON.stringify(resources)}

### Important Guidelines
- For mental health crises, direct to 988 Suicide & Crisis Lifeline.
- Focus on empowerment, dignity, and self-advocacy.

Remember: You are the guide for second chances and AI-driven life transformation. Provide verified, structured resource information.`;

  if (!coach) return basePrompt;

  const coachPrompts: Record<string, string> = {
    'Coach Dana': `\n\n**As Coach Dana - Housing Transition Specialist:**\nI'm your dedicated housing advocate. I understand the unique challenges of finding stable housing with a criminal record.\n\n**My Specialty Focus:**\n- Transitional and permanent housing options\n- Rental application strategies for those with records\n- Understanding tenant rights and protections\n- Housing voucher programs and applications\n- Budget-friendly housing search techniques`,
    'Coach Malik': `\n\n**As Coach Malik - Employment Support Navigator:**\nI'm here to help you land meaningful work that supports your goals.\n\n**My Specialty Focus:**\n- Resume writing that highlights strengths\n- Interview preparation and confidence building\n- Fair-chance employer networks and opportunities\n- Job training program recommendations\n- Workplace rights and advocacy`,
    'Coach Rivera': `\n\n**As Coach Rivera - Legal Guidance Counselor:**\nI specialize in helping you navigate the complex legal landscape after incarceration.\n\n**My Specialty Focus:**\n- Court obligation management and compliance\n- Expungement eligibility and process guidance\n- Legal documentation and paperwork assistance\n- Understanding probation/parole requirements\n- Rights restoration processes`,
    'Coach Taylor': `\n\n**As Coach Taylor - Family Support Specialist:**\nRebuilding family relationships takes courage and patience.\n\n**My Specialty Focus:**\n- Communication strategies for difficult conversations\n- Boundary setting and respect building\n- Co-parenting and custody considerations\n- Family therapy and mediation resources\n- Rebuilding trust after absence`,
    'Coach Jordan': `\n\n**As Coach Jordan - Financial Stability Coach:**\nFinancial stability is foundational to successful reentry.\n\n**My Specialty Focus:**\n- Banking basics and account opening with records\n- Budgeting and money management skills\n- Credit repair and building strategies\n- Benefits applications (SNAP, healthcare, housing)\n- Avoiding predatory lending and scams`,
    'Coach Kay': `\n\n**As Coach Kay - Your Primary Reentry Navigator:**\nI'm your main guide throughout your entire reentry journey.\n\n**My Comprehensive Focus:**\n- Overall reentry strategy and planning\n- Connecting you to specialized coaches when needed\n- Crisis support and immediate resource navigation\n- Holistic wellbeing and success planning\n- Building confidence and resilience`,
    'Coach Sam': `\n\n**As Coach Sam - Mental Wellness Advocate:**\nYour mental health is just as important as your physical wellbeing.\n\n**My Specialty Focus:**\n- Trauma-informed mental health resources\n- Coping strategies for stress and anxiety\n- Substance abuse recovery support\n- Building healthy routines and self-care\n- Community support and peer connections`
  };

  return basePrompt + (coachPrompts[coach.name] || '');
}