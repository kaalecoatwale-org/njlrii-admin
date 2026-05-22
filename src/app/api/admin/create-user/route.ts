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

    // 1. Initialize Supabase Admin Client using the secret Service Role Key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // 2. Authenticate the caller using their Authorization Bearer Token (JWT)
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: Access token is missing.' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: Invalid access token.' }, { status: 401 });
    }

    // 3. Authorize: Query database profiles to ensure user is a super_admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden: Editorial Admin privileges required.' }, { status: 403 });
    }

    // 4. Parse registration inputs from POST request body
    const { email, password, fullName, role } = await req.json();

    if (!email || !password || !role) {
      return NextResponse.json({ error: 'Missing required parameters: email, password, and role are mandatory.' }, { status: 400 });
    }

    // 5. Directly create user in Supabase Auth with auto-confirmed email and custom user metadata
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: password,
      email_confirm: true, // Mark email as confirmed instantly so they can log in without email verification
      user_metadata: {
        full_name: fullName?.trim() || '',
        role: role
      }
    });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    // ==========================================
    // EMAIL TRIGGER: PROVISIONED TEAM CREDENTIALS (Email 6)
    // ==========================================
    try {
      const roleLabels: Record<string, string> = {
        super_admin: 'Super Admin',
        editor: 'Editor',
        student_editor: 'Student Editor',
        reviewer: 'Peer Reviewer'
      };
      const roleLabel = roleLabels[role] || role;
      const loginUrl = req.nextUrl.origin;

      const emailHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Account Created - NJLRII</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Inter', system-ui, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <tr><td height="6" style="background-color: #0F172A;"></td></tr>
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: left;">
              <span style="font-size: 24px; font-weight: 800; color: #0F172A; letter-spacing: -0.02em;">NJLRII<span style="color: #FC0434;">.</span></span><br/>
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; color: #64748b; display: block; margin-top: 2px;">EDITORIAL DASHBOARD ACCESS</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px 40px 40px;">
              <h2 style="font-size: 20px; font-weight: 800; color: #0F172A; margin: 0 0 16px 0; line-height: 1.3;">Welcome to the NJLRII Team</h2>
              <p style="font-size: 14.5px; color: #475569; line-height: 1.6; margin: 0 0 24px 0;">
                Dear <strong>${fullName?.trim() || 'Team Member'}</strong>,<br/><br/>
                An administrator has successfully created your academic portal account on the NJLRII Admin Panel. You have been assigned the role of <strong>${roleLabel}</strong>.
              </p>

              <!-- Credentials Card -->
              <table width="100%" border="0" cellspacing="0" cellpadding="12" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td width="30%" style="font-size: 12.5px; font-weight: bold; color: #64748b; text-transform: uppercase;">Login Email</td>
                  <td style="font-size: 14px; font-weight: 600; color: #0F172A;">${email.trim().toLowerCase()}</td>
                </tr>
                <tr>
                  <td style="font-size: 12.5px; font-weight: bold; color: #64748b; text-transform: uppercase;">Assigned Role</td>
                  <td style="font-size: 14px; font-weight: 600; color: #0F172A;">${roleLabel}</td>
                </tr>
              </table>

              <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 14px; font-size: 12.5px; color: #b45309; line-height: 1.5; margin-bottom: 24px;">
                🔑 <strong>Security Note:</strong> Your temporary login password will be shared with you separately by your administrator through a secure channel (e.g. direct message or phone call). Please change your password immediately after your first login.
              </div>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${loginUrl}" style="background-color: #0F172A; color: #ffffff; padding: 14px 28px; border-radius: 30px; font-size: 13px; font-weight: bold; text-decoration: none; text-transform: uppercase; display: inline-block;">Access Login Console</a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <span style="font-size: 11px; color: #94a3b8; display: block; line-height: 1.5;">
                Do not share these credentials. If you did not request this access, contact <a href="mailto:admin@njlrii.com" style="color: #FC0434; text-decoration: none;">admin@njlrii.com</a>.
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
        to: email.trim().toLowerCase(),
        subject: 'Welcome to NJLRII: Your Team Account Credentials',
        html: emailHtml
      });
    } catch (emailErr) {
      console.error('[EMAIL ERROR] Failed to send credentials email:', emailErr);
    }
    // ==========================================

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.user.id,
        email: newUser.user.email,
        fullName: fullName?.trim() || '',
        role: role
      }
    });
  } catch (err: any) {
    console.error('Error in user provisioning API:', err);
    return NextResponse.json(
      { error: err.message || 'An internal server error occurred during provisioning.' },
      { status: 500 }
    );
  }
}
