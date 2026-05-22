import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error: Supabase URL or Service Role Key is missing.' },
        { status: 500 }
      );
    }

    // 1. Initialize Supabase Admin Client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // 2. Authenticate the caller using Bearer Token
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: Access token is missing.' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: Invalid access token.' }, { status: 401 });
    }

    // 3. Authorize: Ensure caller is an administrator or editor
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || !['super_admin', 'editor', 'student_editor'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden: Editorial Admin privileges required.' }, { status: 403 });
    }

    // 4. Parse request body
    const {
      author_name,
      title,
      tracking_id,
      vol_number,
      iss_number,
      year,
      article_url,
      certificate_url
    } = await req.json();

    if (!author_name || !title || !tracking_id || !vol_number || !iss_number || !year || !article_url || !certificate_url) {
      return NextResponse.json({ error: 'Missing required parameters.' }, { status: 400 });
    }

    // 5. Look up the verified author email from the DB using tracking_id
    // SECURITY: Never trust caller-supplied recipient_email — use DB value instead
    const { data: manuscript, error: manuscriptError } = await supabaseAdmin
      .from('manuscripts')
      .select('author_email')
      .eq('tracking_id', tracking_id)
      .single();

    if (manuscriptError || !manuscript) {
      return NextResponse.json({ error: 'Manuscript not found for this tracking ID.' }, { status: 404 });
    }

    const recipient_email = manuscript.author_email;

    const subject = `🎉 Congratulations! Your Manuscript has been Published in NJLRII`;
    
    const emailHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Congratulations! Manuscript Published - NJLRII</title>
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
              <h2 style="font-size: 22px; font-weight: 800; color: #0F172A; margin: 0 0 16px 0; line-height: 1.3; text-align: center;">🎉 Congratulations!</h2>
              <p style="font-size: 14.5px; color: #475569; line-height: 1.6; margin: 0 0 24px 0;">
                Dear <strong>${author_name}</strong>,<br/><br/>
                We are thrilled to inform you that your manuscript <strong>"${title}"</strong> (Tracking ID: ${tracking_id}) has been officially accepted and published in the <em>National Journal of Legal Research and Innovative Ideas (NJLRII)</em>.
              </p>

              <table width="100%" border="0" cellspacing="0" cellpadding="12" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td width="35%" style="font-size: 12px; font-weight: bold; color: #64748b; text-transform: uppercase;">Publication Release</td>
                  <td style="font-size: 14px; font-weight: bold; color: #0F172A;">Volume ${vol_number}, Issue ${iss_number} (${year})</td>
                </tr>
                <tr>
                  <td style="font-size: 12px; font-weight: bold; color: #64748b; text-transform: uppercase;">Document Status</td>
                  <td style="font-size: 13px; font-weight: bold; color: #10B981; text-transform: uppercase;">✓ Accepted & Live</td>
                </tr>
              </table>

              <div style="background-color: #f1f5f9; border-radius: 8px; padding: 18px; margin-bottom: 28px; text-align: center;">
                <p style="margin: 0 0 12px 0; font-size: 13.5px; color: #475569;">
                  Your digital certificate of publication is ready for download.
                </p>
                <a href="${certificate_url}" style="color: #FC0434; font-weight: bold; text-decoration: none; font-size: 13px; text-transform: uppercase;">Download Certificate →</a>
              </div>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${article_url}" style="background-color: #FC0434; color: #ffffff; padding: 14px 28px; border-radius: 30px; font-size: 13px; font-weight: bold; text-decoration: none; text-transform: uppercase; display: inline-block;">Read Published Article</a>
              </div>

              <p style="font-size: 13.5px; color: #64748b; line-height: 1.6; margin: 0;">
                Thank you for choosing to publish your research in NJLRII. We wish you the absolute best in your academic career and hope to receive more of your papers in the future.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <span style="font-size: 11px; color: #94a3b8; display: block; line-height: 1.5;">
                National Journal of Legal Research and Innovative Ideas (NJLRII)<br/>
                Visit our official site: <a href="https://njlrii.com" style="color: #FC0434; text-decoration: none;">njlrii.com</a>.
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // Dispatch the email
    const emailResult = await sendEmail({
      to: recipient_email,
      subject: subject,
      html: emailHtml
    });

    if (!emailResult.success) {
      return NextResponse.json({ error: emailResult.error || 'Failed to dispatch email.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Publication acceptance email sent successfully.' });
  } catch (error: any) {
    console.error('Send Publish Email API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
