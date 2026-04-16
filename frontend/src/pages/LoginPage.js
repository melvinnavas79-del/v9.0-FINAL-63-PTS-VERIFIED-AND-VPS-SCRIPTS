import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useUser } from '../contexts/UserContext';
import { auth, googleProvider, RecaptchaVerifier, signInWithPhoneNumber, signInWithPopup } from '../lib/firebase';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Simple device fingerprint
const getDeviceId = () => {
  let id = localStorage.getItem('lluvia_device_id');
  if (!id) {
    id = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('lluvia_device_id', id);
  }
  return id;
};

const LoginPage = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState('');
  const [authMode, setAuthMode] = useState('main'); // main, phone
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmResult, setConfirmResult] = useState(null);
  const { login } = useUser();
  const recaptchaRef = useRef(null);

  useEffect(() => {
    // Cleanup recaptcha on unmount
    return () => {
      if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch(e) {}
        window.recaptchaVerifier = null;
      }
    };
  }, []);

  const sendToBackend = async (idToken) => {
    const device_id = getDeviceId();
    const res = await axios.post(`${API}/auth/firebase`, { id_token: idToken, device_id });
    if (res.data.success) {
      login(res.data.user);
      onLogin();
    }
  };

  // Google Sign-In
  const handleGoogle = async () => {
    setError('');
    setLoading('google');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      await sendToBackend(idToken);
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Login cancelado');
      } else if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Error con Google. Intenta de nuevo.');
      }
    }
    setLoading('');
  };

  // Phone: Send OTP
  const handleSendOTP = async () => {
    if (!phone || phone.length < 8) {
      setError('Ingresa un numero valido con codigo de pais (ej: +1234567890)');
      return;
    }
    setError('');
    setLoading('phone');
    try {
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaRef.current, {
          size: 'invisible',
          callback: () => {},
        });
      }
      const confirmation = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
      setConfirmResult(confirmation);
      setError('');
    } catch (err) {
      if (err.code === 'auth/invalid-phone-number') {
        setError('Numero invalido. Usa formato internacional: +52XXXXXXXXXX');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Demasiados intentos. Espera unos minutos.');
      } else {
        setError('Error al enviar codigo. Verifica el numero.');
      }
      // Reset recaptcha
      if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch(e) {}
        window.recaptchaVerifier = null;
      }
    }
    setLoading('');
  };

  // Phone: Verify OTP
  const handleVerifyOTP = async () => {
    if (!otp || otp.length < 4) {
      setError('Ingresa el codigo de 6 digitos');
      return;
    }
    setError('');
    setLoading('verify');
    try {
      const result = await confirmResult.confirm(otp);
      const idToken = await result.user.getIdToken();
      await sendToBackend(idToken);
    } catch (err) {
      if (err.code === 'auth/invalid-verification-code') {
        setError('Codigo incorrecto');
      } else if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Error al verificar. Intenta de nuevo.');
      }
    }
    setLoading('');
  };

  // Username/Password login
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading('password');
    try {
      const endpoint = isRegister ? '/register' : '/login';
      const res = await axios.post(`${API}${endpoint}`, { username, password });
      if (res.data.success) {
        login(res.data.user);
        onLogin();
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al conectar');
    }
    setLoading('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 via-purple-900 to-blue-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-28 h-28 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-full flex items-center justify-center shadow-2xl shadow-cyan-500/30">
              <span className="text-6xl">☔</span>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2" style={{textShadow: '0 0 30px rgba(236,72,153,0.5)'}}>Lluvia Live</h1>
          <p className="text-gray-300 text-lg">Conecta, Chatea, Vive</p>
        </div>

        {/* MAIN AUTH VIEW */}
        {authMode === 'main' && (
          <div className="space-y-4">
            {/* Google Button */}
            <button
              onClick={handleGoogle}
              disabled={!!loading}
              data-testid="google-login-btn"
              className="w-full bg-white text-gray-800 py-4 rounded-full text-lg font-bold flex items-center justify-center gap-3 hover:bg-gray-100 transition-all disabled:opacity-50 shadow-lg"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              {loading === 'google' ? 'Conectando...' : 'Continuar con Google'}
            </button>

            {/* Phone Button */}
            <button
              onClick={() => { setAuthMode('phone'); setError(''); }}
              data-testid="phone-login-btn"
              className="w-full bg-green-600 text-white py-4 rounded-full text-lg font-bold flex items-center justify-center gap-3 hover:bg-green-700 transition-all shadow-lg"
            >
              <span className="text-2xl">📱</span>
              Verificar con Telefono
            </button>

            {/* Divider */}
            <div className="flex items-center gap-4 my-4">
              <div className="flex-1 h-px bg-white/20" />
              <span className="text-white/40 text-sm">o</span>
              <div className="flex-1 h-px bg-white/20" />
            </div>

            {/* Username/Password */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-transparent border-2 border-pink-500/50 rounded-full px-5 py-3">
                <input type="text" placeholder="Nombre de usuario" value={username} onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-transparent text-white placeholder-gray-400 outline-none text-base" required />
              </div>
              <div className="bg-transparent border-2 border-pink-500/50 rounded-full px-5 py-3">
                <input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent text-white placeholder-gray-400 outline-none text-base" required />
              </div>
              <button type="submit" disabled={!!loading} data-testid="password-login-btn"
                className="w-full bg-gradient-to-r from-pink-500 to-pink-600 text-white py-3.5 rounded-full text-lg font-bold hover:from-pink-600 hover:to-pink-700 transition-all disabled:opacity-50">
                {loading === 'password' ? 'Conectando...' : (isRegister ? 'Registrarse' : 'Ingresar')}
              </button>
              <div className="text-center">
                <button type="button" onClick={() => setIsRegister(!isRegister)}
                  className="text-pink-400 hover:text-pink-300 transition-colors text-sm">
                  {isRegister ? '¿Ya tienes cuenta? Ingresa' : '¿No tienes cuenta? Registrate'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* PHONE AUTH VIEW */}
        {authMode === 'phone' && (
          <div className="space-y-4">
            <button onClick={() => { setAuthMode('main'); setConfirmResult(null); setOtp(''); setError(''); }}
              className="text-white/60 text-sm mb-2">← Volver</button>

            {!confirmResult ? (
              <>
                <p className="text-white text-center text-sm mb-3">Ingresa tu numero con codigo de pais</p>
                <div className="bg-transparent border-2 border-green-500/50 rounded-full px-5 py-3">
                  <input type="tel" placeholder="+52 1234567890" value={phone} onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-transparent text-white placeholder-gray-400 outline-none text-lg text-center" />
                </div>
                <button onClick={handleSendOTP} disabled={!!loading} data-testid="send-otp-btn"
                  className="w-full bg-green-600 text-white py-3.5 rounded-full text-lg font-bold hover:bg-green-700 transition-all disabled:opacity-50">
                  {loading === 'phone' ? 'Enviando...' : 'Enviar Codigo SMS'}
                </button>
              </>
            ) : (
              <>
                <p className="text-white text-center text-sm mb-3">Codigo enviado a {phone}</p>
                <div className="bg-transparent border-2 border-green-500/50 rounded-full px-5 py-3">
                  <input type="text" placeholder="Codigo de 6 digitos" value={otp} onChange={(e) => setOtp(e.target.value)}
                    maxLength={6} className="w-full bg-transparent text-white placeholder-gray-400 outline-none text-2xl text-center tracking-[0.5em]" />
                </div>
                <button onClick={handleVerifyOTP} disabled={!!loading} data-testid="verify-otp-btn"
                  className="w-full bg-green-600 text-white py-3.5 rounded-full text-lg font-bold hover:bg-green-700 transition-all disabled:opacity-50">
                  {loading === 'verify' ? 'Verificando...' : 'Verificar Codigo'}
                </button>
                <button onClick={() => { setConfirmResult(null); setOtp(''); }}
                  className="text-green-400 text-sm text-center w-full">Reenviar codigo</button>
              </>
            )}
          </div>
        )}

        {error && <div className="text-red-400 text-center text-sm mt-4 bg-red-500/10 rounded-xl p-3">{error}</div>}

        {/* Invisible reCAPTCHA container */}
        <div ref={recaptchaRef} id="recaptcha-container" />

        <div className="text-center mt-6 text-gray-500 text-xs">
          Lluvia Live - Todos los derechos reservados
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
