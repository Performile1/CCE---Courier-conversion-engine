import React from 'react';
import { Loader } from 'lucide-react';

interface WelcomeLoadingScreenProps {
  userEmail: string;
  userName?: string;
}

export const WelcomeLoadingScreen: React.FC<WelcomeLoadingScreenProps> = ({ userEmail, userName }) => {
  const displayName = userName || userEmail.split('@')[0];
  const [loadingStep, setLoadingStep] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setLoadingStep(prev => (prev + 1) % 3);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-dhl-yellow flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        {/* Logo */}
        <div className="bg-white border-b-2 border-dhl-red rounded-sm p-4 mb-8 shadow-md inline-block">
          <h1 className="text-3xl font-black text-dhl-red uppercase tracking-widest">CCE</h1>
          <p className="text-xs font-bold text-dhl-red uppercase tracking-wider mt-1">Courier Conversion Engine</p>
        </div>

        {/* Welcome Message */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-dhl-black mb-2">Välkommen, {displayName}!</h2>
          <p className="text-dhl-gray-dark text-lg">Laddar din miljö</p>
        </div>

        {/* Loading Spinner */}
        <div className="flex justify-center mb-6">
          <Loader className="w-12 h-12 text-dhl-red animate-spin" />
        </div>

        {/* Loading Messages - Non-jumping */}
        <div className="space-y-2 text-sm text-dhl-black font-medium">
          <p>{['Initialiserar dashboard...', 'Ansluter till din data...', 'Nästan klar!'][loadingStep]}</p>
        </div>
      </div>
    </div>
  );
};

export default WelcomeLoadingScreen;
