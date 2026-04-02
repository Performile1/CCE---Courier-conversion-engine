

import React, { useState, useEffect } from 'react';
import { Clock, RefreshCw } from 'lucide-react';

interface QuotaTimerProps {
  onComplete: () => void;
  customWaitSeconds?: number | null; // New prop for exact wait times
}

export const QuotaTimer: React.FC<QuotaTimerProps> = ({ onComplete, customWaitSeconds }) => {
  // Calculate seconds until next midnight (Local Time)
  const calculateSecondsToMidnight = () => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0); // Sets to 00:00:00 next day
    return Math.floor((midnight.getTime() - now.getTime()) / 1000);
  };

  // Determine initial time: Custom wait OR Midnight
  const getInitialSeconds = () => {
    if (customWaitSeconds && customWaitSeconds > 0) return customWaitSeconds;
    return calculateSecondsToMidnight();
  };

  const [seconds, setSeconds] = useState(getInitialSeconds());
  const [isReady, setIsReady] = useState(false);

  // Update seconds if prop changes
  useEffect(() => {
    if (customWaitSeconds) {
       setSeconds(customWaitSeconds);
       setIsReady(false);
    }
  }, [customWaitSeconds]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) {
          setIsReady(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isCustom = !!customWaitSeconds;

  return (
    <div className="bg-dhl-gray-light border-l-4 border-[#ffb700] p-6 shadow-md rounded-sm animate-fadeIn my-4">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-orange-100 rounded-full">
          {isReady ? (
            <RefreshCw className="w-8 h-8 text-red-600 animate-pulse" />
          ) : (
            <Clock className="w-8 h-8 text-[#ffb700]" />
          )}
        </div>
        
        <div className="flex-1">
          <h3 className="text-lg font-black uppercase text-dhl-black mb-1 flex items-center gap-2">
            {isReady ? "System Redo" : "API-Kvoten Pausad"}
          </h3>
          
          <p className="text-xs text-dhl-gray-dark mb-4 max-w-md">
            {isReady 
              ? "Väntetiden är över. Du kan nu fortsätta söka." 
              : isCustom 
                 ? "Google har satt en tillfällig spärr på 'Search Grounding'-verktyget. Vi måste vänta ut tiden nedan."
                 : "Du har använt dagens maximala antal sökningar. För att garantera driftstabilitet pausas sökningar tills nästa dygn."}
          </p>

          {!isReady && (
            <div className="mb-4">
              <div className="flex justify-between text-xs font-bold text-slate-500 mb-1">
                <span>Tid till återställning:</span>
                <span className="font-mono text-lg text-red-600">{formatTime(seconds)}</span>
              </div>
              <div className="w-full bg-dhl-gray-medium h-2 rounded-full overflow-hidden">
                 <div 
                  className="bg-[#ffb700] h-full animate-pulse"
                  style={{ width: '100%' }}
                ></div>
              </div>
            </div>
          )}

          {isReady && (
            <button
              onClick={onComplete}
              className="flex items-center gap-2 bg-red-600 text-white px-6 py-2 text-sm font-bold uppercase tracking-wider hover:bg-red-700 transition-colors shadow-sm rounded-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Återställ & Sök
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

