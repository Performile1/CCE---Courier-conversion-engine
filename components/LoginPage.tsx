import React, { useState } from 'react';
import { Mail, Lock, User, AlertCircle, Loader, Eye, EyeOff, Phone } from 'lucide-react';
import { signUpWithProfile, signIn } from '../services/supabaseClient';

interface LoginPageProps {
  onAuthSuccess?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        if (!fullName.trim()) {
          throw new Error('Please enter your full name');
        }
        await signUpWithProfile(email, password, fullName, phone || undefined, username || undefined);
        setSuccess('Account created! Check your email to confirm your account.');
        setEmail('');
        setPassword('');
        setFullName('');
        setUsername('');
        setPhone('');
        setTimeout(() => setMode('login'), 3000);
      } else {
        await signIn(email, password);
        setSuccess('Logged in successfully!');
        setTimeout(() => onAuthSuccess?.(), 1000);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = mode === 'signup'
    ? email && password && fullName && password.length >= 6
    : email && password && password.length >= 6;

  return (
    <div className="min-h-screen bg-[#ffcc00] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="bg-dhl-yellow rounded-sm p-4 mb-4 shadow-md inline-block border-b-2 border-dhl-red">
            <h1 className="text-3xl font-black text-dhl-red uppercase tracking-widest">CCE</h1>
            <p className="text-xs font-bold text-dhl-red uppercase tracking-wider mt-1">Courier Conversion Engine</p>
          </div>
          <p className="text-dhl-black text-lg font-semibold">Strategic Lead Intelligence Platform</p>
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-sm shadow-2xl p-8 border-t-4 border-dhl-red">
          {/* Mode Toggle */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-2 px-4 rounded-sm font-semibold transition-all ${
                mode === 'login'
                  ? 'bg-dhl-red text-white'
                  : 'bg-dhl-gray-light text-dhl-red hover:bg-dhl-gray-medium border border-dhl-gray-medium'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('signup'); setError(''); }}
              className={`flex-1 py-2 px-4 rounded-sm font-semibold transition-all ${
                mode === 'signup'
                  ? 'bg-dhl-red text-white'
                  : 'bg-dhl-gray-light text-dhl-red hover:bg-dhl-gray-medium border border-dhl-gray-medium'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name (Sign Up only) */}
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-red-700 mb-1">
                  <User className="w-4 h-4 inline mr-2" />
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full px-4 py-2 border-2 border-dhl-gray-medium rounded-sm focus:ring-2 focus:ring-dhl-red focus:border-dhl-red outline-none transition bg-dhl-gray-light"
                  disabled={loading}
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-red-700 mb-1">
                <Mail className="w-4 h-4 inline mr-2" />
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-2 border-2 border-dhl-gray-medium rounded-sm focus:ring-2 focus:ring-dhl-red focus:border-dhl-red outline-none transition bg-dhl-gray-light"
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-red-700 mb-1">
                <Lock className="w-4 h-4 inline mr-2" />
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2 border-2 border-dhl-gray-medium rounded-sm focus:ring-2 focus:ring-dhl-red focus:border-dhl-red outline-none transition bg-dhl-gray-light"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dhl-red hover:text-red-800"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {mode === 'signup' && (
                <p className="text-xs text-red-600 font-medium mt-1">Minimum 6 characters</p>
              )}
            </div>

            {/* Username (Sign Up only) */}
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-red-700 mb-1">
                  <User className="w-4 h-4 inline mr-2" />
                  Username (Optional)
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your_username"
                  className="w-full px-4 py-2 border-2 border-dhl-gray-medium rounded-sm focus:ring-2 focus:ring-dhl-red focus:border-dhl-red outline-none transition bg-dhl-gray-light"
                  disabled={loading}
                />
              </div>
            )}

            {/* Phone (Sign Up only) */}
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-red-700 mb-1">
                  <Phone className="w-4 h-4 inline mr-2" />
                  Phone Number (Optional)
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full px-4 py-2 border-2 border-dhl-gray-medium rounded-sm focus:ring-2 focus:ring-dhl-red focus:border-dhl-red outline-none transition bg-dhl-gray-light"
                  disabled={loading}
                />
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-dhl-gray-light border-2 border-dhl-red rounded-sm flex gap-2">
                <AlertCircle className="w-5 h-5 text-dhl-red flex-shrink-0 font-bold" />
                <p className="text-sm text-dhl-red font-medium">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="p-3 bg-dhl-gray-light border-2 border-dhl-yellow rounded-sm flex gap-2">
                <AlertCircle className="w-5 h-5 text-dhl-yellow flex-shrink-0 font-bold" />
                <p className="text-sm text-dhl-black font-medium">{success}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!isFormValid || loading}
              className="w-full py-3 px-4 bg-dhl-red hover:bg-red-800 disabled:bg-dhl-gray-medium text-white font-bold rounded-sm transition-all flex items-center justify-center gap-2 uppercase tracking-wide"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  {mode === 'login' ? 'Signing in...' : 'Creating account...'}
                </>
              ) : mode === 'login' ? (
                'Sign In'
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="text-center text-sm text-dhl-red font-medium mt-6">
            {mode === 'login' ? (
              <>
                Don't have an account?{' '}
                <button
                  onClick={() => setMode('signup')}
                  className="text-dhl-black hover:text-dhl-gray-dark font-bold underline"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  onClick={() => setMode('login')}
                  className="text-dhl-black hover:text-dhl-gray-dark font-bold underline"
                >
                  Sign in
              </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
