
import React, { useState, useEffect } from 'react';
import { TrafficCone, Timer } from 'lucide-react';

interface RateLimitOverlayProps {
  onComplete: () => void;
}

export const RateLimitOverlay: React.FC<RateLimitOverlayProps> = ({ onComplete }) => {
  const [seconds, setSeconds] = useState(60);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) {
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

  // Removed `const isCustom = !!customWaitSeconds;` as `customWaitSeconds` is not a prop in RateLimitOverlay

  return (
    <div className="bg-orange-50 border-l-4 border-orange-500 p-6 shadow-md rounded-sm animate-fadeIn my-4">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-orange-100 rounded-full animate-pulse">
          <TrafficCone className="w-8 h-8 text-orange-600" />
        </div>
        
        <div className="flex-1">
          <h3 className="text-lg font-black uppercase text-slate-800 mb-1 flex items-center gap-2">
            Tillfällig Trafikstockning (API Rate Limit)
          </h3>
          
          <p className="text-xs text-slate-600 mb-4 max-w-md">
            Vi har gjort många anrop på kort tid. För att garantera datakvalitet och undvika blockering tar systemet en kort paus. 
          </p>

          {seconds > 0 ? (
            <div className="mb-4">
              <div className="flex justify-between text-xs font-bold text-slate-500 mb-1">
                <span>Tid till återställning:</span>
                <span className="font-mono text-lg text-orange-600">{seconds} sek</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                 <div 
                  className="bg-orange-500 h-full transition-all duration-1000 ease-linear"
                  style={{ width: `${(seconds / 60) * 100}%` }}
                ></div>
              </div>
            </div>
          ) : (
            <button
              onClick={onComplete}
              className="flex items-center gap-2 bg-green-600 text-white px-6 py-2 text-sm font-bold uppercase tracking-wider hover:bg-green-700 transition-colors shadow-sm rounded-sm animate-bounce"
            >
              Fortsätt Söka
            </button>
          )}
        </div>
      </div>
    </div>
  );
};