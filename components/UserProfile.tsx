import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, Building2, Save, AlertCircle, Check, Loader, Globe } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { updateUserProfile, getUserProfile } from '../services/supabaseClient';

interface UserProfileProps {
  userId: string;
  onClose?: () => void;
  activeSourceCountry?: string;
  setActiveSourceCountry?: (country: string) => void;
}

// Phone country code to ISO country mapping
const PHONE_COUNTRY_CODES: Record<string, string> = {
  '46': 'se',   // Sweden
  '47': 'no',   // Norway
  '45': 'dk',   // Denmark
  '358': 'fi',  // Finland
  '1': 'se',    // Default to SE for +1 (US/CA fallback)
  '44': 'se',   // UK fallback to SE
};

const COUNTRY_DISPLAY: Record<string, string> = {
  'global': 'Global',
  'se': 'Sweden',
  'no': 'Norway',
  'dk': 'Denmark',
  'fi': 'Finland'
};

function extractCountryFromPhone(phone: string): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/\D/g, '');
  for (const code of Object.keys(PHONE_COUNTRY_CODES).sort((a, b) => b.length - a.length)) {
    if (cleaned.startsWith(code)) {
      return PHONE_COUNTRY_CODES[code];
    }
  }
  return null;
}

export const UserProfile: React.FC<UserProfileProps> = ({ userId, onClose, activeSourceCountry, setActiveSourceCountry }) => {
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
  const [detectedCountry, setDetectedCountry] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string>(activeSourceCountry || 'global');

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
    if (field === 'phone') {
      const country = extractCountryFromPhone(value);
      setDetectedCountry(country);
      if (country && setActiveSourceCountry) {
        setSelectedCountry(country);
        setActiveSourceCountry(country);
      }
    }
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
    <div className="bg-white rounded-sm shadow-md p-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-dhl-black flex items-center gap-2">
          <User className="h-6 w-6 text-dhl-red" />
          My Profile
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-dhl-gray-dark hover:text-dhl-gray-dark text-2xl"
          >
            ×
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-dhl-gray-light border border-dhl-gray-medium rounded-sm flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="mb-4 p-4 bg-dhl-gray-light border border-green-200 rounded-sm flex items-start gap-3">
          <Check className="h-5 w-5 text-dhl-yellow flex-shrink-0 mt-0.5" />
          <p className="text-sm text-dhl-yellow">{success}</p>
        </div>
      )}

      {/* Profile Fields */}
      <div className="space-y-6">
        {/* Email (Read-only) */}
        <div className="border-b pb-6">
          <label className="block text-sm font-medium text-dhl-gray-dark mb-2">
            <Mail className="h-4 w-4 inline mr-2" />
            Email Address
          </label>
          <div className="flex items-center p-3 bg-dhl-gray-light rounded-sm">
            <input
              type="email"
              value={formData.email}
              disabled
              className="flex-1 bg-transparent focus:outline-none text-dhl-gray-dark"
            />
            <span className="text-xs text-dhl-gray-dark ml-2">Read-only</span>
          </div>
        </div>

        {/* Username */}
        <div>
          <label className="block text-sm font-medium text-dhl-gray-dark mb-2">
            Username
          </label>
          {editField === 'username' ? (
            <input
              type="text"
              value={formData.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              placeholder="Choose a username"
              className="w-full px-4 py-2 border border-dhl-gray-medium rounded-sm focus:outline-none focus:ring-2 focus:ring-dhl-red"
            />
          ) : (
            <div
              onClick={() => setEditField('username')}
              className="p-3 bg-dhl-gray-light rounded-sm cursor-pointer hover:bg-dhl-gray-light transition text-dhl-gray-dark"
            >
              {formData.username || 'Click to add username'}
            </div>
          )}
        </div>

        {/* Full Name */}
        <div>
          <label className="block text-sm font-medium text-dhl-gray-dark mb-2">
            Full Name
          </label>
          {editField === 'full_name' ? (
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => handleInputChange('full_name', e.target.value)}
              placeholder="Your full name"
              className="w-full px-4 py-2 border border-dhl-gray-medium rounded-sm focus:outline-none focus:ring-2 focus:ring-dhl-red"
            />
          ) : (
            <div
              onClick={() => setEditField('full_name')}
              className="p-3 bg-dhl-gray-light rounded-sm cursor-pointer hover:bg-dhl-gray-light transition text-dhl-gray-dark"
            >
              {formData.full_name || 'Click to add name'}
            </div>
          )}
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-dhl-gray-dark mb-2">
            <Phone className="h-4 w-4 inline mr-2" />
            Phone Number
          </label>
          {editField === 'phone' ? (
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              placeholder="+46 (0)8 123 456"
              className="w-full px-4 py-2 border border-dhl-gray-medium rounded-sm focus:outline-none focus:ring-2 focus:ring-dhl-red"
            />
          ) : (
            <div
              onClick={() => setEditField('phone')}
              className="p-3 bg-dhl-gray-light rounded-sm cursor-pointer hover:bg-dhl-gray-light transition text-dhl-gray-dark"
            >
              {formData.phone || 'Click to add phone'}
            </div>
          )}
          {detectedCountry && formData.phone && editField === 'phone' && (
            <p className="mt-2 text-xs text-green-600 flex items-center gap-1">
              ✓ Detected: {COUNTRY_DISPLAY[detectedCountry]}
            </p>
          )}
        </div>

        {/* Source Country */}
        <div>
          <label className="block text-sm font-medium text-dhl-gray-dark mb-2">
            <Globe className="h-4 w-4 inline mr-2" />
            Source Country (for tools & search)
          </label>
          <div className="flex items-center gap-3 bg-dhl-gray-light rounded-sm p-3">
            <select
              value={selectedCountry}
              onChange={(e) => {
                setSelectedCountry(e.target.value);
                if (setActiveSourceCountry) {
                  setActiveSourceCountry(e.target.value);
                }
              }}
              className="flex-1 bg-white border border-dhl-gray-medium rounded-sm px-3 py-2 text-xs font-black text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-dhl-red"
            >
              <option value="global">GLOBAL</option>
              <option value="se">SWEDEN</option>
              <option value="no">NORWAY</option>
              <option value="dk">DENMARK</option>
              <option value="fi">FINLAND</option>
            </select>
            {detectedCountry && detectedCountry !== selectedCountry && (
              <span className="text-[10px] font-black text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
                Detected: {COUNTRY_DISPLAY[detectedCountry].toUpperCase()}
              </span>
            )}
          </div>
          <p className="mt-1 text-[10px] text-slate-500">Auto-detected from phone number. Change manually if needed.</p>
        </div>

        {/* Company */}
        <div>
          <label className="block text-sm font-medium text-dhl-gray-dark mb-2">
            <Building2 className="h-4 w-4 inline mr-2" />
            Company Name
          </label>
          {editField === 'company_name' ? (
            <input
              type="text"
              value={formData.company_name}
              onChange={(e) => handleInputChange('company_name', e.target.value)}
              placeholder="Your company name"
              className="w-full px-4 py-2 border border-dhl-gray-medium rounded-sm focus:outline-none focus:ring-2 focus:ring-dhl-red"
            />
          ) : (
            <div
              onClick={() => setEditField('company_name')}
              className="p-3 bg-dhl-gray-light rounded-sm cursor-pointer hover:bg-dhl-gray-light transition text-dhl-gray-dark"
            >
              {formData.company_name || 'Click to add company'}
            </div>
          )}
        </div>

        {/* Subscription Info */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-dhl-gray-light rounded-sm">
          <div>
            <p className="text-sm text-dhl-gray-dark font-medium">Subscription</p>
            <p className="text-lg font-bold text-dhl-red capitalize">
              {formData.subscription_tier}
            </p>
          </div>
          <div>
            <p className="text-sm text-dhl-gray-dark font-medium">Credits Remaining</p>
            <p className="text-lg font-bold text-dhl-red">
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
            className="flex-1 px-4 py-2 border border-dhl-gray-medium text-dhl-gray-dark rounded-sm hover:bg-dhl-gray-light transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-dhl-red text-white rounded-sm hover:bg-red-800 disabled:bg-gray-400 transition flex items-center justify-center gap-2"
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



