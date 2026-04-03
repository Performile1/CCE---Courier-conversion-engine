import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

interface InviteRequest {
  email?: string;
  role?: 'admin' | 'user' | 'viewer';
  fullName?: string;
}

function normalizeEmail(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

function parseAdminEmails(raw?: string) {
  return new Set(
    String(raw || '')
      .split(',')
      .map(entry => normalizeEmail(entry))
      .filter(Boolean)
  );
}

function hasAdminRole(user: any) {
  const candidates = [
    user?.app_metadata?.role,
    user?.app_metadata?.app_role,
    user?.user_metadata?.role,
    user?.user_metadata?.app_role
  ];

  return candidates.some(value => String(value || '').toLowerCase() === 'admin');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
    return;
  }

  try {
    const { email, role = 'user', fullName } = req.body as InviteRequest;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      res.status(400).json({ error: 'Valid email is required' });
      return;
    }

    const allowedRoles = new Set(['admin', 'user', 'viewer']);
    if (!allowedRoles.has(role)) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      res.status(401).json({ error: 'Missing bearer token' });
      return;
    }

    const token = authHeader.slice(7);
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: requesterData, error: requesterError } = await adminClient.auth.getUser(token);
    if (requesterError || !requesterData.user) {
      res.status(401).json({ error: 'Invalid authentication token' });
      return;
    }

    const allowedAdminEmails = parseAdminEmails(process.env.SUPABASE_ADMIN_EMAILS);
    const requesterEmail = normalizeEmail(requesterData.user.email);
    const requesterIsAdmin = hasAdminRole(requesterData.user) || allowedAdminEmails.has(requesterEmail);

    if (!requesterIsAdmin) {
      res.status(403).json({ error: 'Only admins can invite users' });
      return;
    }

    const redirectTo = `${process.env.FRONTEND_URL || req.headers.origin || 'http://localhost:5173'}/auth/callback`;

    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      normalizedEmail,
      {
        redirectTo,
        data: {
          full_name: fullName || null,
          app_role: role
        }
      }
    );

    if (inviteError) {
      const status = inviteError.message?.toLowerCase().includes('already') ? 409 : 400;
      res.status(status).json({ error: inviteError.message });
      return;
    }

    const invitedUserId = inviteData.user?.id;
    if (!invitedUserId) {
      res.status(500).json({ error: 'Invite created but no user id returned' });
      return;
    }

    const { error: profileError } = await adminClient
      .from('users')
      .upsert(
        {
          id: invitedUserId,
          email: normalizedEmail,
          full_name: fullName || null,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'id' }
      );

    if (profileError) {
      console.error('Profile upsert warning:', profileError.message);
    }

    res.status(200).json({
      success: true,
      userId: invitedUserId,
      email: normalizedEmail,
      role,
      message: 'Activation email sent via Supabase invite flow'
    });
  } catch (error: any) {
    console.error('Invite API error:', error?.message || error);
    res.status(500).json({ error: error?.message || 'Internal server error' });
  }
}
