import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useUser } from '../contexts/UserContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BASE = process.env.REACT_APP_BACKEND_URL;

const ReelsView = ({ onBack }) => {
  const { user } = useUser();
  const [reels, setReels] = useState([]);
  const [showCreate, setShowCreate] = useState(() => {
    try {
      if (sessionStorage.getItem('ll_reels_open_create') === '1') {
        sessionStorage.removeItem('ll_reels_open_create');
        return true;
      }
    } catch (_) {}
    return false;
  });
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  useEffect(() => { loadReels(); }, []);

  const loadReels = async () => {
    try {
      const res = await axios.get(`${API}/reels`);
      setReels(res.data);
    } catch (err) { /* silent */ }
  };

  const handleUpload = async () => {
    if (!title.trim()) return alert('Escribe un título');
    const file = fileRef.current?.files[0];
    let videoUrl = '';
    let imageUrl = '';

    if (!file) {
      return alert('Selecciona un video o imagen para publicar');
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const upRes = await axios.post(`${API}/reels/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const absUrl = `${BASE}${upRes.data.url}`;
      if (upRes.data.is_video) {
        videoUrl = absUrl;
      } else {
        imageUrl = absUrl;
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Error subiendo archivo');
      setUploading(false);
      return;
    }

    try {
      await axios.post(`${API}/reels`, {
        user_id: user.id, title, description,
        video_url: videoUrl, image_url: imageUrl,
      });
      setTitle(''); setDescription(''); setShowCreate(false);
      if (fileRef.current) fileRef.current.value = '';
      loadReels();
    } catch (err) { alert(err.response?.data?.detail || 'Error creando reel'); }
    setUploading(false);
  };

  const likeReel = async (id) => {
    try {
      await axios.post(`${API}/reels/${id}/like?user_id=${user.id}`);
      loadReels();
    } catch (err) { /* silent */ }
  };

  const colors = ['from-pink-500 to-rose-600','from-purple-500 to-indigo-600','from-blue-500 to-cyan-600','from-green-500 to-emerald-600','from-yellow-500 to-orange-600'];

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Floating create button — respeta safe-area iPhone */}
      <button
        data-testid="reels-create-fab"
        onClick={() => setShowCreate(true)}
        aria-label="Crear Reel"
        className="fixed right-4 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-pink-500 via-rose-500 to-purple-600 text-white shadow-xl flex items-center justify-center active:scale-95 transition-transform border-2 border-white/30"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 14px) + 24px)' }}
      >
        <span className="text-3xl leading-none font-thin">+</span>
      </button>

      <div className="max-w-2xl mx-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <button onClick={onBack} className="bg-pink-500 text-white px-5 py-2 rounded-full text-sm">← Volver</button>
          <h2 className="text-xl font-bold text-gray-800">🎬 Reels</h2>
          <button onClick={() => setShowCreate(!showCreate)} className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-4 py-2 rounded-full text-sm font-bold">
            + Crear
          </button>
        </div>

        {showCreate && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border mb-6">
            <h3 className="font-bold text-gray-800 mb-3">🎬 Nuevo Reel</h3>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Título"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 mb-3 outline-none focus:border-pink-500" />
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descripción..."
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 mb-3 outline-none focus:border-pink-500 h-20 resize-none" />
            <div className="mb-3">
              <label className="block text-gray-600 text-sm mb-1">📹 Subir Video (MP4, MOV, AVI, WebM):</label>
              <input type="file" ref={fileRef} accept="video/*,image/*"
                className="w-full border-2 border-dashed border-gray-300 rounded-xl p-3 text-sm" />
            </div>
            <button onClick={handleUpload} disabled={uploading}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 rounded-xl font-bold disabled:opacity-50">
              {uploading ? '⏳ Subiendo...' : '🚀 Publicar Reel'}
            </button>
          </div>
        )}

        <div className="space-y-4" data-testid="reels-feed">
          {reels.map((reel, i) => (
            <div key={reel.id} data-testid={`reel-card-${reel.id}`} className="bg-white rounded-2xl overflow-hidden shadow-sm border">
              {reel.video_url ? (
                <video data-testid={`reel-video-${reel.id}`} src={reel.video_url} controls playsInline className="w-full h-64 object-cover bg-black" />
              ) : reel.image_url ? (
                <img data-testid={`reel-image-${reel.id}`} src={reel.image_url} alt={reel.title} className="w-full h-64 object-cover bg-black" />
              ) : (
                <div className={`bg-gradient-to-br ${colors[i % colors.length]} h-64 flex items-center justify-center`}>
                  <div className="text-center">
                    <div className="text-6xl mb-2">🎬</div>
                    <div className="text-white text-xl font-bold">{reel.title}</div>
                  </div>
                </div>
              )}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <img src={reel.avatar} alt="" className="w-8 h-8 rounded-full" />
                    <span className="font-bold text-gray-800 text-sm">{reel.username}</span>
                  </div>
                  <div className="flex gap-3">
                    <button data-testid={`reel-like-${reel.id}`} onClick={() => likeReel(reel.id)} className="text-sm">
                      {reel.liked_by?.includes(user.id) ? '❤️' : '🤍'} {reel.likes || 0}
                    </button>
                    <span className="text-sm text-gray-400">💬 {reel.comments_count || 0}</span>
                  </div>
                </div>
                <h4 className="font-bold text-gray-800">{reel.title}</h4>
                {reel.description && <p className="text-gray-500 text-sm">{reel.description}</p>}
              </div>
            </div>
          ))}
          {reels.length === 0 && (
            <div data-testid="reels-empty" className="text-center py-16 text-gray-400">
              <div className="text-6xl mb-3">🎬</div>
              <p>No hay reels. ¡Crea el primero!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReelsView;
