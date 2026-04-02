
import React, { useRef, useState, useEffect } from 'react';
import { Mail, X, Save, Bold, Italic, List, Info, Paperclip, Plus, Trash2, Wand2, Loader2, Tag, Calendar, Database } from 'lucide-react';
import { generateEmailSuggestion } from '../services/openrouterService';
import { LeadData } from '../types';

interface MailTemplateManagerProps {
  isOpen: boolean;
  onClose: () => void;
  templateSv: string;
  templateEn: string;
  signature: string;
  calendarUrl: string;
  attachments: string[]; 
  focusWords: string[];
  setTemplateSv: (t: string) => void;
  setTemplateEn: (t: string) => void;
  setSignature: (s: string) => void;
  setCalendarUrl: (u: string) => void;
  setAttachments: (a: string[]) => void;
  setFocusWords: (w: string[]) => void;
  activeCarrier: string;
  deepDiveLead: LeadData | null;
}

export const MailTemplateManager: React.FC<MailTemplateManagerProps> = ({
  isOpen, onClose, templateSv, templateEn, signature, calendarUrl, attachments = [], focusWords = [], setTemplateSv, setTemplateEn, setSignature, setCalendarUrl, setAttachments, setFocusWords, activeCarrier, deepDiveLead
}) => {
  const templateRef = useRef<HTMLDivElement>(null);
  const signatureRef = useRef<HTMLDivElement>(null);
  const [newFocusWord, setNewFocusWord] = useState('');
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localCalendarUrl, setLocalCalendarUrl] = useState(calendarUrl);
  const [editLanguage, setEditLanguage] = useState<'sv' | 'en'>('sv');

  useEffect(() => {
    setLocalCalendarUrl(calendarUrl);
  }, [calendarUrl, isOpen]);

  // Update content when language changes or modal opens
  useEffect(() => {
    if (isOpen && templateRef.current) {
      templateRef.current.innerHTML = editLanguage === 'sv' ? templateSv : templateEn;
    }
  }, [editLanguage, isOpen, templateSv, templateEn]);

  if (!isOpen) return null;

  const handleCommand = (cmd: string) => {
    document.execCommand(cmd, false);
    if (templateRef.current) {
      templateRef.current.focus();
    }
  };

  const insertTag = (tag: string) => {
    if (!templateRef.current) return;
    templateRef.current.focus();
    
    const selection = window.getSelection();
    if (!selection) return;

    // If selection is not inside the templateRef, move it to the end
    if (!templateRef.current.contains(selection.anchorNode)) {
      const range = document.createRange();
      range.selectNodeContents(templateRef.current);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    const range = selection.getRangeAt(0);
    range.deleteContents();
    const textNode = document.createTextNode(tag);
    range.insertNode(textNode);
    
    // Move cursor after the inserted tag
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const handleSave = () => {
    if (templateRef.current) {
      if (editLanguage === 'sv') setTemplateSv(templateRef.current.innerHTML);
      else setTemplateEn(templateRef.current.innerHTML);
    }
    if (signatureRef.current) setSignature(signatureRef.current.innerHTML);
    setCalendarUrl(localCalendarUrl);
    onClose();
  };

  const handleAiGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const suggestion = await generateEmailSuggestion(
        'template', 
        deepDiveLead || { companyName: 'Företaget' } as any, 
        focusWords, 
        undefined, 
        activeCarrier,
        editLanguage
      );
      if (templateRef.current) {
        templateRef.current.innerHTML = suggestion;
      }
    } catch (e) {
      setError(editLanguage === 'sv' ? "Kunde inte generera förslag just nu." : "Could not generate suggestion right now.");
    } finally {
      setIsGenerating(false);
    }
  };

  const addFocusWord = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newFocusWord.trim()) {
      if (!focusWords.includes(newFocusWord.trim())) {
        setFocusWords([...focusWords, newFocusWord.trim()]);
      }
      setNewFocusWord('');
    }
  };

  const removeFocusWord = (word: string) => {
    setFocusWords(focusWords.filter(w => w !== word));
  };

  const addAttachment = () => {
    if (newAttachmentUrl.trim()) {
      if (!attachments.includes(newAttachmentUrl.trim())) {
        setAttachments([...attachments, newAttachmentUrl.trim()]);
      }
      setNewAttachmentUrl('');
    }
  };

  const removeAttachment = (url: string) => {
    setAttachments(attachments.filter(a => a !== url));
  };

  const TAGS = [
    { tag: '{fornamn}', desc: 'Kontaktens förnamn' },
    { tag: '{foretag}', desc: 'Företagets namn' },
    { tag: '{potential}', desc: 'Fraktbudget (kr)' },
    { tag: '{pitch}', desc: 'Strategiskt gap' },
    { tag: '{plattform}', desc: 'E-handelssystem' },
    { tag: '{antal_paket}', desc: 'Årliga paket' },
    { tag: '{lagerort}', desc: 'Stad för lagret' },
    { tag: '{active_carrier}', desc: 'Vald bärare' },
    { tag: '{kalender_lank}', desc: 'Din möteslänk' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-3xl shadow-2xl border-t-4 border-red-600 flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-dhl-gray-medium flex justify-between items-center bg-[#ffcc00]">
          <h2 className="text-lg font-black italic uppercase flex items-center gap-2 text-black">
            <Mail className="w-5 h-5 text-red-600" />
            Mailmotor & Inställningar
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-black/10 rounded-full transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="bg-dhl-gray-light p-4 border-l-4 border-dhl-red space-y-2 shadow-sm">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-red-600" />
                  <label className="text-xs font-black uppercase text-red-900 tracking-widest">Min Kalenderlänk</label>
                </div>
                <input 
                  type="url" 
                  value={localCalendarUrl}
                  onChange={(e) => setLocalCalendarUrl(e.target.value)}
                  placeholder="https://outlook.office365.com/..."
                  className="w-full p-2 text-xs border border-dhl-gray-medium rounded-sm focus:ring-1 focus:ring-red-500 outline-none"
                />
             </div>
             
             <div className="bg-dhl-gray-light p-4 border border-dhl-gray-medium space-y-2 shadow-sm">
                <div className="flex items-center gap-3 mb-1">
                  <Database className="w-5 h-5 text-dhl-gray-dark" />
                  <label className="text-xs font-black uppercase text-dhl-black tracking-widest">Dynamiska Taggar</label>
                </div>
                <div className="grid grid-cols-3 gap-1">
                   {TAGS.map(t => (
                     <button 
                       key={t.tag} 
                       onClick={() => insertTag(t.tag)}
                       className="group relative block w-full"
                     >
                        <span className="block bg-white border border-dhl-gray-medium text-[8px] font-bold text-red-600 p-1 rounded-sm text-center truncate hover:border-red-600 hover:bg-dhl-gray-light transition-colors">
                          {t.tag}
                        </span>
                        <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block bg-dhl-black text-white text-[8px] p-1 rounded whitespace-nowrap z-50">
                          {t.desc} (Klicka för att infoga)
                        </div>
                     </button>
                   ))}
                </div>
             </div>
          </div>

          <div>
            {error && (
              <div className="mb-4 p-3 bg-dhl-gray-light border-l-4 border-dhl-red text-red-700 text-xs flex justify-between items-center">
                <span>{error}</span>
                <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
              </div>
            )}

            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-4">
                <label className="block text-xs font-black uppercase text-slate-500 tracking-widest">Huvudmall</label>
                <div className="flex gap-1">
                  <button 
                    onClick={() => {
                      if (templateRef.current) {
                        if (editLanguage === 'sv') setTemplateSv(templateRef.current.innerHTML);
                        else setTemplateEn(templateRef.current.innerHTML);
                      }
                      setEditLanguage('sv');
                    }}
                    className={`px-2 py-0.5 text-[8px] font-black uppercase rounded-sm border ${editLanguage === 'sv' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-500 border-dhl-gray-medium'}`}
                  >
                    SV
                  </button>
                  <button 
                    onClick={() => {
                      if (templateRef.current) {
                        if (editLanguage === 'sv') setTemplateSv(templateRef.current.innerHTML);
                        else setTemplateEn(templateRef.current.innerHTML);
                      }
                      setEditLanguage('en');
                    }}
                    className={`px-2 py-0.5 text-[8px] font-black uppercase rounded-sm border ${editLanguage === 'en' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-500 border-dhl-gray-medium'}`}
                  >
                    EN
                  </button>
                </div>
              </div>
              <button onClick={handleAiGenerate} disabled={isGenerating} className="text-red-600 hover:text-red-800 text-[10px] font-black uppercase flex items-center gap-1">
                {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />} {deepDiveLead ? `Skapa personlig pitch för ${deepDiveLead.companyName}` : 'Generera ny mall med AI'}
              </button>
            </div>
            
            <div className="border border-dhl-gray-medium rounded-sm bg-dhl-gray-light overflow-hidden shadow-inner">
               <div className="flex gap-1 p-2 border-b border-dhl-gray-medium bg-white">
                  <button onClick={() => handleCommand('bold')} className="p-1 hover:bg-dhl-gray-medium rounded"><Bold className="w-4 h-4" /></button>
                  <button onClick={() => handleCommand('italic')} className="p-1 hover:bg-dhl-gray-medium rounded"><Italic className="w-4 h-4" /></button>
                  <button onClick={() => handleCommand('insertUnorderedList')} className="p-1 hover:bg-dhl-gray-medium rounded"><List className="w-4 h-4" /></button>
               </div>
               <div ref={templateRef} contentEditable className="p-4 min-h-[150px] outline-none text-sm bg-white font-sans leading-relaxed" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase text-slate-500 mb-2 flex items-center gap-2 tracking-widest">
              <Paperclip className="w-3 h-3 text-red-600" /> Bilagor (PDF/Länkar)
            </label>
            <div className="border border-dhl-gray-medium rounded-sm p-3 bg-dhl-gray-light shadow-inner">
              <div className="space-y-2 mb-3">
                {attachments.map((url, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-white p-2 border border-dhl-gray-medium rounded-sm shadow-sm">
                    <span className="text-[10px] truncate max-w-[90%] text-dhl-gray-dark">{url}</span>
                    <button onClick={() => removeAttachment(url)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {attachments.length === 0 && (
                  <div className="text-[10px] text-slate-400 italic">Inga bilagor tillagda än.</div>
                )}
              </div>
              <div className="flex gap-2">
                <input 
                  type="url" 
                  value={newAttachmentUrl} 
                  onChange={(e) => setNewAttachmentUrl(e.target.value)} 
                  placeholder="Klistra in länk till PDF/prospekt..." 
                  className="flex-1 text-xs border-dhl-gray-medium rounded-sm p-2 shadow-sm" 
                />
                <button 
                  onClick={addAttachment}
                  className="bg-dhl-black text-white p-2 rounded-sm hover:bg-dhl-black transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase text-slate-500 mb-2 flex items-center gap-2 tracking-widest"><Tag className="w-3 h-3 text-red-600" /> Strategiska Fokusord</label>
            <div className="border border-dhl-gray-medium rounded-sm p-3 bg-dhl-gray-light shadow-inner">
              <div className="flex flex-wrap gap-2 mb-3">
                {focusWords.map((word, idx) => (
                  <span key={idx} className="bg-red-600 text-white text-[10px] font-black uppercase px-2 py-1 rounded-full flex items-center gap-1 shadow-sm">
                    {word} <button onClick={() => removeFocusWord(word)}><X className="w-2.5 h-2.5" /></button>
                  </span>
                ))}
              </div>
              <input type="text" value={newFocusWord} onChange={(e) => setNewFocusWord(e.target.value)} onKeyDown={addFocusWord} placeholder="Lägg till ord (t.ex. Paketskåp, Klimatsmart)..." className="w-full text-xs border-dhl-gray-medium rounded-sm p-2 shadow-sm" />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-black uppercase text-slate-500 mb-2 tracking-widest">Signatur</label>
            <div className="border border-dhl-gray-medium rounded-sm bg-white shadow-inner">
               <div ref={signatureRef} contentEditable className="p-4 min-h-[80px] outline-none text-sm font-sans" dangerouslySetInnerHTML={{ __html: signature }} />
            </div>
          </div>
        </div>

        <div className="p-4 bg-dhl-gray-light border-t border-dhl-gray-medium flex justify-end">
          <button onClick={handleSave} className="bg-red-600 text-white px-8 py-2.5 text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-red-700 transition-all shadow-md">
            <Save className="w-4 h-4" /> Spara inställningar
          </button>
        </div>
      </div>
    </div>
  );
};


