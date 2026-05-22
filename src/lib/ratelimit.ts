import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let ratelimitSubmit: Ratelimit | null = null;
let ratelimitTrack: Ratelimit | null = null;

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (redisUrl && redisToken) {
  try {
    const redis = new Redis({
      url: redisUrl,
      token: redisToken,
    });

    // 5 requests per 10 minutes per IP
    ratelimitSubmit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '10 m'),
      analytics: true,
      prefix: '@upstash/ratelimit/submit',
    });

    // 20 requests per 1 minute per IP
    ratelimitTrack = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, '1 m'),
      analytics: true,
      prefix: '@upstash/ratelimit/track',
    });
  } catch (error) {
    console.error('Failed to initialize Upstash Redis/Ratelimit clients:', error);
  }
} else {
  console.warn(
    'Upstash Redis credentials (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN) are missing. Rate limiting is bypassed.'
  );
}

export interface RateLimitResult {
  success: boolean;
  limit?: number;
  remaining?: number;
  reset?: number;
}

export async function checkRateLimit(
  type: 'submit' | 'track',
  ip: string
): Promise<RateLimitResult> {
  const limiter = type === 'submit' ? ratelimitSubmit : ratelimitTrack;
  if (!limiter) {
    return { success: true };
  }

  try {
    const result = await limiter.limit(ip);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (error) {
    console.error(`[RateLimit Error] Failed checking rate limit for ${type}:`, error);
    // Graceful fallback: allow requests if Redis is unreachable or down
    return { success: true };
  }
}
