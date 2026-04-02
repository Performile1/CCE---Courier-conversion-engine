import React, { useEffect, useState } from 'react';

interface WelcomeScreenProps {
  isVisible: boolean;
  userName?: string;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ isVisible, userName = 'User' }) => {
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    if (!isVisible) return;

    // Fade out animation after 2.5 seconds
    const fadeOutTimer = setTimeout(() => {
      setOpacity(0);
    }, 2500);

    return () => clearTimeout(fadeOutTimer);
  }, [isVisible]);

  if (!isVisible && opacity === 0) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 bg-dhl-yellow flex items-center justify-center z-50 transition-opacity duration-500`}
      style={{ opacity }}
    >
      <div className="text-center">
        {/* Welcome Icon */}
        <div className="mb-8">
          <div className="w-24 h-24 bg-dhl-red rounded-sm mx-auto flex items-center justify-center shadow-md">
            <span className="text-white text-3xl font-black">✓</span>
          </div>
        </div>

        {/* Welcome Text */}
        <h1 className="text-5xl font-bold text-dhl-red mb-4">
          Välkommen, {userName}!
        </h1>

        {/* Subtitle */}
        <p className="text-xl text-dhl-black mb-8 font-bold">
          Redo att optimera dina fraktkonverteringar
        </p>

        {/* Loading Animation - Static indicator */}
        <div className="flex justify-center items-center space-x-2">
          <div className="w-3 h-3 bg-dhl-red rounded-full"></div>
          <div className="w-3 h-3 bg-dhl-red rounded-full opacity-50"></div>
          <div className="w-3 h-3 bg-dhl-red rounded-full opacity-30"></div>
        </div>
      </div>

      {/* Decorative elements */}
      <div className="absolute top-10 left-10 w-32 h-32 bg-dhl-red rounded-sm opacity-10"></div>
      <div className="absolute bottom-20 right-12 w-40 h-40 bg-dhl-red rounded-sm opacity-10"></div>
    </div>
  );
};

export default WelcomeScreen;
