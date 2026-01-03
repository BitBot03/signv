import React, { useState, useEffect } from 'react';
import { XIcon, MaximizeIcon, MinimizeIcon, AlertTriangleIcon } from './icons';

interface SenderViewProps {
  onSend: (text: string) => void;
  onExit: () => void;
  targetId: string;
  status: 'disconnected' | 'connecting' | 'connected';
}

const PHRASES = [
  "Hello", "Thank You", "Yes", "No",
  "Please", "Help", "Good Morning", "My name is",
  "Nice to meet you", "Goodbye", "Sorry", "I understand",
  "What time is it?", "Bathroom", "Water"
];

export const SenderView: React.FC<SenderViewProps> = ({ onSend, onExit, targetId, status }) => {
  const [customText, setCustomText] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(e => console.log("Fullscreen failed:", e));
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(e => console.log("Exit fullscreen failed:", e));
      }
    }
  };

  const handleCustomSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (customText.trim()) {
      onSend(customText);
      setCustomText('');
    }
  };

  const handleSosTrigger = () => {
    if (confirm("Send SOS Emergency Signal to friend?")) {
      onSend("!!SOS_TRIGGER!!");
    }
  };

  // Helper to determine status color and text
  const getStatusDisplay = () => {
      switch(status) {
          case 'connected':
              return { color: 'bg-accent', text: 'text-accent', label: `CONNECTED TO ${targetId}` };
          case 'connecting':
              return { color: 'bg-primary', text: 'text-primary', label: 'CONNECTING...' };
          default:
              return { color: 'bg-danger', text: 'text-danger', label: 'DISCONNECTED (RETRYING...)' };
      }
  };

  const statusStyle = getStatusDisplay();

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col p-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 border-b border-surfaceHighlight pb-4">
        <div>
          <h2 className="text-xl font-bold text-textMain">Remote Controller</h2>
          <div className="flex items-center gap-2 mt-1">
             <div className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)] ${statusStyle.color} ${status === 'connecting' ? 'animate-pulse' : ''}`} />
             <p className={`text-[10px] font-mono uppercase tracking-widest ${statusStyle.text}`}>
               {statusStyle.label}
             </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
            <button 
                onClick={toggleFullScreen}
                className="p-2 bg-surfaceHighlight/50 rounded-lg text-textMuted hover:text-white"
                title={isFullscreen ? "Exit Full Screen" : "Enter Full Screen"}
            >
                {isFullscreen ? <MinimizeIcon className="w-6 h-6" /> : <MaximizeIcon className="w-6 h-6" />}
            </button>
            <button 
            onClick={onExit}
            className="p-2 bg-surfaceHighlight/50 rounded-lg text-textMuted hover:text-white"
            >
            <XIcon className="w-6 h-6" />
            </button>
        </div>
      </div>

      {/* Grid of Phrases */}
      <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-3 overflow-y-auto mb-4 scrollbar-hide">
        {/* SPECIAL SOS BUTTON */}
        <button
          onClick={handleSosTrigger}
          disabled={status !== 'connected'}
          className={`col-span-2 md:col-span-3 p-5 rounded-2xl text-xl font-bold transition-all active:scale-95 shadow-lg border-2 flex items-center justify-center gap-3 ${
            status === 'connected' 
            ? 'bg-danger/20 border-danger text-danger hover:bg-danger hover:text-white animate-pulse' 
            : 'bg-surface/50 border-transparent text-textMuted cursor-not-allowed opacity-50'
          }`}
        >
          <AlertTriangleIcon className="w-6 h-6" /> EMERGENCY SOS
        </button>

        {PHRASES.map((phrase) => (
          <button
            key={phrase}
            onClick={() => onSend(phrase)}
            disabled={status !== 'connected'}
            className={`p-4 rounded-xl text-lg font-medium transition-all active:scale-95 shadow-sm border ${
              status === 'connected' 
              ? 'bg-surface border-surfaceHighlight text-textMain hover:bg-primary hover:border-primary' 
              : 'bg-surface/50 border-transparent text-textMuted cursor-not-allowed opacity-50'
            }`}
          >
            {phrase}
          </button>
        ))}
      </div>

      {/* Custom Input */}
      <form onSubmit={handleCustomSend} className="flex-none pt-2">
        <label className="text-xs text-textMuted uppercase font-bold mb-2 block">Custom Message</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder={status === 'connected' ? "Type anything..." : "Waiting for connection..."}
            disabled={status !== 'connected'}
            className="flex-1 bg-surface border border-surfaceHighlight rounded-xl px-4 py-3 text-textMain focus:outline-none focus:border-primary disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={status !== 'connected' || !customText.trim()}
            className="bg-primary text-white font-bold px-6 py-3 rounded-xl hover:bg-primaryHover active:scale-95 transition-transform disabled:opacity-50 disabled:bg-surfaceHighlight"
          >
            SEND
          </button>
        </div>
      </form>
    </div>
  );
};