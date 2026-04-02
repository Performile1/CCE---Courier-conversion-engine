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
    <div className="min-h-screen bg-[#C9C9C9] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="bg-[#ffcc00] rounded-lg p-4 mb-4 shadow-lg inline-block">
            <h1 className="text-3xl font-black text-red-700 uppercase tracking-widest">CCE</h1>
            <p className="text-xs font-bold text-red-600 uppercase tracking-wider mt-1">Courier Conversion Engine</p>
          </div>
          <p className="text-yellow-100 text-lg font-semibold">Strategic Lead Intelligence Platform</p>
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-lg shadow-2xl p-8">
          {/* Mode Toggle */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all ${
                mode === 'login'
                  ? 'bg-red-600 text-white'
                  : 'bg-yellow-50 text-red-700 hover:bg-yellow-100 border border-yellow-300'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('signup'); setError(''); }}
              className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all ${
                mode === 'signup'
                  ? 'bg-red-600 text-white'
                  : 'bg-yellow-50 text-red-700 hover:bg-yellow-100 border border-yellow-300'
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
                  className="w-full px-4 py-2 border-2 border-yellow-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition bg-yellow-50"
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
                className="w-full px-4 py-2 border-2 border-yellow-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition bg-yellow-50"
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
                  className="w-full px-4 py-2 border-2 border-yellow-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition bg-yellow-50"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-red-600 hover:text-red-700"
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
                  className="w-full px-4 py-2 border-2 border-yellow-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition bg-yellow-50"
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
                  className="w-full px-4 py-2 border-2 border-yellow-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition bg-yellow-50"
                  disabled={loading}
                />
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border-2 border-red-600 rounded-lg flex gap-2">
                <AlertCircle className="w-5 h-5 text-red-700 flex-shrink-0 font-bold" />
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="p-3 bg-yellow-50 border-2 border-yellow-400 rounded-lg flex gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-700 flex-shrink-0 font-bold" />
                <p className="text-sm text-yellow-700 font-medium">{success}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!isFormValid || loading}
              className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 disabled:bg-yellow-300 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 uppercase tracking-wide"
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
          <p className="text-center text-sm text-red-700 font-medium mt-6">
            {mode === 'login' ? (
              <>
                Don't have an account?{' '}
                <button
                  onClick={() => setMode('signup')}
                  className="text-red-600 hover:text-red-800 font-bold underline"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  onClick={() => setMode('login')}
                  className="text-red-600 hover:text-red-800 font-bold underline"
                >
                  Sign in
              </button>
              </>
            )}
          </p>
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="text-white">
            <div className="text-2xl font-bold text-indigo-400">5</div>
            <div className="text-sm text-slate-300">AI Models</div>
          </div>
          <div className="text-white">
            <div className="text-2xl font-bold text-indigo-400">30%</div>
            <div className="text-sm text-slate-300">Cost Savings</div>
          </div>
          <div className="text-white">
            <div className="text-2xl font-bold text-indigo-400">100%</div>
            <div className="text-sm text-slate-300">Verified</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
