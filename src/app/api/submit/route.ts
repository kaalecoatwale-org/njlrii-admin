import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';
import { checkRateLimit } from '@/lib/ratelimit';

// Helper to generate a unique random tracking ID matching the pattern NJLRII-V[Vol]I[Iss]-[A-Z0-9]{5}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateUniqueTrackingId(supabaseAdmin: any): Promise<string> {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let isUnique = false;
  let trackingId = '';
  let attempts = 0;

  // Default fallback volume and issue (Vol VI, Issue III)
  let volNumber = 6;
  let issNumber = 3;

  try {
    const { data: latestIssue } = await supabaseAdmin
      .from('issues')
      .select('number, volumes(number)')
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestIssue) {
      issNumber = latestIssue.number;
      if (latestIssue.volumes && typeof (latestIssue.volumes as any).number === 'number') {
        volNumber = (latestIssue.volumes as any).number;
      }
    }
  } catch (e) {
    console.error('Error fetching latest issue for tracking ID:', e);
  }

  while (!isUnique && attempts < 10) {
    attempts++;
    let suffix = '';
    for (let i = 0; i < 5; i++) {
      suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    trackingId = `NJLRII-V${volNumber}I${issNumber}-${suffix}`;

    // Query database to check if this tracking ID is already in use
    const { data, error } = await supabaseAdmin
      .from('manuscripts')
      .select('id')
      .eq('tracking_id', trackingId)
      .maybeSingle();

    if (!error && !data) {
      isUnique = true;
    }
  }

  return trackingId;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Rate Limiting Check
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || '127.0.0.1';
    const rateLimit = await checkRateLimit('submit', ip);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many submission requests. Please try again later.' },
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

    const {
      author_name,
      author_email,
      author_phone,
      author_affiliation,
      co_authors,
      title,
      abstract,
      keywords,
      manuscript_pdf_url,
    } = body;

    // Validate required fields with server-side length limits
    if (!author_name || !author_name.trim()) {
      return NextResponse.json({ error: 'First Author Name is required.' }, { status: 400 });
    }
    if (author_name.trim().length > 200) {
      return NextResponse.json({ error: 'Author name is too long (max 200 characters).' }, { status: 400 });
    }
    if (!author_email || !author_email.trim() || !author_email.includes('@')) {
      return NextResponse.json({ error: 'A valid First Author Email is required.' }, { status: 400 });
    }
    if (!author_phone || !author_phone.trim()) {
      return NextResponse.json({ error: 'First Author Phone is required.' }, { status: 400 });
    }
    if (!author_affiliation || !author_affiliation.trim()) {
      return NextResponse.json({ error: 'First Author Affiliation is required.' }, { status: 400 });
    }
    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Manuscript Title is required.' }, { status: 400 });
    }
    if (title.trim().length > 500) {
      return NextResponse.json({ error: 'Manuscript title is too long (max 500 characters).' }, { status: 400 });
    }
    if (!abstract || !abstract.trim()) {
      return NextResponse.json({ error: 'Manuscript Abstract is required.' }, { status: 400 });
    }
    if (abstract.trim().length > 8000) {
      return NextResponse.json({ error: 'Abstract is too long (max 8000 characters).' }, { status: 400 });
    }
    if (!manuscript_pdf_url || !manuscript_pdf_url.trim()) {
      return NextResponse.json({ error: 'Manuscript Document Link or Upload is required.' }, { status: 400 });
    }

    // Validate that manuscript_pdf_url is a valid URL (prevents SSRF / junk data)
    try {
      const parsedUrl = new URL(manuscript_pdf_url.trim());
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return NextResponse.json({ error: 'Manuscript URL must use http or https.' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: 'Manuscript URL is not a valid URL.' }, { status: 400 });
    }

    // Process keywords
    let parsedKeywords: string[] = [];
    if (Array.isArray(keywords)) {
      parsedKeywords = keywords.map((k) => k.trim()).filter((k) => k.length > 0);
    } else if (typeof keywords === 'string') {
      parsedKeywords = keywords
        .split(',')
        .map((k) => k.trim())
        .filter((k) => k.length > 0);
    }

    if (parsedKeywords.length === 0) {
      return NextResponse.json({ error: 'At least one keyword is required.' }, { status: 400 });
    }

    // Process co-authors
    let parsedCoAuthors: any[] = [];
    if (Array.isArray(co_authors)) {
      parsedCoAuthors = co_authors.filter((co) => co && co.name && co.name.trim());
    }

    // Generate a unique tracking ID
    const trackingId = await generateUniqueTrackingId(supabaseAdmin);

    // Insert manuscript into the database
    const { data: insertedData, error: insertError } = await supabaseAdmin
      .from('manuscripts')
      .insert({
        primary_author_id: null, // Public frictionless submission, no logged in user account
        author_name: author_name.trim(),
        author_email: author_email.trim(),
        author_phone: author_phone.trim(),
        author_affiliation: author_affiliation.trim(),
        tracking_id: trackingId,
        co_authors: parsedCoAuthors,
        title: title.trim(),
        abstract: abstract.trim(),
        keywords: parsedKeywords,
        manuscript_pdf_url: manuscript_pdf_url.trim(),
        status: 'submitted',
        step1_status: 'pending',
        step1_feedback: '',
        step2_status: 'pending',
        step2_feedback: '',
        step3_status: 'pending',
        step3_feedback: '',
        step4_status: 'pending',
        step4_feedback: '',
        step5_status: 'pending',
        step5_feedback: '',
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      return NextResponse.json({ error: 'Failed to insert manuscript into database.' }, { status: 500 });
    }

    // ==========================================
    // EMAIL TRIGGER: SUBMISSION CONFIRMATION (Email 1)
    // ==========================================
    try {
      const liveSiteUrl = process.env.NEXT_PUBLIC_LIVE_SITE_URL || 'https://www.njlrii.com';
      const trackingUrl = `${liveSiteUrl}/track?id=${trackingId}`;
      const emailHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Submission Confirmed - NJLRII</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Inter', system-ui, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <tr><td height="6" style="background-color: #FC0434;"></td></tr>
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: left;">
              <span style="font-size: 24px; font-weight: 800; color: #0F172A; letter-spacing: -0.02em;">NJLRII<span style="color: #FC0434;">.</span></span><br/>
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; color: #FC0434; display: block; margin-top: 2px;">ISSN: 2582-8665</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px 40px 40px;">
              <h2 style="font-size: 20px; font-weight: 800; color: #0F172A; margin: 0 0 16px 0; line-height: 1.3;">Manuscript Submission Confirmed</h2>
              <p style="font-size: 14.5px; color: #475569; line-height: 1.6; margin: 0 0 24px 0;">
                Dear <strong>${insertedData.author_name}</strong>,<br/><br/>
                We are pleased to confirm that your manuscript has been successfully submitted to the <em>National Journal of Legal Research and Innovative Ideas (NJLRII)</em> for the upcoming issue (Volume VI, Issue III).
              </p>

              <table width="100%" border="0" cellspacing="0" cellpadding="12" style="background-color: #f1f5f9; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td width="30%" style="font-size: 12.5px; font-weight: bold; color: #64748b; text-transform: uppercase;">Tracking ID</td>
                  <td style="font-size: 14px; font-family: 'Courier New', Courier, monospace; font-weight: bold; color: #FC0434;">${trackingId}</td>
                </tr>
                <tr>
                  <td style="font-size: 12.5px; font-weight: bold; color: #64748b; text-transform: uppercase;">Title</td>
                  <td style="font-size: 14.5px; font-weight: bold; color: #0F172A;">${insertedData.title}</td>
                </tr>
              </table>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${trackingUrl}" style="background-color: #0F172A; color: #ffffff; padding: 14px 28px; border-radius: 30px; font-size: 13px; font-weight: bold; text-decoration: none; text-transform: uppercase; letter-spacing: 0.05em; display: inline-block;">Track Your Manuscript</a>
              </div>

              <p style="font-size: 13.5px; color: #64748b; line-height: 1.6; margin: 0;">
                Keep your tracking ID secure. Use it to check live status updates at our online tracking portal.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <span style="font-size: 11px; color: #94a3b8; display: block; line-height: 1.5;">
                National Journal of Legal Research and Innovative Ideas (NJLRII)<br/>
                For amendments, reply directly to this thread or email <a href="mailto:journalnjlrii@gmail.com" style="color: #FC0434; text-decoration: none;">journalnjlrii@gmail.com</a>.
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

      await sendEmail({
        to: insertedData.author_email,
        subject: `NJLRII Submission Receipt: ${trackingId}`,
        html: emailHtml
      });
    } catch (emailErr) {
      console.error('[EMAIL ERROR] Failed to send submission email:', emailErr);
    }
    // ==========================================

    return NextResponse.json({
      success: true,
      message: 'Your manuscript was submitted successfully.',
      tracking_id: trackingId,
      manuscript: insertedData,
    });
  } catch (error: any) {
    console.error('Submission API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
