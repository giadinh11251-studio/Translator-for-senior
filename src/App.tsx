/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Volume2, 
  Mic, 
  Languages, 
  Plane, 
  MapPin, 
  HeartPulse, 
  Utensils, 
  Search, 
  X, 
  ArrowRight,
  History,
  Info,
  ArrowLeftRight,
  Loader2,
  ChevronDown,
  Check
} from 'lucide-react';
import { translateText, generateSpeech, SUPPORTED_LANGUAGES } from './lib/gemini';

const COMMON_PHRASES = [
  { id: 1, vi: "Tôi cần giúp đỡ", category: "Khẩn cấp", icon: Info },
  { id: 2, vi: "Nhà vệ sinh ở đâu?", category: "Du lịch", icon: MapPin },
  { id: 3, vi: "Tôi bị lạc đường", category: "Khẩn cấp", icon: MapPin },
  { id: 4, vi: "Tôi cần bác sĩ", category: "Khẩn cấp", icon: HeartPulse },
  { id: 5, vi: "Giá bao nhiêu?", category: "Mua sắm", icon: Utensils },
  { id: 6, vi: "Cho tôi xem thực đơn", category: "Ăn uống", icon: Utensils },
  { id: 7, vi: "Tôi không hiểu", category: "Giao tiếp", icon: Languages },
  { id: 8, vi: "Làm ơn nói chậm lại", category: "Giao tiếp", icon: Languages },
];

export default function App() {
  const [inputText, setInputText] = useState('');
  const [translation, setTranslation] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeTab, setActiveTab] = useState<'translate' | 'phrases'>('translate');
  
  const [fromLang, setFromLang] = useState('vi-VN');
  const [toLang, setToLang] = useState('en-US');
  const [showFromSelector, setShowFromSelector] = useState(false);
  const [showToSelector, setShowToSelector] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = fromLang;

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
        setIsListening(false);
        handleTranslate(transcript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, [fromLang]);

  const handleTranslate = async (text: string = inputText) => {
    if (!text.trim()) return;
    setIsTranslating(true);
    const result = await translateText(text, fromLang, toLang);
    setTranslation(result);
    setIsTranslating(false);
  };

  const speak = async (text: string, langCode: string) => {
    if (!text || isSpeaking) return;
    
    setIsSpeaking(true);
    try {
      const base64Audio = await generateSpeech(text, langCode);
      
      if (base64Audio) {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        
        const audioCtx = audioContextRef.current;
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }

        const binaryString = atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Ensure we have an even number of bytes for Int16Array
        const buffer = bytes.buffer;
        const alignedLength = Math.floor(buffer.byteLength / 2) * 2;
        const pcmData = new Int16Array(buffer.slice(0, alignedLength));
        
        const floatData = new Float32Array(pcmData.length);
        for (let i = 0; i < pcmData.length; i++) {
          floatData[i] = pcmData[i] / 32768.0;
        }
        
        const audioBuffer = audioCtx.createBuffer(1, floatData.length, 24000);
        audioBuffer.getChannelData(0).set(floatData);
        
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        source.onended = () => setIsSpeaking(false);
        source.start(0);
      } else {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = langCode;
        
        // Try to find a matching voice for the fallback
        const voices = window.speechSynthesis.getVoices();
        const matchingVoice = voices.find(v => v.lang.toLowerCase().includes(langCode.toLowerCase().split('-')[0]));
        if (matchingVoice) utterance.voice = matchingVoice;
        
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
      }
    } catch (error) {
      console.error("Playback error:", error);
      setIsSpeaking(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setTranslation('');
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
      }
    }
  };

  const swapLanguages = () => {
    const temp = fromLang;
    setFromLang(toLang);
    setToLang(temp);
    setInputText(translation);
    setTranslation('');
  };

  const LanguageSelector = ({ 
    selected, 
    onSelect, 
    onClose, 
    title 
  }: { 
    selected: string, 
    onSelect: (code: string) => void, 
    onClose: () => void,
    title: string
  }) => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div 
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        exit={{ y: 100 }}
        className="bg-white w-full max-w-md rounded-t-[40px] sm:rounded-[40px] p-8 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full">
            <X className="w-6 h-6 text-slate-500" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => { onSelect(lang.code); onClose(); }}
              className={`flex items-center justify-between p-5 rounded-2xl text-xl font-bold transition-all ${
                selected === lang.code 
                  ? 'bg-blue-600 text-white shadow-lg' 
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span>{lang.name}</span>
              {selected === lang.code && <Check className="w-6 h-6" />}
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );

  return (
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto bg-slate-50 shadow-2xl font-sans relative overflow-hidden">
      {/* Header */}
      <header className="bg-blue-600 text-white p-8 rounded-b-[40px] shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-4xl font-extrabold flex items-center gap-3">
            <Plane className="w-10 h-10" />
            Travel Talk
          </h1>
          <div className="bg-blue-500/50 backdrop-blur-md px-4 py-1.5 rounded-full text-sm font-bold border border-blue-400/30 uppercase">
            {SUPPORTED_LANGUAGES.find(l => l.code === fromLang)?.label} ⇄ {SUPPORTED_LANGUAGES.find(l => l.code === toLang)?.label}
          </div>
        </div>

        {/* Language Selection Bar */}
        <div className="flex items-center gap-3 bg-white/10 p-2 rounded-3xl border border-white/20">
          <button 
            onClick={() => setShowFromSelector(true)}
            className="flex-1 bg-white/20 hover:bg-white/30 p-4 rounded-2xl flex items-center justify-between transition-all"
          >
            <span className="font-bold text-lg truncate">{SUPPORTED_LANGUAGES.find(l => l.code === fromLang)?.name}</span>
            <ChevronDown className="w-5 h-5 opacity-60" />
          </button>
          
          <button 
            onClick={swapLanguages}
            className="p-4 bg-white text-blue-600 rounded-2xl shadow-lg active:rotate-180 transition-transform duration-500"
          >
            <ArrowLeftRight className="w-6 h-6" />
          </button>

          <button 
            onClick={() => setShowToSelector(true)}
            className="flex-1 bg-white/20 hover:bg-white/30 p-4 rounded-2xl flex items-center justify-between transition-all"
          >
            <span className="font-bold text-lg truncate">{SUPPORTED_LANGUAGES.find(l => l.code === toLang)?.name}</span>
            <ChevronDown className="w-5 h-5 opacity-60" />
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="flex p-5 gap-4">
        <button 
          onClick={() => setActiveTab('translate')}
          className={`flex-1 py-5 rounded-3xl font-bold text-2xl flex items-center justify-center gap-3 transition-all duration-300 ${
            activeTab === 'translate' 
              ? 'bg-blue-600 text-white shadow-lg scale-[1.02]' 
              : 'bg-white text-slate-500 hover:bg-slate-100'
          }`}
        >
          <Languages className="w-7 h-7" />
          Dịch
        </button>
        <button 
          onClick={() => setActiveTab('phrases')}
          className={`flex-1 py-5 rounded-3xl font-bold text-2xl flex items-center justify-center gap-3 transition-all duration-300 ${
            activeTab === 'phrases' 
              ? 'bg-blue-600 text-white shadow-lg scale-[1.02]' 
              : 'bg-white text-slate-500 hover:bg-slate-100'
          }`}
        >
          <History className="w-7 h-7" />
          Mẫu câu
        </button>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-5 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'translate' ? (
            <motion.div 
              key="translate"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              className="space-y-8"
            >
              {/* Input Area */}
              <div className="senior-card space-y-5">
                <div className="flex items-center justify-between">
                  <label className="text-slate-600 font-bold text-xl">
                    Nhập {SUPPORTED_LANGUAGES.find(l => l.code === fromLang)?.name}:
                  </label>
                  {inputText && (
                    <button 
                      onClick={() => { setInputText(''); setTranslation(''); }}
                      className="text-blue-600 font-bold text-lg"
                    >
                      Xóa hết
                    </button>
                  )}
                </div>
                <div className="relative">
                  <textarea 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Nhấn nút 'Nói' hoặc gõ vào đây..."
                    className="senior-input min-h-[180px] resize-none leading-relaxed"
                  />
                </div>
                
                <div className="flex gap-4">
                  <button 
                    onClick={toggleListening}
                    className={`flex-1 senior-btn border-2 ${
                      isListening 
                        ? 'bg-red-500 text-white border-red-600 animate-pulse' 
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Mic className="w-9 h-9" />
                    {isListening ? 'Đang nghe' : 'Nói'}
                  </button>
                  <button 
                    onClick={() => handleTranslate()}
                    disabled={isTranslating || !inputText.trim()}
                    className="flex-[2] senior-btn bg-blue-600 text-white disabled:opacity-50 shadow-blue-200"
                  >
                    {isTranslating ? (
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 border-4 border-white border-t-transparent rounded-full animate-spin" />
                        Đang dịch
                      </div>
                    ) : (
                      <>
                        <ArrowRight className="w-9 h-9" />
                        Dịch Ngay
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Translation Result */}
              {translation && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="senior-card bg-blue-600 text-white border-none shadow-2xl shadow-blue-200"
                >
                  <div className="flex items-center justify-between mb-6">
                    <span className="bg-white/20 px-4 py-1 rounded-full text-sm font-bold uppercase tracking-widest">
                      {SUPPORTED_LANGUAGES.find(l => l.code === toLang)?.name}
                    </span>
                    <button 
                      onClick={() => speak(translation, toLang)}
                      disabled={isSpeaking}
                      className="p-5 bg-white text-blue-600 rounded-3xl shadow-xl active:scale-90 transition-all disabled:opacity-50"
                    >
                      {isSpeaking ? (
                        <Loader2 className="w-10 h-10 animate-spin" />
                      ) : (
                        <Volume2 className="w-10 h-10" />
                      )}
                    </button>
                  </div>
                  <p className="text-4xl font-bold leading-tight mb-8">
                    {translation}
                  </p>
                  <button 
                    onClick={() => speak(translation, toLang)}
                    disabled={isSpeaking}
                    className="w-full py-5 bg-white/10 hover:bg-white/20 border-2 border-white/30 rounded-3xl text-white font-bold text-2xl flex items-center justify-center gap-3 transition-colors disabled:opacity-50"
                  >
                    {isSpeaking ? (
                      <Loader2 className="w-8 h-8 animate-spin" />
                    ) : (
                      <Volume2 className="w-8 h-8" />
                    )}
                    Đọc to
                  </button>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="phrases"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              className="grid grid-cols-1 gap-5 pb-10"
            >
              <div className="text-slate-400 font-bold text-lg px-2 mb-2 uppercase tracking-widest">Mẫu câu tiếng Việt</div>
              {COMMON_PHRASES.map((phrase) => (
                <button 
                  key={phrase.id}
                  onClick={async () => {
                    setFromLang('vi-VN');
                    setInputText(phrase.vi);
                    setActiveTab('translate');
                    setIsTranslating(true);
                    const result = await translateText(phrase.vi, 'vi-VN', toLang);
                    setTranslation(result);
                    setIsTranslating(false);
                    setTimeout(() => speak(result, toLang), 500);
                  }}
                  className="senior-card text-left hover:border-blue-400 hover:shadow-xl transition-all duration-300 group active:scale-[0.98]"
                >
                  <div className="flex items-center gap-5">
                    <div className="p-4 bg-blue-50 rounded-3xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <phrase.icon className="w-9 h-9" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-blue-500 uppercase mb-1 group-hover:text-blue-600">{phrase.category}</div>
                      <div className="text-2xl font-bold text-slate-800 mb-1">{phrase.vi}</div>
                      <div className="text-xl text-slate-400 italic">Dịch sang {SUPPORTED_LANGUAGES.find(l => l.code === toLang)?.name}</div>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-full text-slate-300 group-hover:text-blue-400 transition-colors">
                      <ArrowRight className="w-7 h-7" />
                    </div>
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Language Selectors */}
      <AnimatePresence>
        {showFromSelector && (
          <LanguageSelector 
            title="Dịch từ ngôn ngữ:"
            selected={fromLang}
            onSelect={setFromLang}
            onClose={() => setShowFromSelector(false)}
          />
        )}
        {showToSelector && (
          <LanguageSelector 
            title="Dịch sang ngôn ngữ:"
            selected={toLang}
            onSelect={setToLang}
            onClose={() => setShowToSelector(false)}
          />
        )}
      </AnimatePresence>

      {/* Footer Info */}
      <footer className="p-8 text-center bg-white border-t border-slate-100">
        <div className="flex items-center justify-center gap-3 text-slate-400 text-xl font-medium">
          <Info className="w-6 h-6 text-blue-400" />
          Nhấn nút loa để máy đọc to kết quả
        </div>
      </footer>
    </div>
  );
}
