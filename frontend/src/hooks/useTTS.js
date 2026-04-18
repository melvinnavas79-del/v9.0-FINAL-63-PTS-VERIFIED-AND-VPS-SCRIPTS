import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useTTS — hook para texto-a-voz nativo del navegador (Web Speech API).
 * Sin costo externo, sin cuotas, 100% local. Soporta iOS, Android, desktop.
 *
 * Uso:
 *   const { enabled, setEnabled, speak, supported, voice, voices } = useTTS();
 *   speak('Hola mundo');
 */
export default function useTTS(storageKey = 'lluvia_tts_enabled') {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [enabled, setEnabledState] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(storageKey) === '1';
  });
  const [voices, setVoices] = useState([]);
  const [voice, setVoice] = useState(null);
  const queueRef = useRef([]);

  // Load voices (async on some browsers)
  useEffect(() => {
    if (!supported) return;
    const load = () => {
      const list = window.speechSynthesis.getVoices();
      setVoices(list);
      // Prefer Spanish female voice, then any Spanish voice, then default
      const es = list.find(v => /es[-_]/i.test(v.lang) && /female|mujer|mónica|monica|paulina/i.test(v.name))
        || list.find(v => /^es/i.test(v.lang))
        || list[0];
      setVoice(es || null);
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, [supported]);

  const setEnabled = useCallback((v) => {
    setEnabledState(v);
    try { window.localStorage.setItem(storageKey, v ? '1' : '0'); } catch (e) {}
    if (!v && supported) {
      window.speechSynthesis.cancel();
    }
  }, [storageKey, supported]);

  const speak = useCallback((text, opts = {}) => {
    if (!supported || !enabled || !text) return;
    try {
      const u = new window.SpeechSynthesisUtterance(text);
      if (voice) u.voice = voice;
      u.lang = opts.lang || voice?.lang || 'es-ES';
      u.rate = opts.rate ?? 1.05;
      u.pitch = opts.pitch ?? 1.0;
      u.volume = opts.volume ?? 1.0;
      window.speechSynthesis.speak(u);
    } catch (e) { /* silent */ }
  }, [supported, enabled, voice]);

  const stop = useCallback(() => {
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);

  return { supported, enabled, setEnabled, speak, stop, voice, voices };
}
