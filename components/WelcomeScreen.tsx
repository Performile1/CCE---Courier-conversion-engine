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
      className={`fixed inset-0 bg-gradient-to-br from-blue-600 via-blue-500 to-purple-600 flex items-center justify-center z-50 transition-opacity duration-500`}
      style={{ opacity }}
    >
      <div className="text-center">
        {/* Welcome Icon */}
        <div className="mb-8 animate-bounce">
          <svg
            className="w-24 h-24 text-white mx-auto"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M14 10h-2m0 0h-2m2 0v2m0-2v-2m0 8c-4.418 0-8 1.343-8 3s3.582 3 8 3 8-1.343 8-3-3.582-3-8-3z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2h-2M9 3V1m6 2V1m0 0a1 1 0 00-1-1h-4a1 1 0 00-1 1"
            />
          </svg>
        </div>

        {/* Welcome Text */}
        <h1 className="text-5xl font-bold text-white mb-4 animate-pulse">
          Welcome, {userName}!
        </h1>

        {/* Subtitle */}
        <p className="text-xl text-blue-100 mb-8 font-light">
          Ready to optimize your carrier conversions
        </p>

        {/* Loading Animation */}
        <div className="flex justify-center items-center space-x-2">
          <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
          <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
        </div>
      </div>

      {/* Decorative elements */}
      <div className="absolute top-10 left-10 w-32 h-32 bg-white rounded-full opacity-10 animate-pulse"></div>
      <div className="absolute bottom-20 right-12 w-40 h-40 bg-white rounded-full opacity-10 animate-pulse" style={{ animationDelay: '1s' }}></div>
    </div>
  );
};

export default WelcomeScreen;
