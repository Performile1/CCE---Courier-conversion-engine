/**
 * SUPABASE CLIENT & INITIALIZATION
 * Initialize Supabase connection with TypeScript support
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabaseInitializationError = !SUPABASE_URL || !SUPABASE_ANON_KEY
  ? new Error('Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your local Vite environment.')
  : null;

const supabaseClient = supabaseInitializationError
  ? null
  : createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });

function requireSupabaseClient() {
  if (!supabaseClient) {
    throw supabaseInitializationError;
  }

  return supabaseClient;
}

const missingSupabaseClient = new Proxy({}, {
  get() {
    throw (supabaseInitializationError || new Error('Supabase client is not initialized.'));
  }
});

// The exported client is intentionally relaxed because the checked-in generated
// schema types are incomplete compared to the active database shape.
export const supabase: any = supabaseClient || missingSupabaseClient;

/**
 * Get current user session
 */
export async function getCurrentSession() {
  const { data, error } = await requireSupabaseClient().auth.getSession();
  if (error) throw error;
  return data.session;
}

/**
 * Get current user
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await requireSupabaseClient().auth.getUser();
  if (error) throw error;
  return user;
}

/**
 * Sign up with email
 */
export async function signUp(email: string, password: string, fullName: string) {
  const { data, error } = await requireSupabaseClient().auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName
      }
    }
  });

  if (error) throw error;
  return data;
}

/**
 * Sign in with email
 */
export async function signIn(email: string, password: string) {
  const { data, error } = await requireSupabaseClient().auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;
  return data;
}

/**
 * Sign out
 */
export async function signOut() {
  const { error } = await requireSupabaseClient().auth.signOut();
  if (error) throw error;
}

/**
 * Reset password
 */
export async function resetPassword(email: string) {
  const { data, error } = await requireSupabaseClient().auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/callback`
  });

  if (error) throw error;
  return data;
}

/**
 * Send magic link for sign-in/invite.
 * If shouldCreateUser=true, Supabase can create user on first link use.
 */
export async function sendMagicLink(email: string, shouldCreateUser: boolean = true) {
  const { data, error } = await requireSupabaseClient().auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser,
      emailRedirectTo: window.location.origin
    }
  });

  if (error) throw error;
  return data;
}

/**
 * Admin helper for sending password reset email.
 */
export async function sendPasswordResetEmail(email: string) {
  const { data, error } = await requireSupabaseClient().auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/callback`
  });

  if (error) throw error;
  return data;
}

export interface InviteUserResult {
  success: boolean;
  userId: string;
  email: string;
  role: 'admin' | 'user' | 'viewer';
  message?: string;
}

/**
 * Invite a user through backend endpoint so Supabase can send activation email.
 */
export async function inviteUserWithActivation(
  email: string,
  role: 'admin' | 'user' | 'viewer',
  fullName?: string
): Promise<InviteUserResult> {
  const { data: sessionData } = await requireSupabaseClient().auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    throw new Error('You must be logged in to invite users');
  }

  const response = await fetch('/api/supabase-invite-user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({ email, role, fullName })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || 'Failed to invite user');
  }

  return payload as InviteUserResult;
}

/**
 * Update password
 */
export async function updatePassword(newPassword: string) {
  const { data, error } = await requireSupabaseClient().auth.updateUser({
    password: newPassword
  });

  if (error) throw error;
  return data;
}

/**
 * Listen for auth changes
 */
export function onAuthStateChange(callback: (user: any) => void) {
  return requireSupabaseClient().auth.onAuthStateChange((event, session) => {
    callback(session?.user || null);
  });
}

/**
 * Create user profile in users table
 */
export async function createUserProfile(
  userId: string,
  email: string,
  fullName: string,
  phone?: string,
  username?: string
) {
  const { data, error } = await requireSupabaseClient()
    .from('users')
    .upsert({
      id: userId,
      email,
      full_name: fullName,
      phone: phone || null,
      username: username || null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' })
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Get user profile
 */
export async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .limit(1)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
  return data || null;
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: string,
  updates: {
    username?: string;
    phone?: string;
    company_name?: string;
    full_name?: string;
  }
) {
  const { data, error } = await supabase
    .from('users')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)
    .select()
    .maybeSingle();

  if (error) throw error;

  // If row does not exist yet, create it using auth user email as fallback.
  if (!data) {
    const { data: authData } = await supabase.auth.getUser();
    const { data: inserted, error: insertError } = await supabase
      .from('users')
      .upsert({
        id: userId,
        email: authData.user?.email || '',
        ...updates,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })
      .select()
      .maybeSingle();

    if (insertError) throw insertError;
    return inserted;
  }

  return data;
}

/**
 * Sign up with extended profile fields
 */
export async function signUpWithProfile(
  email: string,
  password: string,
  fullName: string,
  phone?: string,
  username?: string
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone: phone || null,
        username: username || null
      }
    }
  });

  if (error) throw error;

  // Create user profile if sign up succeeded
  if (data.user) {
    try {
      await createUserProfile(data.user.id, email, fullName, phone, username);
    } catch (profileError) {
      console.error('Error creating user profile:', profileError);
    }
  }

  return data;
}
