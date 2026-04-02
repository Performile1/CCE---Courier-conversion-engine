import React from 'react';
import { Loader } from 'lucide-react';

interface WelcomeLoadingScreenProps {
  userEmail: string;
  userName?: string;
}

export const WelcomeLoadingScreen: React.FC<WelcomeLoadingScreenProps> = ({ userEmail, userName }) => {
  const displayName = userName || userEmail.split('@')[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        {/* Logo */}
        <div className="bg-[#ffcc00] rounded-lg p-4 mb-8 shadow-lg inline-block">
          <h1 className="text-3xl font-black text-red-700 uppercase tracking-widest">CCE</h1>
          <p className="text-xs font-bold text-red-600 uppercase tracking-wider mt-1">Courier Conversion Engine</p>
        </div>

        {/* Welcome Message */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">Welcome, {displayName}!</h2>
          <p className="text-gray-100 text-lg">Loading your environment</p>
        </div>

        {/* Loading Spinner */}
        <div className="flex justify-center mb-6">
          <Loader className="w-12 h-12 text-white animate-spin" />
        </div>

        {/* Loading Messages */}
        <div className="space-y-2 text-sm text-gray-50">
          <p>Initializing dashboard...</p>
          <p>Connecting to your data...</p>
          <p>Almost there!</p>
        </div>
      </div>
    </div>
  );
};

export default WelcomeLoadingScreen;
