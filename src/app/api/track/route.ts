import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit } from '@/lib/ratelimit';

export async function POST(req: NextRequest) {
  try {
    // 1. Rate Limiting Check
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || '127.0.0.1';
    const rateLimit = await checkRateLimit('track', ip);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many tracking requests. Please try again later.' },
        {
          status: 429,
          headers: {
            ...(rateLimit.limit !== undefined ? { 'X-RateLimit-Limit': rateLimit.limit.toString() } : {}),
            ...(rateLimit.remaining !== undefined ? { 'X-RateLimit-Remaining': rateLimit.remaining.toString() } : {}),
            ...(rateLimit.reset !== undefined ? { 'X-RateLimit-Reset': rateLimit.reset.toString() } : {}),
          },
        }
      );
    }

    // Initialize admin client inside handler to ensure env vars are loaded
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json();
    const { trackingId } = body;

    if (!trackingId || !trackingId.trim()) {
      return NextResponse.json({ error: 'Tracking ID is required.' }, { status: 400 });
    }

    const cleanTrackingId = trackingId.trim().toUpperCase();

    // Query for the manuscript matching this tracking ID
    const { data: manuscript, error } = await supabaseAdmin
      .from('manuscripts')
      .select(`
        id,
        title,
        abstract,
        keywords,
        author_name,
        author_affiliation,
        co_authors,
        status,
        created_at,
        step1_status,
        step1_feedback,
        step2_status,
        step2_feedback,
        step3_status,
        step3_feedback,
        step4_status,
        step4_feedback,
        step5_status,
        step5_feedback
      `)
      .eq('tracking_id', cleanTrackingId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching manuscript status:', error);
      return NextResponse.json({ error: 'Database search error.' }, { status: 500 });
    }

    if (!manuscript) {
      return NextResponse.json({ error: 'No manuscript found with this tracking ID.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      manuscript,
    });
  } catch (error: any) {
    console.error('Tracking API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
