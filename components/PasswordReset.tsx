import React, { useState } from 'react';
import { Mail, ArrowLeft, Check, AlertCircle, Loader } from 'lucide-react';
import { resetPassword, updatePassword } from '../services/supabaseClient';

interface PasswordResetProps {
  onBack?: () => void;
  mode?: 'request' | 'confirm';
  resetToken?: string;
}

export const PasswordReset: React.FC<PasswordResetProps> = ({ onBack, mode = 'request', resetToken }) => {
  const [step, setStep] = useState<'request' | 'confirm' | 'success'>(mode);
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!email.includes('@')) {
        throw new Error('Please enter a valid email address');
      }

      await resetPassword(email);
      setSuccess(
        'Password reset link sent! Check your email to complete the reset. The link expires in 1 hour.'
      );
      setEmail('');
      setTimeout(() => setStep('success'), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (newPassword.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }

      if (newPassword !== confirmPassword) {
        throw new Error('Passwords do not match');
      }

      await updatePassword(newPassword);
      setSuccess('Password updated successfully! You can now log in with your new password.');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setStep('success'), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dhl-red to-dhl-red flex items-center justify-center p-4">
        <div className="bg-white rounded-sm shadow-2xl max-w-md w-full p-8 text-center">
          <div className="flex justify-center mb-4">
            <Check className="h-16 w-16 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-dhl-black mb-4">Success!</h2>
          <p className="text-dhl-gray-dark mb-6">{success}</p>
          <button
            onClick={onBack}
            className="w-full bg-dhl-red hover:bg-red-800 text-white py-2 px-4 rounded-sm font-medium transition"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dhl-red to-dhl-red flex items-center justify-center p-4">
      <div className="bg-white rounded-sm shadow-2xl max-w-md w-full p-8">
        {/* Header */}
        <div className="flex items-center mb-6">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 hover:bg-dhl-gray-light rounded-sm mr-2 transition"
            >
              <ArrowLeft className="h-5 w-5 text-dhl-gray-dark" />
            </button>
          )}
          <h2 className="text-2xl font-bold text-dhl-black">
            {step === 'request' ? 'Reset Password' : 'Set New Password'}
          </h2>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-dhl-gray-light border border-dhl-gray-medium rounded-sm flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Request Reset Form */}
        {step === 'request' && (
          <form onSubmit={handleRequestReset} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dhl-gray-dark mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-5 w-5 text-dhl-gray-medium" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full pl-10 py-2 border border-dhl-gray-medium rounded-sm focus:outline-none focus:ring-2 focus:ring-dhl-red"
                />
              </div>
              <p className="text-xs text-dhl-gray-dark mt-1">
                We'll send you a link to reset your password
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full bg-dhl-red hover:bg-red-800 disabled:bg-gray-400 text-white py-2 px-4 rounded-sm font-medium transition flex items-center justify-center gap-2"
            >
              {loading && <Loader className="h-4 w-4 animate-spin" />}
              Send Reset Link
            </button>
          </form>
        )}

        {/* Confirm Reset Form */}
        {step === 'confirm' && (
          <form onSubmit={handleConfirmReset} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dhl-gray-dark mb-2">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full px-4 py-2 border border-dhl-gray-medium rounded-sm focus:outline-none focus:ring-2 focus:ring-dhl-red"
              />
              <p className="text-xs text-dhl-gray-dark mt-1">
                Must be at least 6 characters
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-dhl-gray-dark mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className="w-full px-4 py-2 border border-dhl-gray-medium rounded-sm focus:outline-none focus:ring-2 focus:ring-dhl-red"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !newPassword || !confirmPassword}
              className="w-full bg-dhl-red hover:bg-red-800 disabled:bg-gray-400 text-white py-2 px-4 rounded-sm font-medium transition flex items-center justify-center gap-2"
            >
              {loading && <Loader className="h-4 w-4 animate-spin" />}
              Update Password
            </button>
          </form>
        )}

        {/* Info Text */}
        <p className="text-xs text-dhl-gray-dark text-center mt-6">
          {step === 'request'
            ? 'Check your email for the reset link. Links expire after 1 hour.'
            : 'Enter your new password. Make sure it\'s something you can remember!'}
        </p>
      </div>
    </div>
  );
};



