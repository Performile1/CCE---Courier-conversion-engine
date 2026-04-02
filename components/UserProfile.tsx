import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, Building2, Save, AlertCircle, Check, Loader } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { updateUserProfile, getUserProfile } from '../services/supabaseClient';

interface UserProfileProps {
  userId: string;
  onClose?: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ userId, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    email: '',
    username: '',
    full_name: '',
    phone: '',
    company_name: '',
    subscription_tier: 'free',
    credits_remaining: 1000
  });

  const [editField, setEditField] = useState<string | null>(null);

  // Load user profile
  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      setError('');

      try {
        const user = await supabase.auth.getUser();
        if (!user.data.user) throw new Error('Not authenticated');

        const profile = await getUserProfile(userId);

        if (profile) {
          setFormData({
            email: profile.email || user.data.user.email || '',
            username: profile.username || '',
            full_name: profile.full_name || '',
            phone: profile.phone || '',
            company_name: profile.company_name || '',
            subscription_tier: profile.subscription_tier || 'free',
            credits_remaining: profile.credits_remaining || 1000
          });
        } else {
          setFormData(prev => ({
            ...prev,
            email: user.data.user?.email || ''
          }));
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [userId]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await updateUserProfile(userId, {
        username: formData.username,
        full_name: formData.full_name,
        phone: formData.phone,
        company_name: formData.company_name
      });

      setSuccess('Profile updated successfully!');
      setEditField(null);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-sm shadow-md p-8 flex items-center justify-center min-h-96 border-t-2 border-dhl-red">
        <Loader className="h-8 w-8 text-dhl-red animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <User className="h-6 w-6 text-indigo-600" />
          My Profile
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      {/* Profile Fields */}
      <div className="space-y-6">
        {/* Email (Read-only) */}
        <div className="border-b pb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Mail className="h-4 w-4 inline mr-2" />
            Email Address
          </label>
          <div className="flex items-center p-3 bg-gray-50 rounded-lg">
            <input
              type="email"
              value={formData.email}
              disabled
              className="flex-1 bg-transparent focus:outline-none text-gray-700"
            />
            <span className="text-xs text-gray-500 ml-2">Read-only</span>
          </div>
        </div>

        {/* Username */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Username
          </label>
          {editField === 'username' ? (
            <input
              type="text"
              value={formData.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              placeholder="Choose a username"
              className="w-full px-4 py-2 border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          ) : (
            <div
              onClick={() => setEditField('username')}
              className="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition text-gray-700"
            >
              {formData.username || 'Click to add username'}
            </div>
          )}
        </div>

        {/* Full Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Full Name
          </label>
          {editField === 'full_name' ? (
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => handleInputChange('full_name', e.target.value)}
              placeholder="Your full name"
              className="w-full px-4 py-2 border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          ) : (
            <div
              onClick={() => setEditField('full_name')}
              className="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition text-gray-700"
            >
              {formData.full_name || 'Click to add name'}
            </div>
          )}
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Phone className="h-4 w-4 inline mr-2" />
            Phone Number
          </label>
          {editField === 'phone' ? (
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="w-full px-4 py-2 border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          ) : (
            <div
              onClick={() => setEditField('phone')}
              className="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition text-gray-700"
            >
              {formData.phone || 'Click to add phone'}
            </div>
          )}
        </div>

        {/* Company */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Building2 className="h-4 w-4 inline mr-2" />
            Company Name
          </label>
          {editField === 'company_name' ? (
            <input
              type="text"
              value={formData.company_name}
              onChange={(e) => handleInputChange('company_name', e.target.value)}
              placeholder="Your company name"
              className="w-full px-4 py-2 border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          ) : (
            <div
              onClick={() => setEditField('company_name')}
              className="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition text-gray-700"
            >
              {formData.company_name || 'Click to add company'}
            </div>
          )}
        </div>

        {/* Subscription Info */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-indigo-50 rounded-lg">
          <div>
            <p className="text-sm text-gray-600 font-medium">Subscription</p>
            <p className="text-lg font-bold text-indigo-600 capitalize">
              {formData.subscription_tier}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 font-medium">Credits Remaining</p>
            <p className="text-lg font-bold text-indigo-600">
              {formData.credits_remaining}
            </p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      {editField && (
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => setEditField(null)}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
