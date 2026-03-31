
import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronRight, MousePointer2 } from 'lucide-react';

interface TourProps {
  isOpen: boolean;
  onClose: () => void;
  onDemoFill: (type: 'single' | 'batch') => void; // onDemoFill will trigger demo data in InputForm
}

interface Step {
  targetId?: string; // ID of the DOM element to point to
  title: string;
  content: string;
  action?: () => void;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

export const OnboardingTour: React.FC<TourProps> = ({ isOpen, onClose, onDemoFill }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [cursorPos, setCursorPos] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const STEPS: Step[] = [
    {
      title: "InvenioLeads Sales Intelligence",
      content: "Låt oss ta en snabb tur genom verktyget. Vi hjälper dig hitta och kvalificera leads/prospekts med AI.",
      position: 'center'
    },
    {
      targetId: 'tab-single',
      title: "Enstaka Sökning",
      content: "Här söker du på ett specifikt bolag eller organisationsnummer för att göra en djupanalys.",
      action: () => onDemoFill('single')
    },
    {
      targetId: 'companyNameOrOrg', 
      title: "Sök på företagsnamn eller org. nummer",
      content: "Vi fyller i 'RevolutionRace AB' som exempel. AI:n kommer leta efter fraktvillkor, omsättning och kontaktpersoner.",
    },
    {
      targetId: 'prio1_input', 
      title: "Fokus-Positioner",
      content: "Ange vilka titlar som är intressanta (t.ex. Logistikchef). Du kan också ange ett Icebreaker-ämne.",
    },
    {
      targetId: 'tab-batch',
      title: "Batch Sökning (Prospektering)",
      content: "Detta är ditt kraftfullaste verktyg för att hitta NYA kunder i ett område.",
      action: () => onDemoFill('batch')
    },
    {
      targetId: 'geoArea', 
      title: "Geografiskt Område",
      content: "Ange ort eller postnummer (t.ex. Borås). AI:n skannar marknaden.",
    },
    {
      targetId: 'financialScope', 
      title: "Segment",
      content: "Välj vilket omsättningssegment du vill rikta in dig på (TS, FS eller KAM).",
    },
    {
      targetId: 'triggers_input', 
      title: "Triggers",
      content: "Sök specifikt efter bolag som flaggat för 'Lagerflytt', 'Expansion' eller 'Export'.",
    },
    {
      targetId: 'cache-count-display', // Assuming Header has an ID for cacheCount or similar element
      title: "Lead Reservoir (Cache)",
      content: "Här sparas alla bolag du hittar. Du kan också importera egna listor från Excel för analys.",
    },
    {
      targetId: 'header-inclusions', // Assuming Header has an ID for inclusions button
      title: "Riktad Sökning",
      content: "Sök specifikt på branscher (SNI-koder) eller nyckelord för att smalna av din batch-sökning.",
    },
    {
      targetId: 'header-exclusions', // Assuming Header has an ID for exclusions button
      title: "Exkluderingar",
      content: "Ladda upp en lista på dina befintliga kunder så att du slipper bearbeta dem igen.",
    },
    {
      title: "Redo att jaga!",
      content: "Nu vet du hur verktyget fungerar. Lycka till med jakten!",
      position: 'center'
    }
  ];

  // Move cursor to target logic
  useEffect(() => {
    if (!isOpen) {
      setStepIndex(0); // Reset tour when closed
      return;
    }
    
    const currentStep = STEPS[stepIndex];
    
    // Execute action (like filling demo data) when entering the step
    if (currentStep.action) {
       currentStep.action();
    }

    if (currentStep.targetId) {
      const el = document.getElementById(currentStep.targetId);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);
        // Move cursor to center of element
        setCursorPos({ 
            x: rect.left + rect.width / 2, 
            y: rect.top + rect.height / 2 
        });
      }
    } else {
      // Center position for intro/outro
      setTargetRect(null);
      setCursorPos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    }
  }, [stepIndex, isOpen, onDemoFill]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (stepIndex < STEPS.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      onClose();
    }
  };

  const currentStep = STEPS[stepIndex];

  // Calculate tooltip position relative to cursor/target
  const tooltipStyle: React.CSSProperties = {};
  if (currentStep.targetId && targetRect) {
     // Position tooltip slightly offset from cursor so cursor stays "outside" or visible
     tooltipStyle.top = cursorPos.y + 40; // Increased offset
     tooltipStyle.left = cursorPos.x + 40; // Increased offset

     // Adjust if going off screen
     if (cursorPos.x > window.innerWidth - 350) tooltipStyle.left = cursorPos.x - 350;
     if (cursorPos.y > window.innerHeight - 250) tooltipStyle.top = cursorPos.y - 250;
  } else {
     // Center
     tooltipStyle.top = '50%';
     tooltipStyle.left = '50%';
     tooltipStyle.transform = 'translate(-50%, -50%)';
  }

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
        {/* Semi-transparent background only for non-targeted steps to focus attention */}
        {!currentStep.targetId && (
            <div className="absolute inset-0 bg-black/20 pointer-events-auto" />
        )}

        {/* Ghost Cursor */}
        <div 
            className="absolute z-[102] transition-all duration-700 ease-in-out pointer-events-none drop-shadow-2xl"
            style={{ 
                left: cursorPos.x, 
                top: cursorPos.y,
                transform: 'translate(-5px, -5px)' // Tip of pointer
            }}
        >
            <MousePointer2 className="w-8 h-8 text-red-600 fill-red-600" />
            
            {/* Click Ripple Effect Animation */}
            <div className="absolute top-0 left-0 w-8 h-8 bg-red-600 rounded-full animate-ping opacity-20"></div>
        </div>

        {/* Tooltip Card */}
        <div 
            className="absolute z-[101] bg-white w-80 shadow-2xl border-t-4 border-red-600 pointer-events-auto transition-all duration-500 ease-out p-6 rounded-sm flex flex-col gap-3"
            style={tooltipStyle}
        >
            <div className="flex justify-between items-start">
                <h3 className="text-lg font-black italic uppercase text-black">
                    {currentStep.title}
                </h3>
                <button 
                  onClick={onClose} 
                  className="text-slate-400 hover:text-black"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
            
            <p className="text-sm text-slate-600 leading-relaxed">
                {currentStep.content}
            </p>

            <div className="flex items-center justify-between mt-2 pt-4 border-t border-slate-100">
                <div className="flex gap-1">
                    {STEPS.map((_, idx) => (
                        <div 
                            key={idx} 
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                                idx === stepIndex ? 'w-6 bg-red-600' : 'w-1.5 bg-slate-200'
                            }`}
                        />
                    ))}
                </div>
                <button
                    onClick={handleNext}
                    className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-xs font-bold uppercase tracking-wider shadow-md transition-colors"
                >
                    {stepIndex === STEPS.length - 1 ? 'Starta' : 'Nästa'}
                    <ChevronRight className="w-3 h-3" />
                </button>
            </div>
        </div>
    </div>
  );
};
