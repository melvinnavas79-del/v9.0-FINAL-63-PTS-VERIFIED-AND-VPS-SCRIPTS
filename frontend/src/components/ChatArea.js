import React, { useRef, useEffect } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * ChatArea — Lista de mensajes de la sala + input para enviar mensajes y fotos.
 * Se encarga del autoscroll al llegar mensajes nuevos.
 */
const ChatArea = ({
  messages,
  input,
  onInputChange,
  onSend,
  onPhotoUpload,
  onZoomImage,
}) => {
  const scrollRef = useRef(null);
  const photoRef = useRef(null);
  const prevCount = useRef(0);

  useEffect(() => {
    if (messages.length > prevCount.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevCount.current = messages.length;
  }, [messages]);

  const resolveImg = (url) => (url?.startsWith('/api') ? `${BACKEND_URL}${url}` : url);

  return (
    <div className="h-full flex flex-col">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1">
        {messages.map((m) => (
          <div key={m.id} className={m.type === 'welcome' || m.type === 'gift' ? 'text-center' : ''}>
            {m.type === 'welcome' ? (
              <span
                className="bg-yellow-500/10 text-yellow-300/70 text-xs px-2 py-1 rounded-full inline-block"
                style={{ animation: 'fadeInUp 0.5s ease-out' }}
              >
                {m.text}
              </span>
            ) : m.type === 'gift' ? (
              <span
                className="bg-pink-500/10 text-pink-300/80 text-xs px-2 py-1 rounded-full inline-block"
                style={{ animation: 'giftBubble 0.6s ease-out' }}
              >
                {m.text}
              </span>
            ) : m.type === 'photo' ? (
              <div className="flex items-start gap-1.5">
                <img src={m.avatar || ''} alt="" className="w-6 h-6 rounded-full mt-0.5" />
                <div>
                  <span className="text-pink-400 text-xs font-bold">{m.username}</span>
                  <img
                    src={resolveImg(m.image_url)}
                    alt=""
                    onClick={() => onZoomImage(resolveImg(m.image_url))}
                    className="mt-0.5 max-w-[150px] rounded-lg object-cover cursor-pointer transition-all hover:opacity-80"
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-1.5">
                <img src={m.avatar || ''} alt="" className="w-6 h-6 rounded-full mt-0.5" />
                <div>
                  <span className="text-cyan-400 text-xs font-bold">{m.username}: </span>
                  <span className="text-white/60 text-xs">{m.text}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2 flex-shrink-0 mt-1">
        <button
          onClick={() => photoRef.current?.click()}
          className="bg-white/5 w-10 h-10 rounded-full flex items-center justify-center text-sm"
        >
          📷
        </button>
        <input ref={photoRef} type="file" accept="image/*" onChange={onPhotoUpload} className="hidden" />
        <input
          type="text"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSend()}
          placeholder="Mensaje..."
          data-testid="chat-input"
          className="flex-1 bg-white/5 text-white placeholder-white/20 border-0 rounded-full px-4 py-2.5 text-sm outline-none min-h-[40px]"
        />
        <button
          data-testid="chat-send-btn"
          onClick={onSend}
          className="bg-cyan-500 text-white px-4 py-2.5 rounded-full text-sm font-bold min-h-[40px]"
        >
          Enviar
        </button>
      </div>
    </div>
  );
};

export default ChatArea;
