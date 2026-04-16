import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useUser } from '../contexts/UserContext';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatCoins = (n) => {
  if (!n && n !== 0) return '0';
  if (n >= 1e9) return `${(n/1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n/1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n/1e3).toFixed(0)}K`;
  return n.toLocaleString();
};

const StorePage = ({ onBack }) => {
  const { user, updateUser } = useUser();
  const [packages, setPackages] = useState({});
  const [paypalClientId, setPaypalClientId] = useState(null);
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [loading, setLoading] = useState(null);

  useEffect(() => {
    loadPackages();
    loadPaypalId();
    checkPayment();
  }, []);

  const loadPackages = async () => {
    try {
      const res = await axios.get(`${API}/store/packages`);
      setPackages(res.data);
    } catch (err) { console.error(err); }
  };

  const loadPaypalId = async () => {
    try {
      const res = await axios.get(`${API}/store/paypal-client-id`);
      setPaypalClientId(res.data.client_id);
    } catch (err) { console.error('PayPal no configurado'); }
  };

  const checkPayment = async () => {
    const params = new URLSearchParams(window.location.search);
    const txId = params.get('tx_id');
    const paymentStatus = params.get('payment');
    if (txId && paymentStatus === 'success') {
      try {
        const res = await axios.get(`${API}/store/status/${txId}`);
        if (res.data.payment_status === 'paid' || res.data.status === 'completed') {
          alert('Pago exitoso! Tus monedas y diamantes han sido agregados.');
          const u = await axios.get(`${API}/users/${user.id}`);
          updateUser(u.data);
        }
      } catch (err) { console.error(err); }
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  const buyPackage = async (pkgId) => {
    setLoading(pkgId);
    try {
      const res = await axios.post(`${API}/store/checkout?package_id=${pkgId}&user_id=${user.id}`, null, {
        headers: { 'Origin': window.location.origin }
      });
      if (res.data.url) window.location.href = res.data.url;
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al procesar pago. Contacta Soporte de Lluvia Live.');
    }
    setLoading(null);
  };

  const pkgColors = {
    pack_1000: 'from-blue-500 to-cyan-500',
    pack_5000: 'from-purple-500 to-pink-500',
    pack_10000: 'from-yellow-500 to-orange-500',
    pack_50000: 'from-red-500 to-rose-500',
    pack_100000: 'from-green-500 to-teal-500',
    pack_500000: 'from-indigo-500 to-violet-500',
    pack_1000000: 'from-amber-500 to-yellow-500',
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-lg mx-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <button onClick={onBack} data-testid="store-back-btn" className="bg-pink-500 text-white px-5 py-2 rounded-full text-sm font-bold">← Volver</button>
          <h2 className="text-xl font-bold text-gray-800">Tienda Lluvia Live</h2>
          <div className="text-right">
            <div className="text-yellow-600 font-bold text-sm">{formatCoins(user.coins)}</div>
            <div className="text-cyan-600 font-bold text-xs">{formatCoins(user.diamonds)} diamantes</div>
          </div>
        </div>

        <div className="space-y-4">
          {Object.entries(packages).map(([id, pkg]) => (
            <div key={id} className={`bg-gradient-to-r ${pkgColors[id] || 'from-gray-500 to-gray-600'} rounded-2xl p-5 text-white`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black">{pkg.name}</h3>
                  <p className="text-white/80 text-sm">{formatCoins(pkg.coins)} monedas</p>
                  {pkg.diamonds > 0 && <p className="text-white/80 text-sm">{formatCoins(pkg.diamonds)} diamantes</p>}
                </div>
                <button
                  onClick={() => buyPackage(id)}
                  disabled={loading === id}
                  data-testid={`buy-${id}`}
                  className="bg-white text-gray-800 px-6 py-3 rounded-xl font-black text-lg shadow-lg hover:scale-105 transition-all disabled:opacity-50"
                >
                  {loading === id ? '...' : `$${pkg.price}`}
                </button>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-gray-400 text-xs mt-6">Pagos seguros con PayPal</p>
        <p className="text-center text-gray-300 text-[10px]">Soporte: Lluvia Live</p>
      </div>
    </div>
  );
};

export default StorePage;
