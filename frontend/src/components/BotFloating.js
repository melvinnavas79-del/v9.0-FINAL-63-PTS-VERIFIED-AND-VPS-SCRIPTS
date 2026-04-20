import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const BotFloating = ({ userId, userRole }) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    const saved = localStorage.getItem('bot_voice_enabled');
    return saved === null ? false : saved === 'true';
  });
  const [voiceUnlocked, setVoiceUnlocked] = useState(false);
  const [showVoicePanel, setShowVoicePanel] = useState(false);
  const [voiceMode, setVoiceMode] = useState(localStorage.getItem('bot_voice') || 'mujer');
  const [availableVoices, setAvailableVoices] = useState([]);
  const chatRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  // Init Speech Recognition
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      const recog = new SR();
      recog.lang = 'es-ES';
      recog.continuous = true;
      recog.interimResults = false;
      recog.onresult = (e) => {
        const text = e.results[e.results.length - 1][0].transcript;
        setListening(false);
        handleSend(text);
      };
      recog.onerror = (ev) => { if (ev.error !== 'no-speech') setListening(false); };
      recog.onend = () => {
        // Auto restart if in continuous mode
        if (recognitionRef.current?._keepListening) {
          try { recognitionRef.current.start(); } catch(e) {}
        } else { setListening(false); }
      };
      recognitionRef.current = recog;
    }
  }, []);

  // Load voices and find best ones
  useEffect(() => {
    const loadVoices = () => {
      if (!window.speechSynthesis) return;
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) setAvailableVoices(voices);
    };
    loadVoices();
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  if (userRole !== 'dueño') return null;

  // Find the best voice for a given profile
  const findBestVoice = (profile) => {
    const voices = availableVoices.length > 0 ? availableVoices : (window.speechSynthesis?.getVoices() || []);
    const esVoices = voices.filter(v => v.lang.startsWith('es'));
    // Preference: Google > Microsoft > Apple > Default
    const googleVoices = esVoices.filter(v => v.name.includes('Google'));
    const msVoices = esVoices.filter(v => v.name.includes('Microsoft'));
    const premiumVoices = [...googleVoices, ...msVoices];
    
    switch(profile) {
      case 'mujer': {
        // Look for female voice names
        const femaleKeywords = ['female', 'mujer', 'Lucia', 'Elena', 'Conchita', 'Penelope', 'Lupe', 'Miren', 'femenin'];
        const femaleVoice = premiumVoices.find(v => femaleKeywords.some(k => v.name.toLowerCase().includes(k.toLowerCase())));
        return femaleVoice || premiumVoices.find(v => v.lang === 'es-ES') || esVoices[0] || null;
      }
      case 'hombre': {
        const maleKeywords = ['male', 'hombre', 'Enrique', 'Jorge', 'Pablo', 'Diego', 'Andres', 'masculin'];
        const maleVoice = premiumVoices.find(v => maleKeywords.some(k => v.name.toLowerCase().includes(k.toLowerCase())));
        return maleVoice || premiumVoices.find(v => v.lang === 'es-MX') || esVoices[1] || esVoices[0] || null;
      }
      case 'animador': {
        return premiumVoices.find(v => v.lang === 'es-MX') || esVoices.find(v => v.lang === 'es-MX') || premiumVoices[0] || esVoices[0] || null;
      }
      case 'serio': {
        return premiumVoices.find(v => v.lang === 'es-ES') || esVoices.find(v => v.lang === 'es-ES') || premiumVoices[0] || esVoices[0] || null;
      }
      default: return premiumVoices[0] || esVoices[0] || null;
    }
  };

  // Unlock iOS audio with user gesture
  const unlockVoice = () => {
    if (voiceUnlocked) return;
    if (window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance('');
      u.volume = 0;
      window.speechSynthesis.speak(u);
      setVoiceUnlocked(true);
    }
  };

  const speakText = (text) => {
    if (!voiceEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    const voiceConfigs = {
      hombre:   { pitch: 0.85, rate: 1.0, volume: 1.0 },
      mujer:    { pitch: 1.2,  rate: 1.0, volume: 1.0 },
      animador: { pitch: 1.05, rate: 1.2, volume: 1.0 },
      serio:    { pitch: 0.7,  rate: 0.9, volume: 1.0 },
    };
    const cfg = voiceConfigs[voiceMode] || voiceConfigs.mujer;
    utterance.pitch = cfg.pitch;
    utterance.rate = cfg.rate;
    utterance.volume = cfg.volume;
    
    const bestVoice = findBestVoice(voiceMode);
    if (bestVoice) {
      utterance.voice = bestVoice;
      utterance.lang = bestVoice.lang;
    } else {
      utterance.lang = voiceMode === 'animador' ? 'es-MX' : 'es-ES';
    }
    
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const previewVoice = (mode) => {
    const previews = {
      hombre: 'Hola, soy tu asistente con voz masculina.',
      mujer: 'Hola, soy tu asistente con voz femenina.',
      animador: 'Buenas noches a todos! Bienvenidos a Lluvia Live!',
      serio: 'Bienvenidos. Soy el administrador de esta sala.',
    };
    const oldMode = voiceMode;
    setVoiceMode(mode);
    localStorage.setItem('bot_voice', mode);
    // Need to speak with the new mode
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(previews[mode]);
    const voiceConfigs = {
      hombre:   { pitch: 0.85, rate: 1.0 },
      mujer:    { pitch: 1.2,  rate: 1.0 },
      animador: { pitch: 1.05, rate: 1.2 },
      serio:    { pitch: 0.7,  rate: 0.9 },
    };
    const cfg = voiceConfigs[mode];
    utterance.pitch = cfg.pitch;
    utterance.rate = cfg.rate;
    utterance.volume = 1.0;
    const bestVoice = findBestVoice(mode);
    if (bestVoice) { utterance.voice = bestVoice; utterance.lang = bestVoice.lang; }
    else { utterance.lang = 'es-ES'; }
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const handleSend = async (text) => {
    if (!text || !text.trim() || loading) return;
    const msg = text.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setLoading(true);
    try {
      const res = await axios.post(`${API}/bot/command`, { admin_id: userId, message: msg });
      const botReply = res.data.response || 'Sin respuesta';
      const action = res.data.action_result;
      setMessages(prev => [...prev, { role: 'bot', text: botReply, action }]);
      speakText(botReply + (action ? `. Accion ejecutada: ${action}` : ''));
    } catch (err) {
      const errMsg = 'Error al conectar con el Bot';
      setMessages(prev => [...prev, { role: 'bot', text: errMsg }]);
    }
    setLoading(false);
  };

  const startListening = () => {
    unlockVoice();
    if (recognitionRef.current && !listening) {
      try {
        window.speechSynthesis.cancel();
        setSpeaking(false);
        recognitionRef.current._keepListening = true;
        recognitionRef.current.start();
        setListening(true);
      } catch (e) { /* silent */ }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current._keepListening = false;
      recognitionRef.current.stop();
      setListening(false);
    }
  };

  const handleOpen = () => {
    unlockVoice();
    setOpen(true);
  };

  return (
    <>
      {!open && (
        <button data-testid="bot-floating-btn" onClick={handleOpen}
          className="fixed bottom-20 right-4 z-40 w-14 h-14 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full shadow-xl shadow-purple-500/30 flex items-center justify-center text-2xl active:scale-90 transition-transform border-2 border-white/20">
          🤖
        </button>
      )}

      {open && (
        <div className="fixed bottom-16 right-3 left-3 z-50 max-w-md ml-auto" style={{maxHeight: '70vh'}}>
          <div className="bg-gray-900 rounded-2xl border border-purple-500/30 shadow-2xl flex flex-col" style={{height: '420px'}}>
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-gray-700 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xl">{speaking ? '🔊' : '🤖'}</span>
                <div>
                  <div className="text-white font-bold text-sm">Bot Lluvia Live</div>
                  <div className={`text-[10px] ${listening ? 'text-red-400' : speaking ? 'text-yellow-400' : 'text-green-400'}`}>
                    {listening ? '🎙️ Escuchando...' : speaking ? '🔊 Hablando...' : `Voz: ${voiceMode}`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button data-testid="bot-voice-select" onClick={() => { unlockVoice(); setShowVoicePanel(!showVoicePanel); }}
                  className="text-[10px] px-2 py-1 rounded-full bg-purple-700 text-white">
                  {voiceMode === 'mujer' ? '👩' : voiceMode === 'hombre' ? '👨' : voiceMode === 'animador' ? '🎙️' : '🎩'}
                </button>
                <button data-testid="bot-voice-toggle" onClick={() => { 
                  unlockVoice(); 
                  const newVal = !voiceEnabled;
                  setVoiceEnabled(newVal); 
                  localStorage.setItem('bot_voice_enabled', String(newVal));
                  if (!newVal) window.speechSynthesis?.cancel();
                }}
                  className={`text-xs px-2 py-1 rounded-full ${voiceEnabled ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-400'}`}>
                  {voiceEnabled ? '🔊' : '🔇'}
                </button>
                <button data-testid="bot-close-btn" onClick={() => { window.speechSynthesis?.cancel(); setOpen(false); setShowVoicePanel(false); }} className="text-white/50 hover:text-white text-lg">✕</button>
              </div>
            </div>

            {/* Voice Selector Panel */}
            {showVoicePanel && (
              <div className="p-3 border-b border-gray-700 bg-gray-800/80 flex-shrink-0">
                <div className="text-[10px] text-white/50 mb-2 font-bold">SELECCIONAR VOZ</div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'mujer', label: 'Mujer', icon: '👩', desc: 'Voz femenina' },
                    { id: 'hombre', label: 'Hombre', icon: '👨', desc: 'Voz masculina' },
                    { id: 'animador', label: 'Animador', icon: '🎙️', desc: 'Energetico' },
                    { id: 'serio', label: 'Serio', icon: '🎩', desc: 'Formal' },
                  ].map(v => (
                    <button key={v.id} onClick={() => previewVoice(v.id)}
                      className={`p-2 rounded-xl text-center transition-all ${
                        voiceMode === v.id ? 'bg-purple-600 text-white ring-2 ring-purple-400' : 'bg-gray-700 text-white/60 hover:bg-gray-600'
                      }`}>
                      <div className="text-lg">{v.icon}</div>
                      <div className="text-[9px] font-bold">{v.label}</div>
                    </button>
                  ))}
                </div>
                <div className="text-[9px] text-white/30 mt-2 text-center">Toca para escuchar una muestra</div>
              </div>
            )}

            {/* Messages */}
            <div ref={chatRef} className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
              {messages.length === 0 && (
                <div className="text-center text-white/30 py-6">
                  <div className="text-3xl mb-2">🤖</div>
                  <p className="text-xs mb-1">Habla o escribe</p>
                  <p className="text-[10px] text-white/20">Toca el microfono para hablarme por voz</p>
                  <div className="flex flex-wrap gap-1 mt-3 justify-center">
                    {['¿Cuantos usuarios hay?', 'Di hola en mi sala', 'Vigila mi sala por insultos', '¿Quien esta en las salas?'].map(q => (
                      <button key={q} onClick={() => handleSend(q)} className="bg-white/10 text-white/60 text-[10px] px-2 py-1 rounded-full hover:bg-white/20">{q}</button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs ${
                    m.role === 'user' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-white/90'
                  }`}>
                    {m.role === 'bot' && <span className="text-[10px] text-purple-400 block mb-0.5">🤖 Bot:</span>}
                    {m.text}
                    {m.action && <div className="mt-1 bg-green-500/20 text-green-400 text-[10px] px-2 py-1 rounded-lg">✅ {m.action}</div>}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-800 rounded-2xl px-3 py-2 text-xs text-white/50">🤖 Pensando...</div>
                </div>
              )}
            </div>

            {/* Input with Voice */}
            <div className="p-3 border-t border-gray-700 flex-shrink-0">
              <div className="flex gap-2 items-center">
                <button data-testid="bot-mic-btn" onClick={listening ? stopListening : startListening}
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0 active:scale-90 transition-all ${
                    listening ? 'bg-red-500 shadow-lg shadow-red-500/50 animate-pulse' : 'bg-gray-700 hover:bg-gray-600'
                  }`}>
                  {listening ? '⏹️' : '🎙️'}
                </button>
                <input type="text" value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend(input)}
                  placeholder={listening ? 'Escuchando...' : 'Escribe o habla...'}
                  data-testid="bot-input"
                  className="flex-1 bg-gray-800 text-white placeholder-white/30 border border-gray-700 rounded-full px-3 py-2 text-xs outline-none focus:border-purple-500" />
                <button data-testid="bot-send-btn" onClick={() => handleSend(input)} disabled={loading || !input.trim()}
                  className="bg-purple-600 text-white px-3 py-2 rounded-full text-xs font-bold disabled:opacity-50">
                  Enviar
                </button>
              </div>
              {listening && (
                <div className="text-center mt-2">
                  <span className="text-red-400 text-[10px] animate-pulse">🔴 Habla ahora... toca para parar</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BotFloating;
