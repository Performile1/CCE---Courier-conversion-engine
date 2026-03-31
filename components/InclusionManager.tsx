
import React, { useState, useEffect } from 'react';
import { Target, X, Plus, Check, Search } from 'lucide-react';

interface InclusionManagerProps {
  isOpen: boolean;
  onClose: () => void;
  includedKeywords: string[];
  setIncludedKeywords: (list: string[]) => void;
}

export const InclusionManager: React.FC<InclusionManagerProps> = ({
  isOpen,
  onClose,
  includedKeywords,
  setIncludedKeywords
}) => {
  const [textInput, setTextInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // COMPREHENSIVE SCB SNI 2007 DATABASE (MAIN GROUPS 01-99)
  const SNI_DATABASE = [
    // --- A. JORDBRUK, SKOGSBRUK & FISKE ---
    { code: "01", label: "Jordbruk och husdjursskötsel" },
    { code: "02", label: "Skogsbruk" },
    { code: "03", label: "Fiske och vattenbruk" },

    // --- B. UTVINNING AV MINERAL ---
    { code: "05", label: "Kolutvinning" },
    { code: "06", label: "Utvinning av råolja och naturgas" },
    { code: "07", label: "Utvinning av malm" },
    { code: "08", label: "Annan utvinning av mineral" },
    { code: "09", label: "Tjänster kopplade till utvinning" },

    // --- C. TILLVERKNING (HEAVY INDUSTRY & PRODUCTION) ---
    { code: "10", label: "Livsmedelsframställning" },
    { code: "11", label: "Framställning av drycker" },
    { code: "12", label: "Tobaksvarutillverkning" },
    { code: "13", label: "Textilvarutillverkning" },
    { code: "14", label: "Tillverkning av kläder" },
    { code: "15", label: "Tillverkning av läder, skinn och skor" },
    { code: "16", label: "Tillverkning av trä och varor av trä (ej möbler)" },
    { code: "17", label: "Pappers- och pappersvarutillverkning" },
    { code: "18", label: "Grafisk produktion och reproduktion" },
    { code: "19", label: "Tillverkning av stenkolsprodukter och raffinerade petroleumprodukter" },
    { code: "20", label: "Tillverkning av kemikalier och kemiska produkter" },
    { code: "21", label: "Tillverkning av farmaceutiska basprodukter och läkemedel" },
    { code: "22", label: "Tillverkning av gummi- och plastvaror" },
    { code: "23", label: "Tillverkning av andra icke-metalliska mineraliska produkter (Glas, Betong)" },
    { code: "24", label: "Stål- och metallframställning" },
    { code: "25", label: "Tillverkning av metallvaror (utom maskiner)" },
    { code: "26", label: "Tillverkning av datorer, elektronik och optik" },
    { code: "27", label: "Tillverkning av elapparatur" },
    { code: "28", label: "Tillverkning av maskiner" },
    { code: "29", label: "Tillverkning av motorfordon och släpfordon" },
    { code: "30", label: "Tillverkning av andra transportmedel" },
    { code: "31", label: "Tillverkning av möbler" },
    { code: "32", label: "Annan tillverkning (Sport, Leksaker, Medicin)" },
    { code: "33", label: "Reparation och installation av maskiner" },

    // --- D & E. ENERGI, VATTEN & AVFALL ---
    { code: "35", label: "Försörjning av el, gas, värme och kyla" },
    { code: "36", label: "Vattenförsörjning" },
    { code: "37", label: "Avloppsrening" },
    { code: "38", label: "Avfallshantering och återvinning" },
    { code: "39", label: "Sanering och efterbehandling" },

    // --- F. BYGGVERKSAMHET ---
    { code: "41", label: "Byggande av house" },
    { code: "42", label: "Anläggning av vägar och nät" },
    { code: "43", label: "Specialiserad bygg- och anläggningsverksamhet (VVS, El, Golv)" },

    // --- G. HANDEL (PARTI & DETALJ) ---
    { code: "45", label: "Handel med och service av motorfordon" },
    { code: "46", label: "Partihandel (Grossister - B2B)" },
    { code: "46.1", label: "Partihandel mot ersättning (Agentur)" },
    { code: "46.2", label: "Partihandel med jordbruksråvaror" },
    { code: "46.3", label: "Partihandel med livsmedel & dryck" },
    { code: "46.4", label: "Partihandel med hushållsvaror (Kläder, El, Kosmetik)" },
    { code: "46.5", label: "Partihandel med datorer & telekom" },
    { code: "46.6", label: "Partihandel med maskiner & utrustning" },
    { code: "46.7", label: "Partihandel med insatsvaror (Bränsle, Metall, Virke, VVS)" },
    { code: "47", label: "Detaljhandel (Butik & E-handel)" },
    { code: "47.91", label: "Postorderhandel och detaljhandel på Internet" },

    // --- H. TRANSPORT & MAGASINERING ---
    { code: "49", label: "Landtransport (Väg & Tåg)" },
    { code: "49.41", label: "Vägtransport, godstrafik" },
    { code: "50", label: "Sjötransport" },
    { code: "51", label: "Lufttransport" },
    { code: "52", label: "Magasinering och stödtjänster till transport" },
    { code: "53", label: "Post- och kurirverksamhet" },

    // --- I. HOTELL & RESTAURANG ---
    { code: "55", label: "Hotell och logi" },
    { code: "56", label: "Restaurang-, catering- och barverksamhet" },

    // --- J. INFORMATION & KOMMUNIKATION ---
    { code: "58", label: "Förlagsverksamhet" },
    { code: "59", label: "Film, video och TV-program" },
    { code: "60", label: "Radio- och TV-sändning" },
    { code: "61", label: "Telekommunikation" },
    { code: "62", label: "Dataprogrammering och IT-konsulter" },
    { code: "63", label: "Informationstjänster (Databehandling, Portaler)" },

    // --- K. FINANS & FÖRSÄKRING ---
    { code: "64", label: "Finansiella tjänster (Bank, Holdingbolag)" },
    { code: "65", label: "Försäkring och pensionsfonders verksamhet" },
    { code: "66", label: "Stödtjänster till finans och försäkring" },

    // --- L. FASTIGHET ---
    { code: "68", label: "Fastighetsverksamhet" },

    // --- M. JURIDIK, EKONOMI, VETENSKAP & TEKNIK ---
    { code: "69", label: "Juridisk och ekonomisk konsultverksamhet" },
    { code: "70", label: "Huvudkontorsverksamhet och organisationskonsulter" },
    { code: "71", label: "Arkitekt- och teknisk konsultverksamhet (Teknik)" },
    { code: "72", label: "Vetenskaplig forskning och utveckling" },
    { code: "73", label: "Reklam och marknadsundersökning" },
    { code: "74", label: "Annan vetenskaplig och teknisk verksamhet (Design, Foto)" },
    { code: "75", label: "Veterinärverksamhet" },

    // --- N. UTHYRNING & FÖRETAGSTJÄNSTER ---
    { code: "77", label: "Uthyrning och leasing" },
    { code: "78", label: "Arbetsförmedling och bemanning" },
    { code: "79", label: "Resebyråer och researrangörer" },
    { code: "80", label: "Säkerhets- och bevakningsverksamhet" },
    { code: "81", label: "Fastighetsservice (Städning, Skötsel)" },
    { code: "82", label: "Kontorstjänster och andra företagstjänster (Callcenter)" },

    // --- O. OFFENTLIG FÖRVALTNING ---
    { code: "84", label: "Offentlig förvaltning och försvar" },

    // --- P. UTBILDNING ---
    { code: "85", label: "Utbildning" },

    // --- Q. VÅRD & OMSORG ---
    { code: "86", label: "Hälso- och sjukvård" },
    { code: "87", label: "Vård och omsorg med boende" },
    { code: "88", label: "Öppna sociala insatser" },

    // --- R. KULTUR, NÖJE & FRITID ---
    { code: "90", label: "Konstnärlig och kulturell verksamhet" },
    { code: "91", label: "Bibliotek, arkiv och museer" },
    { code: "92", label: "Spel- och vadhållningsverksamhet" },
    { code: "93", label: "Sport-, fritids- och nöjesverksamhet" },

    // --- S. ANDRA TJÄNSTER ---
    { code: "94", label: "Intressebevakning (Organisationer)" },
    { code: "95", label: "Reparation av datorer, hushållsartiklar och personliga artiklar" },
    { code: "96", label: "Andra personliga tjänster (Frisör, Tvätt)" },

    // --- T & U. HUSHÅLL & INTERNATIONELLA ORGAN ---
    { code: "97", label: "Förvärvsarbete i hushåll" },
    { code: "99", label: "Internationella organisationer" }
  ];

  // Filter suggestions based on search term
  const filteredSuggestions = SNI_DATABASE.filter(item => 
    item.code.includes(searchTerm) || 
    item.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sync text input when opening
  useEffect(() => {
    if (isOpen) {
      setTextInput(includedKeywords.join('\n'));
    }
  }, [isOpen, includedKeywords]);

  if (!isOpen) return null;

  const handleSave = () => {
    const list = textInput
      .split(/[\n,]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    const uniqueList = Array.from(new Set(list));
    setIncludedKeywords(uniqueList);
    onClose();
  };

  const addSuggestion = (val: string) => {
    const currentList = textInput.split('\n').map(s => s.trim()).filter(Boolean);
    if (!currentList.includes(val)) {
      const newList = [...currentList, val].join('\n');
      setTextInput(newList);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-3xl shadow-2xl border-t-4 border-red-600 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-white p-4 flex justify-between items-center border-b border-slate-200">
          <h2 className="text-lg font-black italic uppercase flex items-center gap-2 text-black">
            <Target className="w-6 h-6 text-red-600" />
            Riktad Sökning (Inkludering)
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-black/10 rounded-full transition-colors">
            <X className="w-5 h-5 text-black" />
          </button>
        </div>

        <div className="flex flex-col md:flex-row h-full overflow-hidden">
          
          {/* Left: Input Area */}
          <div className="w-full md:w-1/3 p-4 flex flex-col border-r border-slate-100 bg-slate-50">
             <div className="bg-green-50 border-l-4 border-green-500 p-3 mb-4">
                <p className="text-xs text-green-800">
                  <strong>Valda Kriterier:</strong> Dessa SNI-koder och sökord är nu <strong>krav</strong> för sökningen.
                </p>
              </div>
              
              <textarea
                className="flex-1 w-full p-3 text-xs border border-slate-300 focus:border-red-600 focus:ring-red-600 rounded-sm font-mono resize-none mb-2"
                placeholder="Exempel:&#10;SNI 47.91&#10;Sportartiklar&#10;SNI 46.73"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
              ></textarea>
              <div className="text-right text-[10px] text-slate-400">
                 En per rad
              </div>
          </div>

          {/* Right: Database Search */}
          <div className="flex-1 p-4 overflow-hidden flex flex-col bg-white">
             <div className="mb-4">
                <h3 className="text-xs font-bold text-slate-700 uppercase mb-2 flex items-center gap-2">
                  Sök i SNI 2007 Databas (Alla Sektorer)
                </h3>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Sök på bransch (t.ex. 'Bygg', 'IT', 'Vård', 'Handel')..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 focus:border-red-600 focus:ring-red-600 rounded-sm"
                  />
                </div>
             </div>

             <div className="flex-1 overflow-y-auto space-y-2 border border-slate-100 p-2 bg-slate-50/50">
               {filteredSuggestions.length === 0 ? (
                 <div className="text-center py-8 text-slate-400 text-xs italic">
                   Inga SNI-koder matchade din sökning.
                 </div>
               ) : (
                 filteredSuggestions.map((item, idx) => {
                   const simpleVal = `SNI ${item.code}`; 
                   const isActive = textInput.includes(item.code);
                   return (
                     <button
                       key={idx}
                       onClick={() => addSuggestion(simpleVal)}
                       disabled={isActive}
                       className={`w-full text-left text-xs px-3 py-2 border rounded-sm flex items-center justify-between group transition-all ${
                         isActive 
                           ? 'bg-green-100 border-green-300 text-green-800 cursor-default' 
                           : 'bg-white border-slate-200 hover:border-red-600 hover:text-red-600 shadow-sm'
                       }`}
                     >
                       <div className="flex flex-col">
                         <span className="font-bold text-slate-900">SNI {item.code}</span>
                         <span className="text-[10px] text-slate-500">{item.label}</span>
                       </div>
                       {isActive ? <Check className="w-3 h-3 text-green-600" /> : <Plus className="w-3 h-3 opacity-0 group-hover:opacity-100 text-red-600" />}
                     </button>
                   );
                 })
               )}
             </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
            <button 
               onClick={() => setTextInput('')}
               className="text-xs text-slate-500 hover:text-red-600 font-bold uppercase"
            >
              Rensa Val
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 bg-red-600 text-white px-6 py-2 text-xs font-bold uppercase tracking-wider hover:bg-red-700 transition-colors shadow-sm"
            >
              <Check className="w-4 h-4" />
              Spara Sökkriterier
            </button>
        </div>
      </div>
    </div>
  );
};