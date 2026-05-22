import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Initialize Supabase admin client to query track data safely
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export async function POST(req: NextRequest) {
  try {
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
