import React, { useEffect, useState } from 'react';

interface WelcomeScreenProps {
  isVisible: boolean;
  userName?: string;
}

function formatDisplayName(rawName: string): string {
  const cleaned = String(rawName || '')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return 'User';

  return cleaned
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ isVisible, userName = 'User' }) => {
  const [opacity, setOpacity] = useState(1);
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);
  const displayName = formatDisplayName(userName);

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
      className={`fixed inset-0 bg-dhl-yellow flex items-center justify-center z-modal transition-opacity duration-500`}
      style={{ opacity }}
    >
      <div className="text-center">
        {/* Welcome Logo */}
        <div className="mb-8">
          {!logoLoadFailed ? (
            <img
              src="/favicon.svg"
              alt="CCE logo"
              className="w-[360px] max-w-[85vw] h-auto mx-auto rounded-sm shadow-md"
              onError={() => setLogoLoadFailed(true)}
            />
          ) : (
            <div className="w-44 h-24 bg-dhl-red rounded-sm mx-auto flex items-center justify-center shadow-md">
              <span className="text-dhl-yellow text-5xl font-black italic tracking-tight">CCE</span>
            </div>
          )}
        </div>

        {/* Welcome Text */}
        <h1 className="text-5xl font-bold text-dhl-red mb-4">
          Välkommen, {displayName}!
        </h1>

        {/* Subtitle */}
        <div className="mb-8 space-y-3">
          <p className="text-base text-dhl-black font-bold max-w-2xl mx-auto leading-relaxed">
            Är du redo att hitta nya möjligheter eller fortsatt vara i kontroll i dina pågående affärer?
          </p>
        </div>

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
