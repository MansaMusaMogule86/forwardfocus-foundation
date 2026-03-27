import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const GUEST_MAX_REQUESTS = 10;
export const AUTHED_MAX_REQUESTS = 50;
export const SOFT_LIMIT_GUEST = 7;
export const RATE_LIMIT_WINDOW_MINUTES = 1440; // 24 hours

export async function checkAiRateLimit(supabase: any, req: Request, endpoint: string) {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';

  let identifier = `ip:${ip}`;
  let maxRequests = GUEST_MAX_REQUESTS;

  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      if (user) {
        identifier = `user:${user.id}`;
        maxRequests = AUTHED_MAX_REQUESTS;
      }
    } catch (e) {
      console.error('Error fetching user for rate limit:', e);
    }
  }

  const { data, error } = await supabase.rpc('check_ai_rate_limit', {
    p_identifier: identifier,
    p_endpoint: endpoint,
    p_max_requests: maxRequests,
    p_window_minutes: RATE_LIMIT_WINDOW_MINUTES
  });

  if (error) {
    console.error('Rate limit check error:', error);
    return { limited: false, identifier, maxRequests, remaining: maxRequests };
  }

  const result = data?.[0] || { is_rate_limited: false, current_count: 0 };

  if (!result.is_rate_limited) {
    // Record the request
    await supabase.from('ai_rate_limits').insert({
      identifier,
      endpoint
    });
  }

  return {
    limited: result.is_rate_limited,
    identifier,
    maxRequests,
    remaining: Math.max(0, maxRequests - result.current_count - 1)
  };
}
