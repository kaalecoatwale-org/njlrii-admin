import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ALLOWED_ROLES = ['super_admin', 'editor', 'student_editor', 'reviewer', 'author'] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];

/**
 * POST /api/admin/update-role
 *
 * Securely updates a user's role. Server-side verification ensures:
 * 1. The caller holds a valid JWT
 * 2. The caller's DB profile is 'super_admin' (not just trusted from the client)
 * 3. The target role is one of the allowed enum values
 * 4. A super_admin cannot demote themselves
 */
export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error.' },
        { status: 500 }
      );
    }

    // 1. Initialize Supabase Admin Client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 2. Authenticate caller — verify Bearer token
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: Access token is missing.' }, { status: 401 });
    }

    const { data: { user: callerUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !callerUser) {
      return NextResponse.json({ error: 'Unauthorized: Invalid access token.' }, { status: 401 });
    }

    // 3. Authorize — verify caller is super_admin via DB (not JWT metadata)
    const { data: callerProfile, error: callerProfileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', callerUser.id)
      .single();

    if (callerProfileError || !callerProfile || callerProfile.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Forbidden: Only the Editor-in-Chief (super_admin) can change user roles.' },
        { status: 403 }
      );
    }

    // 4. Parse and validate request body
    const { targetUserId, newRole } = await req.json();

    if (!targetUserId || !newRole) {
      return NextResponse.json(
        { error: 'Missing required fields: targetUserId and newRole.' },
        { status: 400 }
      );
    }

    // 5. Validate newRole is a legal enum value (prevent arbitrary role injection)
    if (!ALLOWED_ROLES.includes(newRole as AllowedRole)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${ALLOWED_ROLES.join(', ')}` },
        { status: 400 }
      );
    }

    // 6. Prevent self-demotion — a super_admin cannot remove their own privileges
    if (targetUserId === callerUser.id && newRole !== 'super_admin') {
      return NextResponse.json(
        { error: 'You cannot demote your own super_admin account. Ask another super_admin.' },
        { status: 400 }
      );
    }

    // 7. Perform the role update using the service role client (bypasses RLS safely)
    const { error: updateError } = await supabaseAdmin
      .from('user_profiles')
      .update({ role: newRole })
      .eq('id', targetUserId);

    if (updateError) {
      console.error('Role update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update role. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Role updated to "${newRole}" successfully.`,
    });
  } catch (err: any) {
    console.error('Update role API error:', err);
    return NextResponse.json(
      { error: 'An internal error occurred.' },
      { status: 500 }
    );
  }
}
