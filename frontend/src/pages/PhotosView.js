import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useUser } from '../contexts/UserContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BASE = process.env.REACT_APP_BACKEND_URL;

const PhotosView = ({ onBack }) => {
  const { user } = useUser();
  const [photos, setPhotos] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const fileRef = useRef();

  useEffect(() => { loadPhotos(); }, []);

  const loadPhotos = async () => {
    try {
      const res = await axios.get(`${API}/photos`);
      setPhotos(res.data);
    } catch (err) { /* silent */ }
  };

  const handleUpload = async () => {
    if (!title.trim()) return alert('Escribe un título');
    const file = fileRef.current?.files[0];
    let imageUrl = `https://picsum.photos/seed/${Date.now()}/400/400`;

    if (file) {
      setUploading(true);
      try {
        const form = new FormData();
        form.append('file', file);
        const upRes = await axios.post(`${API}/upload`, form);
        imageUrl = `${BASE}${upRes.data.url}`;
      } catch (err) {
        alert('Error subiendo archivo');
        setUploading(false);
        return;
      }
    }

    try {
      await axios.post(`${API}/photos`, {
        user_id: user.id, title, image_url: imageUrl, description
      });
      setTitle(''); setDescription(''); setShowCreate(false);
      if (fileRef.current) fileRef.current.value = '';
      loadPhotos();
    } catch (err) { alert('Error subiendo foto'); }
    setUploading(false);
  };

  const likePhoto = async (id) => {
    try {
      await axios.post(`${API}/photos/${id}/like?user_id=${user.id}`);
      loadPhotos();
    } catch (err) { /* silent */ }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-4xl mx-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <button onClick={onBack} className="bg-pink-500 text-white px-5 py-2 rounded-full text-sm">← Volver</button>
          <h2 className="text-xl font-bold text-gray-800">📸 Galería</h2>
          <button onClick={() => setShowCreate(!showCreate)} className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-4 py-2 rounded-full text-sm font-bold">
            + Subir
          </button>
        </div>

        {showCreate && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border mb-6">
            <h3 className="font-bold text-gray-800 mb-3">📸 Nueva Foto</h3>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Título"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 mb-3 outline-none focus:border-pink-500" />
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descripción..."
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 mb-3 outline-none focus:border-pink-500 h-20 resize-none" />
            <div className="mb-3">
              <label className="block text-gray-600 text-sm mb-1">📷 Subir Imagen (JPG, PNG, GIF, WebP):</label>
              <input type="file" ref={fileRef} accept="image/*"
                className="w-full border-2 border-dashed border-gray-300 rounded-xl p-3 text-sm" />
            </div>
            <button onClick={handleUpload} disabled={uploading}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 rounded-xl font-bold disabled:opacity-50">
              {uploading ? '⏳ Subiendo...' : '📸 Publicar Foto'}
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {photos.map(photo => (
            <div key={photo.id} onClick={() => setSelectedPhoto(photo)}
              className="bg-white rounded-xl overflow-hidden cursor-pointer hover:shadow-md transition-all border">
              <img src={photo.image_url} alt={photo.title} className="w-full h-48 object-cover"
                onError={e => { e.target.src = `https://picsum.photos/seed/${photo.id}/400/400`; }} />
              <div className="p-3">
                <p className="font-medium text-gray-800 text-sm truncate">{photo.title}</p>
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-1">
                    <img src={photo.avatar} alt="" className="w-5 h-5 rounded-full" />
                    <span className="text-gray-400 text-xs">{photo.username}</span>
                  </div>
                  <button onClick={e => { e.stopPropagation(); likePhoto(photo.id); }} className="text-xs">
                    {photo.liked_by?.includes(user.id) ? '❤️' : '🤍'} {photo.likes || 0}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {photos.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-6xl mb-3">📸</div><p>No hay fotos. ¡Sube la primera!</p>
          </div>
        )}

        {selectedPhoto && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setSelectedPhoto(null)}>
            <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden" onClick={e => e.stopPropagation()}>
              <img src={selectedPhoto.image_url} alt="" className="w-full h-80 object-cover"
                onError={e => { e.target.src = `https://picsum.photos/seed/${selectedPhoto.id}/400/400`; }} />
              <div className="p-5">
                <h3 className="text-xl font-bold text-gray-800 mb-1">{selectedPhoto.title}</h3>
                {selectedPhoto.description && <p className="text-gray-500 mb-3">{selectedPhoto.description}</p>}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img src={selectedPhoto.avatar} alt="" className="w-8 h-8 rounded-full" />
                    <span className="text-gray-800 font-medium">{selectedPhoto.username}</span>
                  </div>
                  <button onClick={() => likePhoto(selectedPhoto.id)}
                    className="bg-pink-50 text-pink-500 px-4 py-2 rounded-full text-sm font-bold">
                    {selectedPhoto.liked_by?.includes(user.id) ? '❤️' : '🤍'} {selectedPhoto.likes || 0}
                  </button>
                </div>
              </div>
              <button onClick={() => setSelectedPhoto(null)} className="w-full bg-gray-100 text-gray-600 py-3 font-bold">Cerrar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PhotosView;
