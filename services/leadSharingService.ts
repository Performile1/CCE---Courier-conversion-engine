/**
 * Lead Sharing Service
 * Handles sharing of leads between users in the system
 */

import { supabase } from './supabaseClient';
import { LeadData } from '../types';

export interface SharedLead {
  id: string;
  original_lead_id: string;
  sender_id: string;
  recipient_id: string;
  recipient_email: string;
  lead_data: LeadData;
  message?: string;
  shared_at: string;
  read_at?: string;
  created_at?: string;
}

export interface SystemUser {
  id: string;
  email: string;
  full_name?: string;
  username?: string;
}

/**
 * Get all active system users (for recipient selection)
 */
export async function getSystemUsers(): Promise<SystemUser[]> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, username')
      .order('email');

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching system users:', err);
    return [];
  }
}

/**
 * Send a lead to another user
 */
export async function shareLead(
  leadId: string,
  leadData: LeadData,
  recipientEmail: string,
  message?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Get recipient user ID from email
    const { data: recipientData, error: recipientError } = await supabase
      .from('users')
      .select('id')
      .eq('email', recipientEmail)
      .single();

    if (recipientError || !recipientData) {
      throw new Error(`User with email ${recipientEmail} not found`);
    }

    // Create shared lead record
    const { error: insertError } = await supabase
      .from('shared_leads')
      .insert([{
        original_lead_id: leadId,
        sender_id: user.id,
        recipient_id: recipientData.id,
        recipient_email: recipientEmail,
        lead_data: leadData,
        message: message || null,
        shared_at: new Date().toISOString(),
      }]);

    if (insertError) throw insertError;

    return { success: true };
  } catch (err: any) {
    console.error('Error sharing lead:', err);
    return { 
      success: false, 
      error: err.message || 'Failed to share lead' 
    };
  }
}

/**
 * Get shared leads for current user
 */
export async function getSharedLeads(limit = 50): Promise<SharedLead[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data, error } = await supabase
      .from('shared_leads')
      .select('*')
      .eq('recipient_id', user.id)
      .order('shared_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching shared leads:', err);
    return [];
  }
}

/**
 * Mark a shared lead as read
 */
export async function markSharedLeadAsRead(sharedLeadId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('shared_leads')
      .update({ read_at: new Date().toISOString() })
      .eq('id', sharedLeadId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error marking shared lead as read:', err);
    return false;
  }
}

/**
 * Delete a shared lead (by recipient)
 */
export async function deleteSharedLead(sharedLeadId: string): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('shared_leads')
      .delete()
      .eq('id', sharedLeadId)
      .eq('recipient_id', user.id);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error deleting shared lead:', err);
    return false;
  }
}

/**
 * Get sent leads (leads shared by current user)
 */
export async function getSentLeads(limit = 50): Promise<SharedLead[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data, error } = await supabase
      .from('shared_leads')
      .select('*')
      .eq('sender_id', user.id)
      .order('shared_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching sent leads:', err);
    return [];
  }
}
