import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * SuperAdminTools — panel del dueño con:
 * 1. Rastreo de cuentas falsas (dispositivos con múltiples cuentas)
 * 2. Baneo de Device ID (bloquea el teléfono completo)
 * 3. Baneo de IP (bloquea la conexión)
 * 4. Listado de dispositivos e IPs baneadas
 */
const SuperAdminTools = ({ adminId }) => {
  const [tab, setTab] = useState('duplicates');
  const [duplicates, setDuplicates] = useState([]);
  const [bannedDevices, setBannedDevices] = useState([]);
  const [bannedIps, setBannedIps] = useState([]);
  const [manualDevice, setManualDevice] = useState('');
  const [manualIp, setManualIp] = useState('');
  const [reason, setReason] = useState('Fraude / Multi-cuenta');
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [deviceAccounts, setDeviceAccounts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const notify = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [d, bd, bi] = await Promise.all([
        axios.get(`${API}/admin/duplicate-devices?admin_id=${adminId}&min_accounts=2`),
        axios.get(`${API}/admin/banned-devices?admin_id=${adminId}`),
        axios.get(`${API}/admin/banned-ips?admin_id=${adminId}`),
      ]);
      setDuplicates(d.data);
      setBannedDevices(bd.data);
      setBannedIps(bi.data);
    } catch (e) { notify(e.response?.data?.detail || 'Error cargando'); }
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const banDevice = async (deviceId) => {
    try {
      await axios.post(`${API}/admin/ban-device?device_id=${encodeURIComponent(deviceId)}&admin_id=${adminId}&reason=${encodeURIComponent(reason)}`);
      notify(`Dispositivo baneado: ${deviceId.substring(0, 12)}...`);
      loadAll();
    } catch (e) { notify(e.response?.data?.detail || 'Error'); }
  };

  const unbanDevice = async (deviceId) => {
    try {
      await axios.post(`${API}/admin/unban-device?device_id=${encodeURIComponent(deviceId)}&admin_id=${adminId}`);
      notify('Dispositivo desbaneado');
      loadAll();
    } catch (e) { notify(e.response?.data?.detail || 'Error'); }
  };

  const banIp = async (ip) => {
    try {
      await axios.post(`${API}/admin/ban-ip?ip_address=${encodeURIComponent(ip)}&admin_id=${adminId}&reason=${encodeURIComponent(reason)}`);
      notify(`IP baneada: ${ip}`);
      loadAll();
    } catch (e) { notify(e.response?.data?.detail || 'Error'); }
  };

  const unbanIp = async (ip) => {
    try {
      await axios.post(`${API}/admin/unban-ip?ip_address=${encodeURIComponent(ip)}&admin_id=${adminId}`);
      notify('IP desbaneada');
      loadAll();
    } catch (e) { notify(e.response?.data?.detail || 'Error'); }
  };

  const openDeviceDetail = async (deviceId) => {
    setSelectedDevice(deviceId);
    try {
      const r = await axios.get(`${API}/admin/device-accounts/${encodeURIComponent(deviceId)}?admin_id=${adminId}`);
      setDeviceAccounts(r.data);
    } catch (e) { notify(e.response?.data?.detail || 'Error'); }
  };

  const tabs = [
    { id: 'duplicates', label: `🕵️ Cuentas Falsas (${duplicates.length})`, testid: 'tab-duplicates' },
    { id: 'devices', label: `📵 Devices Baneados (${bannedDevices.length})`, testid: 'tab-banned-devices' },
    { id: 'ips', label: `🚫 IPs Baneadas (${bannedIps.length})`, testid: 'tab-banned-ips' },
    { id: 'manual', label: '⚙️ Ban Manual', testid: 'tab-manual-ban' },
  ];

  return (
    <div className="bg-gray-900/70 rounded-2xl border border-red-500/30 overflow-hidden" data-testid="super-admin-tools">
      <div className="px-4 py-3 border-b border-white/10 bg-gradient-to-r from-red-900/40 to-orange-900/30">
        <h3 className="text-white font-black text-base flex items-center gap-2">
          👑 Herramientas de Super Admin
          {loading && <span className="text-[10px] text-white/50">cargando…</span>}
        </h3>
        <p className="text-white/50 text-[10px] mt-0.5">Rastreo, baneo de dispositivos, IPs y detección de multi-cuentas</p>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-1 px-3 pt-2 border-b border-white/10">
        {tabs.map(t => (
          <button key={t.id} data-testid={t.testid} onClick={() => setTab(t.id)}
            className={`text-xs font-semibold px-3 py-2 rounded-t-lg whitespace-nowrap transition-colors ${
              tab === t.id ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-3 max-h-[400px] overflow-y-auto">
        {tab === 'duplicates' && (
          <div className="space-y-2">
            {duplicates.length === 0 && <div className="text-white/40 text-xs text-center py-6">No hay dispositivos con múltiples cuentas.</div>}
            {duplicates.map((d) => (
              <div key={d.device_id} className="bg-white/5 rounded-xl p-3 border border-red-500/20">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex-1 min-w-0">
                    <div className="text-orange-300 text-[10px] uppercase font-bold">Device ID</div>
                    <div className="text-white text-xs font-mono truncate">{d.device_id}</div>
                  </div>
                  <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full ml-2">{d.account_count} cuentas</span>
                </div>
                <div className="text-white/60 text-xs mb-2">{d.usernames.join(' · ')}</div>
                <div className="flex gap-2">
                  <button onClick={() => openDeviceDetail(d.device_id)} className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-lg">
                    Ver detalles
                  </button>
                  <button onClick={() => banDevice(d.device_id)} className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg">
                    📵 Banear device
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'devices' && (
          <div className="space-y-2">
            {bannedDevices.length === 0 && <div className="text-white/40 text-xs text-center py-6">No hay dispositivos baneados.</div>}
            {bannedDevices.map((d) => (
              <div key={d.device_id} className="bg-white/5 rounded-xl p-3 border border-white/10 flex items-center justify-between">
                <div className="flex-1 min-w-0 pr-2">
                  <div className="text-white text-xs font-mono truncate">{d.device_id}</div>
                  <div className="text-white/50 text-[10px] mt-0.5">{d.reason} · {d.account_count} cuentas afectadas</div>
                </div>
                <button onClick={() => unbanDevice(d.device_id)} className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg">
                  ✓ Desbanear
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === 'ips' && (
          <div className="space-y-2">
            {bannedIps.length === 0 && <div className="text-white/40 text-xs text-center py-6">No hay IPs baneadas.</div>}
            {bannedIps.map((i) => (
              <div key={i.ip_address} className="bg-white/5 rounded-xl p-3 border border-white/10 flex items-center justify-between">
                <div className="flex-1 min-w-0 pr-2">
                  <div className="text-white text-xs font-mono">{i.ip_address}</div>
                  <div className="text-white/50 text-[10px] mt-0.5">{i.reason} · {i.account_count} cuentas afectadas</div>
                </div>
                <button onClick={() => unbanIp(i.ip_address)} className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg">
                  ✓ Desbanear
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === 'manual' && (
          <div className="space-y-3">
            <div>
              <label className="text-white/60 text-[10px] font-semibold uppercase">Razón</label>
              <input value={reason} onChange={e => setReason(e.target.value)}
                className="w-full bg-white/5 border border-white/10 text-white text-sm rounded-lg px-3 py-2 mt-1 outline-none focus:border-red-400" />
            </div>
            <div className="bg-red-500/10 rounded-xl p-3 border border-red-500/30">
              <label className="text-red-300 text-[10px] font-bold uppercase">Banear Device ID</label>
              <div className="flex gap-2 mt-1">
                <input data-testid="input-ban-device" value={manualDevice} onChange={e => setManualDevice(e.target.value)}
                  placeholder="device_id aquí…"
                  className="flex-1 bg-white/5 border border-white/10 text-white text-xs rounded-lg px-3 py-2 outline-none font-mono" />
                <button data-testid="btn-ban-device" onClick={() => { if (manualDevice) { banDevice(manualDevice); setManualDevice(''); } }}
                  className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 rounded-lg">
                  Banear
                </button>
              </div>
            </div>
            <div className="bg-orange-500/10 rounded-xl p-3 border border-orange-500/30">
              <label className="text-orange-300 text-[10px] font-bold uppercase">Banear IP</label>
              <div className="flex gap-2 mt-1">
                <input data-testid="input-ban-ip" value={manualIp} onChange={e => setManualIp(e.target.value)}
                  placeholder="192.168.x.x"
                  className="flex-1 bg-white/5 border border-white/10 text-white text-xs rounded-lg px-3 py-2 outline-none font-mono" />
                <button data-testid="btn-ban-ip" onClick={() => { if (manualIp) { banIp(manualIp); setManualIp(''); } }}
                  className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold px-4 rounded-lg">
                  Banear
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Device detail modal */}
      {selectedDevice && deviceAccounts && (
        <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" onClick={() => { setSelectedDevice(null); setDeviceAccounts(null); }}>
          <div className="bg-gray-900 rounded-2xl border border-white/10 p-4 w-full max-w-md max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="text-white font-bold">Cuentas en este device</h4>
                <p className="text-white/50 text-[10px] font-mono break-all mt-1">{selectedDevice}</p>
              </div>
              <button onClick={() => { setSelectedDevice(null); setDeviceAccounts(null); }} className="text-white/50 text-xl">✕</button>
            </div>
            <div className="space-y-2">
              {deviceAccounts.accounts.map(a => (
                <div key={a.id} className="bg-white/5 rounded-lg p-2 flex items-center gap-2">
                  {a.avatar && <img src={a.avatar} alt="" className="w-8 h-8 rounded-full" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-semibold truncate">{a.username}</div>
                    <div className="text-white/40 text-[10px]">{a.role} · Nivel {a.level || 1}{a.is_banned ? ' · 🚫 BAN' : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[95] bg-red-600 text-white text-sm font-semibold px-4 py-2 rounded-full shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
};

export default SuperAdminTools;
