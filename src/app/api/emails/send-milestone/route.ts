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
      recipient_email,
      author_name,
      title,
      tracking_id,
      step_num,
      step_title,
      step_status, // 'passed' | 'revision' | 'failed'
      feedback
    } = await req.json();

    if (!recipient_email || !author_name || !title || !tracking_id || !step_title || !step_status) {
      return NextResponse.json({ error: 'Missing required parameters.' }, { status: 400 });
    }

    const liveSiteUrl = process.env.NEXT_PUBLIC_LIVE_SITE_URL || 'https://www.njlrii.com';
    const trackingUrl = `${liveSiteUrl}/track?id=${tracking_id}`;
    
    let subject = '';
    let emailHtml = '';

    if (step_status === 'passed') {
      // Email 2: Screening Step Passed
      subject = `NJLRII Vetting Update: ${step_title} Cleared`;
      
      const feedbackSection = feedback 
        ? `<p style="margin: 8px 0 0 0; font-size: 13px; font-style: italic; color: #374151;">"${feedback}"</p>`
        : '';

      emailHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Screening Milestone Cleared - NJLRII</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Inter', system-ui, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <tr><td height="6" style="background-color: #10B981;"></td></tr>
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: left;">
              <span style="font-size: 24px; font-weight: 800; color: #0F172A; letter-spacing: -0.02em;">NJLRII<span style="color: #10B981;">.</span></span><br/>
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; color: #10B981; display: block; margin-top: 2px;">ISSN: 2582-8665</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px 40px 40px;">
              <h2 style="font-size: 20px; font-weight: 800; color: #0F172A; margin: 0 0 16px 0; line-height: 1.3;">Editorial Milestone Passed</h2>
              <p style="font-size: 14.5px; color: #475569; line-height: 1.6; margin: 0 0 24px 0;">
                Dear <strong>${author_name}</strong>,<br/><br/>
                We are pleased to inform you that your manuscript <strong>"${title}"</strong> (Tracking ID: <span style="font-family: monospace; font-weight: bold; color: #10B981;">${tracking_id}</span>) has successfully passed the editorial screening checkpoint: <strong>${step_title}</strong>.
              </p>

              <div style="background-color: rgba(16, 185, 129, 0.05); border-left: 4px solid #10B981; border-radius: 8px; padding: 18px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 13.5px; color: #065f46; line-height: 1.5; font-weight: 500;">
                  ✓ Checkpoint status updated to: <strong>PASSED</strong>
                </p>
                ${feedbackSection}
              </div>

              <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 24px 0;">
                Your manuscript has been moved forward to the next stage of our academic review process. No action is required on your part at this time.
              </p>

              <div style="text-align: center; margin: 28px 0;">
                <a href="${trackingUrl}" style="background-color: #10B981; color: #ffffff; padding: 14px 28px; border-radius: 30px; font-size: 13px; font-weight: bold; text-decoration: none; text-transform: uppercase; display: inline-block;">View Live Timeline Status</a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <span style="font-size: 11px; color: #94a3b8; display: block; line-height: 1.5;">
                For immediate assistance, contact <a href="mailto:submission@njlrii.com" style="color: #10B981; text-decoration: none;">submission@njlrii.com</a>.
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
    } else if (step_status === 'revision') {
      // Email 3: Revision Requested
      subject = `⚠️ Revision Required: NJLRII Editorial Screening - ${tracking_id}`;
      
      const deadlineDate = new Date();
      deadlineDate.setDate(deadlineDate.getDate() + 14);
      const formattedDeadline = deadlineDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      emailHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Revision Action Required - NJLRII</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Inter', system-ui, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <tr><td height="6" style="background-color: #d97706;"></td></tr>
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: left;">
              <span style="font-size: 24px; font-weight: 800; color: #0F172A; letter-spacing: -0.02em;">NJLRII<span style="color: #d97706;">.</span></span><br/>
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; color: #d97706; display: block; margin-top: 2px;">ISSN: 2582-8665</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px 40px 40px;">
              <h2 style="font-size: 20px; font-weight: 800; color: #0F172A; margin: 0 0 16px 0; line-height: 1.3;">⚠️ Action Required: Revisions Requested</h2>
              <p style="font-size: 14.5px; color: #475569; line-height: 1.6; margin: 0 0 24px 0;">
                Dear <strong>${author_name}</strong>,<br/><br/>
                Our Editorial Board has evaluated your manuscript <strong>"${title}"</strong> (Tracking ID: <span style="font-family: monospace; font-weight: bold; color: #d97706;">${tracking_id}</span>) at checkpoint <strong>${step_title}</strong>.
                <br/><br/>
                Revisions are required in your manuscript document to clear this step.
              </p>

              <!-- Editorial Feedback Callout -->
              <div style="background-color: rgba(217, 119, 6, 0.05); border-left: 4px solid #d97706; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <span style="font-size: 11px; font-weight: bold; color: #d97706; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 6px;">Editorial Feedback comments:</span>
                <p style="margin: 0; font-size: 13.5px; font-style: italic; color: #0F172A; line-height: 1.5;">
                  "${feedback || 'No comments provided.'}"
                </p>
              </div>

              <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 16px; font-size: 13px; color: #64748b; line-height: 1.5; margin-bottom: 24px;">
                <strong>Next Steps to Submit Revisions:</strong><br/>
                1. Make corrections inside your original manuscript document.<br/>
                2. Reply directly to this email attaching your revised <strong>manuscript file</strong> within <strong>14 days (Deadline: ${formattedDeadline})</strong>.<br/>
                3. Do not modify the email subject line so we can automatically match the revision to your tracking ID.
              </div>

              <div style="text-align: center; margin: 28px 0;">
                <a href="${trackingUrl}" style="background-color: #d97706; color: #ffffff; padding: 14px 28px; border-radius: 30px; font-size: 13px; font-weight: bold; text-decoration: none; text-transform: uppercase; display: inline-block;">Check Live Timeline status</a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <span style="font-size: 11px; color: #94a3b8; display: block; line-height: 1.5;">
                For immediate assistance, contact <a href="mailto:submission@njlrii.com" style="color: #d97706; text-decoration: none;">submission@njlrii.com</a>.
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
    } else if (step_status === 'failed') {
      // Email 4: Failed Screening / Rejected
      subject = `NJLRII Screening Status: Disqualified - ${tracking_id}`;
      
      emailHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Review Decision Notification - NJLRII</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Inter', system-ui, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <tr><td height="6" style="background-color: #EF4444;"></td></tr>
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: left;">
              <span style="font-size: 24px; font-weight: 800; color: #0F172A; letter-spacing: -0.02em;">NJLRII<span style="color: #EF4444;">.</span></span><br/>
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; color: #EF4444; display: block; margin-top: 2px;">ISSN: 2582-8665</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px 40px 40px;">
              <h2 style="font-size: 20px; font-weight: 800; color: #0F172A; margin: 0 0 16px 0; line-height: 1.3;">Editorial Decision: Rejected</h2>
              <p style="font-size: 14.5px; color: #475569; line-height: 1.6; margin: 0 0 24px 0;">
                Dear <strong>${author_name}</strong>,<br/><br/>
                Thank you for submitting your manuscript <strong>"${title}"</strong> (Tracking ID: ${tracking_id}) to the <em>National Journal of Legal Research and Innovative Ideas (NJLRII)</em>.
                <br/><br/>
                We regret to inform you that during the evaluation step <strong>${step_title}</strong>, the editorial committee determined that the manuscript does not meet the criteria required for publication in the journal.
              </p>

              <!-- Editorial Rejection Reason Callout -->
              <div style="background-color: rgba(239, 68, 68, 0.05); border-left: 4px solid #EF4444; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <span style="font-size: 11px; font-weight: bold; color: #EF4444; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 6px;">Evaluation Comments:</span>
                <p style="margin: 0; font-size: 13.5px; color: #0F172A; line-height: 1.5;">
                  "${feedback || 'No comments provided.'}"
                </p>
              </div>

              <p style="font-size: 14px; color: #64748b; line-height: 1.6; margin: 0;">
                Although we are unable to accept your manuscript for publication at this time, we appreciate your interest in NJLRII and wish you success in placing your work elsewhere.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <span style="font-size: 11px; color: #94a3b8; display: block; line-height: 1.5;">
                This decision is final. For details, contact <a href="mailto:editor@njlrii.com" style="color: #EF4444; text-decoration: none;">editor@njlrii.com</a>.
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
    } else {
      return NextResponse.json({ error: 'Invalid step status.' }, { status: 400 });
    }

    // Dispatch the email
    const emailResult = await sendEmail({
      to: recipient_email,
      subject: subject,
      html: emailHtml
    });

    if (!emailResult.success) {
      return NextResponse.json({ error: emailResult.error || 'Failed to dispatch email.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Vetting status email sent successfully.' });
  } catch (error: any) {
    console.error('Send Milestone Email API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
