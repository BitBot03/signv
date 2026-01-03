import React, { useEffect, useState, useRef } from 'react';
import { useSerial, SerialMessage } from './hooks/useSerial';
import { useRemote } from './hooks/useRemote';
import { speak } from './services/speechService';
import { SenderView } from './components/SenderView';
import { UsbIcon, SpeakerOnIcon, SpeakerOffIcon, TrashIcon, HistoryIcon, SettingsIcon, XIcon, MaximizeIcon, MinimizeIcon, MicIcon, MicOffIcon, HandIcon, FistIcon, CheckCircleIcon, AlertTriangleIcon, PhoneIcon } from './components/icons';

// --- Sub-Components ---

// Calibration Modal Component
const CalibrationModal: React.FC<{ isOpen: boolean; onClose: () => void; isConnected: boolean }> = ({ isOpen, onClose, isConnected }) => {
  const [step, setStep] = useState(1);
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen) { 
      setStep(1); 
      setProgress(0); 
      setIsProcessing(false); 
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setIsProcessing(false);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen]);

  const playBeep = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) {
      console.error("Audio beep failed", e);
    }
  };

  const handleStartStep = () => {
    if (!isConnected) return;
    setIsProcessing(true); setProgress(0);
    const duration = 12000; const intervalTime = 50; const steps = duration / intervalTime; let currentStep = 0;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      currentStep++;
      setProgress(Math.min((currentStep / steps) * 100, 100));
      if (currentStep >= steps) {
        clearInterval(timerRef.current); setIsProcessing(false);
        playBeep();
        if (step === 1) { setStep(2); setProgress(0); } else { setStep(3); }
      }
    }, intervalTime);
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface border border-surfaceHighlight rounded-2xl w-full max-sm shadow-2xl p-6 relative animate-slide-up flex flex-col items-center text-center">
        <button onClick={onClose} className="absolute top-4 right-4 text-textMuted hover:text-textMain transition-colors p-1 rounded-full hover:bg-surfaceHighlight/50">
           <XIcon className="w-5 h-5" />
        </button>
        <h3 className="text-xl font-bold text-textMain mb-2">Sensor Calibration</h3>
        <p className="text-xs text-textMuted uppercase tracking-wider mb-6">
          {step === 1 && "Step 1 of 2"} {step === 2 && "Step 2 of 2"} {step === 3 && "Calibration Complete"}
        </p>
        
        <div className="w-full mb-8 min-h-[180px] flex flex-col items-center justify-center animate-fade-in">
           {step === 1 && (
             <>
               <div className="bg-surfaceHighlight/30 p-4 rounded-full mb-4 ring-1 ring-surfaceHighlight">
                 <HandIcon className="w-12 h-12 text-primary" />
               </div>
               <p className="text-xl font-bold text-white mb-2">Open Hand</p>
               <p className="text-sm text-textMuted max-w-[240px]">Spread your fingers out fully and keep your hand flat.</p>
             </>
           )}
           {step === 2 && (
             <>
               <div className="bg-surfaceHighlight/30 p-4 rounded-full mb-4 ring-1 ring-surfaceHighlight">
                 <FistIcon className="w-12 h-12 text-primary" />
               </div>
               <p className="text-xl font-bold text-white mb-2">Closed Fist</p>
               <p className="text-sm text-textMuted max-w-[240px]">Clench your fingers into a tight fist.</p>
             </>
           )}
           {step === 3 && (
             <>
               <div className="bg-accent/20 p-4 rounded-full mb-4 ring-1 ring-accent/50">
                 <CheckCircleIcon className="w-12 h-12 text-accent" />
               </div>
               <p className="text-xl font-bold text-white mb-2">Success!</p>
               <p className="text-sm text-textMuted max-w-[240px]">Calibration complete. Your glove is ready to translate signs.</p>
             </>
           )}
        </div>

        {(step === 1 || step === 2) && (
          <div className="w-full bg-surfaceHighlight rounded-full h-2 mb-6 overflow-hidden relative">
             <div className="bg-primary h-full transition-all duration-100 ease-linear relative overflow-hidden" style={{ width: `${progress}%` }}></div>
          </div>
        )}
        <div className="w-full">
           {step < 3 ? (
             <button onClick={handleStartStep} disabled={isProcessing || !isConnected} className={`w-full py-3 rounded-xl font-bold text-white transition-all shadow-lg ${(isProcessing || !isConnected) ? 'bg-surfaceHighlight cursor-not-allowed opacity-80' : 'bg-primary hover:bg-primaryHover'}`}>
                {!isConnected ? 'Connect Device First' : (isProcessing ? 'Calibrating...' : 'Start')}
             </button>
           ) : (
             <button onClick={onClose} className="w-full py-3 bg-accent text-white font-bold rounded-xl hover:bg-emerald-600 transition-all shadow-lg">Done</button>
           )}
        </div>
      </div>
    </div>
  );
};

// SOS Overlay Component
const SosOverlay: React.FC<{ contact: string; message: string; onCancel: () => void }> = ({ contact, message, onCancel }) => {
  const [countdown, setCountdown] = useState(3);
  const soundIntervalRef = useRef<any>(null);

  useEffect(() => {
    // Alarm sound logic
    const playAlarm = () => {
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
        osc.start(); osc.stop(ctx.currentTime + 0.4);
      } catch (e) {}
    };

    soundIntervalRef.current = setInterval(playAlarm, 800);
    
    // Haptic feedback
    if (navigator.vibrate) navigator.vibrate([400, 200, 400]);

    const timer = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(timer);
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => {
      clearInterval(soundIntervalRef.current);
      clearInterval(timer);
    };
  }, []);

  const handleSendNow = () => {
    const encodedMsg = encodeURIComponent(message);
    window.location.href = `sms:${contact}?body=${encodedMsg}`;
    onCancel();
  };

  useEffect(() => {
    if (countdown === 0) handleSendNow();
  }, [countdown]);

  return (
    <div className="fixed inset-0 z-[200] bg-danger flex flex-col items-center justify-center p-6 text-white animate-fade-in overflow-hidden">
      <div className="absolute inset-0 bg-black/20 animate-pulse-slow"></div>
      <div className="relative z-10 flex flex-col items-center text-center max-w-md w-full">
         <div className="bg-white/20 p-8 rounded-full mb-8 ring-8 ring-white/10 animate-bounce">
            <AlertTriangleIcon className="w-24 h-24 text-white" />
         </div>
         <h1 className="text-6xl font-black mb-4 tracking-tighter uppercase italic">SOS TRIGGERED</h1>
         <p className="text-xl font-bold mb-12 opacity-90 leading-tight">Emergency signal requested by friend via remote controller.</p>
         
         <div className="w-32 h-32 rounded-full border-8 border-white/30 flex items-center justify-center mb-16 relative">
            <span className="text-5xl font-black">{countdown}</span>
            <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle cx="64" cy="64" r="56" fill="none" stroke="white" strokeWidth="8" strokeDasharray="351.85" strokeDashoffset={351.85 * (1 - countdown/3)} className="transition-all duration-1000 linear" />
            </svg>
         </div>

         <div className="grid grid-cols-1 gap-4 w-full">
            <button onClick={handleSendNow} className="bg-white text-danger py-6 rounded-2xl font-black text-2xl shadow-2xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-3">
               <PhoneIcon className="w-8 h-8" /> SEND SOS NOW
            </button>
            <button onClick={onCancel} className="bg-black/30 border border-white/30 py-4 rounded-2xl font-bold text-lg hover:bg-black/50 transition-colors uppercase tracking-widest">
               CANCEL
            </button>
         </div>
      </div>
    </div>
  );
};

const FakeSerialPicker: React.FC<{ isOpen: boolean; onConnect: () => void; onCancel: () => void }> = ({ isOpen, onConnect, onCancel }) => {
  const [selected, setSelected] = useState(false);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] md:items-center md:pt-0 bg-black/20 backdrop-blur-[1px] animate-fade-in">
      <div className="bg-white rounded-lg shadow-2xl w-[90%] max-w-[400px] overflow-hidden flex flex-col font-sans text-gray-800 animate-slide-up">
        <div className="bg-[#f1f3f4] px-4 py-3 flex items-center gap-3 border-b border-gray-200">
           <span className="text-sm font-medium text-gray-700">signspeak.app wants to connect to a serial port</span>
        </div>
        <div className="p-2 min-h-[200px] bg-white">
           <div onClick={() => setSelected(true)} className={`flex items-center gap-3 p-3 rounded cursor-pointer transition-colors ${selected ? 'bg-[#e8f0fe]' : 'hover:bg-gray-50'}`}>
              <UsbIcon className="w-5 h-5 text-gray-500" />
              <div><div className="text-sm text-gray-900 font-medium">Arduino Nano</div></div>
           </div>
        </div>
        <div className="bg-white px-4 py-3 border-t border-gray-200 flex justify-end gap-3">
           <button onClick={onCancel} className="px-4 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded border border-gray-300">Cancel</button>
           <button onClick={onConnect} disabled={!selected} className={`px-4 py-1.5 text-sm font-medium text-white rounded shadow-sm ${selected ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300 cursor-default'}`}>Connect</button>
        </div>
      </div>
    </div>
  );
};

const Header: React.FC<{ connectionState: 'disconnected' | 'partial' | 'connected', onOpenSettings: () => void }> = ({ connectionState, onOpenSettings }) => {
  let dotClass = 'bg-surfaceHighlight';
  if (connectionState === 'connected') {
    dotClass = 'bg-accent shadow-[0_0_10px_rgba(16,185,129,0.5)]';
  } else if (connectionState === 'partial') {
    dotClass = 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]';
  }

  return (
    <header className="flex-none px-6 py-4 flex items-center justify-between border-b border-surface bg-background z-20">
      <div className="flex items-center gap-3">
        <div className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${dotClass}`} />
        <h1 className="text-xl font-bold tracking-tight text-textMain">SignSpeak</h1>
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden md:block text-xs font-mono text-textMuted uppercase tracking-wider">
          {connectionState !== 'disconnected' ? 'LIVE DATA STREAM' : 'DEVICE DISCONNECTED'}
        </div>
        <button onClick={onOpenSettings} className="p-2 text-textMuted hover:text-textMain hover:bg-surfaceHighlight rounded-lg transition-colors"><SettingsIcon className="w-5 h-5" /></button>
      </div>
    </header>
  );
};

const SettingsModal: React.FC<{ 
  isOpen: boolean; onClose: () => void; baudRate: number; setBaudRate: (rate: number) => void; isConnected: boolean;
  allowDuplicates: boolean; setAllowDuplicates: (allow: boolean) => void;
  emergencyContact: string; setEmergencyContact: (val: string) => void;
  emergencyMessage: string; setEmergencyMessage: (val: string) => void;
  myId: string; remoteStatus: string; onConnectRemote: (id: string) => void; onOpenSender: () => void; onOpenCalibration: () => void;
}> = ({ isOpen, onClose, baudRate, setBaudRate, isConnected, allowDuplicates, setAllowDuplicates, emergencyContact, setEmergencyContact, emergencyMessage, setEmergencyMessage, myId, remoteStatus, onConnectRemote, onOpenSender, onOpenCalibration }) => {
  const [targetIdInput, setTargetIdInput] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const toggleFullScreen = () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(console.log); else if (document.exitFullscreen) document.exitFullscreen().catch(console.log); };
  
  if (!isOpen) return null;
  return (
    <div onClick={onClose} className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
      <div onClick={(e) => e.stopPropagation()} className="bg-surface border border-surfaceHighlight rounded-2xl w-full max-w-sm shadow-2xl p-6 relative animate-slide-up max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-textMuted hover:text-textMain"><XIcon className="w-5 h-5" /></button>
        <h3 className="text-lg font-bold text-textMain mb-6 flex items-center gap-2 select-none"><div onClick={() => setShowAdvanced(!showAdvanced)} className="cursor-default"><SettingsIcon className="w-5 h-5" /></div>Settings</h3>
        <div className="space-y-6">
          <div>
             <label className="text-xs font-semibold text-textMuted uppercase tracking-wider block mb-3">Safety & SOS</label>
             <div className="space-y-3">
                <div className="bg-background/50 p-3 rounded-lg border border-surfaceHighlight">
                    <span className="text-[10px] text-textMuted block mb-1 uppercase font-bold">Emergency Contact</span>
                    <input type="tel" placeholder="+1234567890" value={emergencyContact} onChange={(e) => setEmergencyContact(e.target.value)} className="w-full bg-transparent border-none p-0 text-sm text-white focus:ring-0 placeholder:text-textMuted/30" />
                </div>
                <div className="bg-background/50 p-3 rounded-lg border border-surfaceHighlight">
                    <span className="text-[10px] text-textMuted block mb-1 uppercase font-bold">Emergency SMS Template</span>
                    <textarea rows={2} value={emergencyMessage} onChange={(e) => setEmergencyMessage(e.target.value)} className="w-full bg-transparent border-none p-0 text-sm text-white focus:ring-0 resize-none placeholder:text-textMuted/30" />
                </div>
             </div>
          </div>

          <div>
             <label className="text-xs font-semibold text-textMuted uppercase tracking-wider block mb-3">General</label>
             <div className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded-lg border border-surfaceHighlight bg-background/50">
                    <span className="text-sm text-textMain">Full Screen</span>
                    <button onClick={toggleFullScreen} className="p-1.5 bg-surfaceHighlight/50 rounded-lg text-textMuted hover:text-white"><MaximizeIcon className="w-5 h-5" /></button>
                </div>
                <button onClick={() => { onClose(); onOpenCalibration(); }} className="w-full flex items-center justify-between p-3 rounded-lg border border-surfaceHighlight bg-background/50 hover:bg-surfaceHighlight/30 transition-colors group">
                    <span className="text-sm text-textMain">Calibrate Sensors</span>
                    <div className="text-textMuted group-hover:text-primary"><SettingsIcon className="w-5 h-5" /></div>
                </button>
             </div>
          </div>
          {showAdvanced && (
            <div className="animate-fade-in space-y-6 pt-4 border-t border-surfaceHighlight">
              <div>
                <label className="text-xs font-semibold text-textMuted uppercase tracking-wider block mb-3">Baud Rate</label>
                <div className="grid grid-cols-2 gap-2">
                  {[9600, 19200, 38400, 57600, 115200].map(rate => (
                    <button key={rate} onClick={() => !isConnected && setBaudRate(rate)} disabled={isConnected} className={`px-3 py-2 rounded-lg text-sm font-mono border ${baudRate === rate ? 'bg-primary text-white border-primary' : 'bg-transparent text-textMuted border-surfaceHighlight'}`}>{rate}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-textMuted uppercase tracking-wider block mb-3">Behavior</label>
                <div className="flex items-center justify-between p-3 rounded-lg border border-surfaceHighlight bg-background/50">
                  <span className="text-sm text-textMain">Allow Duplicates</span>
                  <button onClick={() => setAllowDuplicates(!allowDuplicates)} className={`w-10 h-6 rounded-full transition-colors relative ${allowDuplicates ? 'bg-accent' : 'bg-surfaceHighlight'}`}><div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${allowDuplicates ? 'left-5' : 'left-1'}`} /></button>
                </div>
              </div>
              <div className="pt-4 border-t border-surfaceHighlight">
                 <label className="text-xs font-semibold text-accent uppercase tracking-wider block mb-3">Remote / Wizard Mode</label>
                 <div className="bg-background/50 p-3 rounded-lg border border-surfaceHighlight mb-3">
                    <span className="text-[10px] text-textMuted block mb-1">THIS DEVICE ID (RECEIVER)</span>
                    <div className="flex items-center justify-between">
                       <span className="text-xl font-mono font-bold text-white">{myId || 'Loading...'}</span>
                       <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${remoteStatus === 'connected' ? 'bg-accent/20 text-accent' : 'bg-surfaceHighlight text-textMuted'}`}>{remoteStatus}</span>
                    </div>
                    <div className="mt-2 text-[8px] text-textMuted opacity-50 font-mono break-all select-all">{myId ? `${window.location.origin}/?target=${myId}` : 'Wait for ID...'}</div>
                 </div>
                 <div className="space-y-2">
                    <span className="text-[10px] text-textMuted block">CONNECT TO FRIEND (SENDER MODE)</span>
                    <div className="flex gap-2">
                      <input type="text" placeholder="Enter Friend's ID" className="flex-1 bg-background border border-surfaceHighlight rounded px-3 py-2 text-sm text-white focus:border-primary focus:outline-none" value={targetIdInput} onChange={(e) => setTargetIdInput(e.target.value)} />
                      <button onClick={() => onConnectRemote(targetIdInput)} className="bg-surfaceHighlight hover:bg-primary text-white text-xs px-3 rounded font-bold transition-colors">LINK</button>
                    </div>
                    {remoteStatus === 'connected' && (
                      <button onClick={onOpenSender} className="w-full mt-2 bg-primary hover:bg-primaryHover text-white py-3 rounded-lg font-bold text-sm shadow-lg animate-pulse">OPEN REMOTE CONTROLLER</button>
                    )}
                 </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const LiveDisplay: React.FC<{ message: SerialMessage | null }> = ({ message }) => (
    <div className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden bg-background">
      <div className="relative z-10 w-full text-center h-full flex flex-col justify-center">
        <p className={`text-xs md:text-sm font-medium uppercase tracking-[0.2em] mb-4 md:mb-8 flex-none ${message?.origin === 'user' ? 'text-primary' : 'text-textMuted'}`}>{message?.origin === 'user' ? 'You Said' : 'Detected Sign'}</p>
        {message ? (
          <div key={message.id} className="animate-slide-up px-4 flex-1 flex items-center justify-center">
            <h2 className="text-[clamp(3rem,8vw,6rem)] font-bold text-textMain break-words leading-tight drop-shadow-2xl tracking-tight">{message.text === '!!SOS_TRIGGER!!' ? 'EMERGENCY REQUEST' : message.text}</h2>
          </div>
        ) : (
          <div className="animate-pulse opacity-20 flex-1 flex items-center justify-center"><p className="text-5xl md:text-7xl font-bold text-textMain font-mono tracking-tighter">WAITING</p></div>
        )}
      </div>
    </div>
);

const HistoryLog: React.FC<{ history: SerialMessage[], onClear: () => void }> = ({ history, onClear }) => (
    <div className="flex-1 flex flex-col min-h-0 bg-surface/30 lg:bg-transparent overflow-hidden">
      <div className="flex items-center justify-between px-6 py-3 border-b border-surfaceHighlight bg-surface/50 lg:bg-transparent backdrop-blur-sm flex-none">
        <div className="flex items-center gap-2 text-textMuted"><HistoryIcon className="w-4 h-4" /><span className="text-xs font-semibold uppercase tracking-wider">Session Log</span></div>
        {history.length > 0 && <button onClick={onClear} className="p-1.5 hover:bg-surfaceHighlight rounded-md text-textMuted hover:text-danger transition-colors"><TrashIcon className="w-4 h-4" /></button>}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
        {history.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-textMuted opacity-30 gap-2"><HistoryIcon className="w-8 h-8" /><span className="text-sm">No signs detected</span></div> : history.map((msg) => (
            <div key={msg.id} className={`flex w-full animate-fade-in group ${msg.origin === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex flex-col max-w-[85%] ${msg.origin === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`px-4 py-2 rounded-2xl border transition-colors relative shadow-sm ${msg.origin === 'user' ? 'bg-primary/20 border-primary/30 rounded-tr-none text-right' : msg.text === '!!SOS_TRIGGER!!' ? 'bg-danger/20 border-danger rounded-tl-none' : 'bg-surfaceHighlight/30 border-transparent hover:border-surfaceHighlight/50 rounded-tl-none text-left'}`}>
                    <p className={`text-sm md:text-base font-medium break-words leading-snug ${msg.text === '!!SOS_TRIGGER!!' ? 'text-danger font-bold' : 'text-textMain'}`}>
                        {msg.text === '!!SOS_TRIGGER!!' ? '🚨 SOS EMERGENCY SIGNAL' : msg.text}
                    </p>
                  </div>
              </div>
            </div>
        ))}
      </div>
    </div>
);

const ControlBar: React.FC<{ isConnected: boolean; isConnecting: boolean; isSpeaking: boolean; isListening: boolean; onConnect: () => void; onDisconnect: () => void; onToggleSpeech: () => void; onToggleListening: () => void; }> = ({ isConnected, isConnecting, isSpeaking, isListening, onConnect, onDisconnect, onToggleSpeech, onToggleListening }) => (
  <div className="flex-none p-4 lg:p-6 bg-surface border-t border-surfaceHighlight flex items-center justify-between gap-3 safe-area-bottom z-20">
    <div className="flex gap-2">
      <button onClick={onToggleSpeech} className={`p-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 border ${isSpeaking ? 'bg-surfaceHighlight/50 border-surfaceHighlight text-textMain hover:bg-surfaceHighlight' : 'bg-transparent border-surfaceHighlight/50 text-textMuted hover:text-textMain'}`}>{isSpeaking ? <SpeakerOnIcon className="w-6 h-6" /> : <SpeakerOffIcon className="w-6 h-6" />}</button>
      <button onClick={onToggleListening} className={`p-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 border ${isListening ? 'bg-danger/20 border-danger text-danger hover:bg-danger/30 animate-pulse' : 'bg-transparent border-surfaceHighlight/50 text-textMuted hover:text-textMain'}`}>{isListening ? <MicIcon className="w-6 h-6" /> : <MicOffIcon className="w-6 h-6" />}</button>
    </div>
    <button onClick={isConnected ? onDisconnect : onConnect} disabled={isConnecting} className={`flex-1 py-4 px-6 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all duration-200 transform active:scale-[0.98] ${isConnected ? 'bg-surfaceHighlight text-danger border border-danger/20 hover:bg-danger/10' : 'bg-primary text-white hover:bg-primaryHover disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-primary/25'}`}>
      <UsbIcon className="w-6 h-6" /> {isConnecting ? 'Searching...' : (isConnected ? 'Disconnect' : 'Connect Device')}
    </button>
  </div>
);

// --- Main App ---

const App: React.FC = () => {
  const [baudRate, setBaudRate] = useState(9600);
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCalibrationOpen, setIsCalibrationOpen] = useState(false);
  const [showFakePicker, setShowFakePicker] = useState(false);
  const [isFakeConnected, setIsFakeConnected] = useState(false);
  
  // Safety SOS State
  const [emergencyContact, setEmergencyContact] = useState(() => localStorage.getItem('signspeak_sos_contact') || '');
  const [emergencyMessage, setEmergencyMessage] = useState(() => localStorage.getItem('signspeak_sos_message') || 'EMERGENCY! I need immediate help. I am using my SignSpeak glove.');
  const [isSosActive, setIsSosActive] = useState(false);

  // Persistence for SOS
  useEffect(() => { localStorage.setItem('signspeak_sos_contact', emergencyContact); }, [emergencyContact]);
  useEffect(() => { localStorage.setItem('signspeak_sos_message', emergencyMessage); }, [emergencyMessage]);

  // Serial Hook
  const { isSupported, isConnected: isSerialConnected, isConnecting, connect: serialConnect, disconnect: serialDisconnect, lastMessage, error, clearError } = useSerial({ baudRate });
  
  // Remote Hook (NEW ARCHITECTURE)
  const { myId, startHosting, connectToPeer, connectionStatus, sendData, lastRemoteMessage, remoteId } = useRemote();

  const [isSenderMode, setIsSenderMode] = useState(false);
  const [isSpeakingEnabled, setIsSpeakingEnabled] = useState(true);
  const [history, setHistory] = useState<SerialMessage[]>([]);
  const [currentDisplayMessage, setCurrentDisplayMessage] = useState<SerialMessage | null>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const lastProcessedText = useRef<string>('');
  
  // Effective connection for settings logic (Serial or Fake)
  const effectiveIsConnected = isSerialConnected || isFakeConnected;

  // Determine Header Indicator State based on priorities:
  // 1. Real Serial -> Green ('connected')
  // 2. Fake + Remote -> Green ('connected')
  // 3. Fake OR Remote -> Yellow ('partial')
  // 4. None -> Gray ('disconnected')
  let headerState: 'disconnected' | 'partial' | 'connected' = 'disconnected';
  const isRemoteConnected = connectionStatus === 'connected';

  if (isSerialConnected) {
    headerState = 'connected';
  } else if (isFakeConnected && isRemoteConnected) {
    headerState = 'connected';
  } else if (isFakeConnected || isRemoteConnected) {
    headerState = 'partial';
  }

  // --- INITIALIZATION LOGIC ---
  useEffect(() => {
    // 1. Check URL for target (Sender Mode)
    const params = new URLSearchParams(window.location.search);
    const target = params.get('target');

    if (target) {
        // We are a SENDER. We do NOT host an ID. We just connect.
        console.log("Mode: Sender (Client)");
        connectToPeer(target);
        setIsSenderMode(true);
    } else {
        // We are a RECEIVER. We MUST host an ID.
        // Get or create persistent ID
        console.log("Mode: Receiver (Host)");
        let savedId = localStorage.getItem('signspeak_my_id');
        if (!savedId) {
            savedId = Math.floor(1000 + Math.random() * 9000).toString();
            localStorage.setItem('signspeak_my_id', savedId);
        }
        startHosting(savedId);
    }
  }, []); // Run once on mount

  // Speech Recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true; recognition.interimResults = false; recognition.lang = 'en-US';
      recognition.onresult = (event: any) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        if (transcript.trim()) handleIncomingText(transcript, 'user');
      };
      recognition.onerror = (e: any) => { if (e.error === 'not-allowed') setIsListening(false); };
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) { recognitionRef.current.stop(); setIsListening(false); }
    else { try { recognitionRef.current.start(); setIsListening(true); } catch (e) { setIsListening(false); } }
  };

  const handleConnectClick = () => {
    if (connectionStatus === 'connected') setShowFakePicker(true); else serialConnect();
  };
  const handleDisconnectClick = () => {
    if (isFakeConnected) setIsFakeConnected(false); else serialDisconnect();
  };
  const onFakeConnectConfirm = () => { setShowFakePicker(false); setTimeout(() => setIsFakeConnected(true), 500); };

  const handleIncomingText = (text: string, origin: 'device' | 'user' = 'device') => {
    // SOS TRIGGER CHECK
    if (text === '!!SOS_TRIGGER!!' && origin === 'device') {
      setIsSosActive(true);
    }

    if (origin === 'device' && !allowDuplicates && text === lastProcessedText.current) return;
    const newMessage: SerialMessage = { id: crypto.randomUUID(), text: text, timestamp: Date.now(), origin: origin };
    if (origin === 'device') lastProcessedText.current = text;
    setCurrentDisplayMessage(newMessage);
    // Don't speak the SOS trigger via TTS, the alarm covers it
    if (isSpeakingEnabled && origin === 'device' && text !== '!!SOS_TRIGGER!!') speak(text);
    setHistory(prev => [newMessage, ...prev].slice(0, 30));
  };

  useEffect(() => { if (lastMessage) handleIncomingText(lastMessage.text, 'device'); }, [lastMessage]); 
  useEffect(() => { if (lastRemoteMessage) handleIncomingText(lastRemoteMessage.text, 'device'); }, [lastRemoteMessage]);

  const handleClearHistory = () => { setHistory([]); lastProcessedText.current = ''; setCurrentDisplayMessage(null); };

  if (isSenderMode) {
    return (
      <SenderView onSend={sendData} onExit={() => { setIsSenderMode(false); window.location.search = ''; }} targetId={remoteId || "Connecting..."} status={connectionStatus} />
    );
  }

  // Receiver View
  const renderMainContent = () => (
    <div className="h-[100dvh] w-full flex flex-col bg-background text-textMain overflow-hidden font-sans">
      <FakeSerialPicker isOpen={showFakePicker} onConnect={onFakeConnectConfirm} onCancel={() => setShowFakePicker(false)} />
      {/* SOS OVERLAY */}
      {isSosActive && <SosOverlay contact={emergencyContact} message={emergencyMessage} onCancel={() => setIsSosActive(false)} />}
      
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        baudRate={baudRate} 
        setBaudRate={setBaudRate} 
        isConnected={effectiveIsConnected} 
        allowDuplicates={allowDuplicates} 
        setAllowDuplicates={setAllowDuplicates} 
        emergencyContact={emergencyContact}
        setEmergencyContact={setEmergencyContact}
        emergencyMessage={emergencyMessage}
        setEmergencyMessage={setEmergencyMessage}
        myId={myId} 
        remoteStatus={connectionStatus} 
        onConnectRemote={(id) => { connectToPeer(id); setIsSenderMode(true); }} 
        onOpenSender={() => { setIsSenderMode(true); setIsSettingsOpen(false); }} 
        onOpenCalibration={() => setIsCalibrationOpen(true)} 
      />
      <CalibrationModal isOpen={isCalibrationOpen} onClose={() => setIsCalibrationOpen(false)} isConnected={effectiveIsConnected} />
      {error && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50 animate-slide-up w-11/12 max-w-md">
          <div className="bg-surface border border-danger/50 text-danger px-4 py-3 rounded-xl shadow-2xl flex items-center justify-between backdrop-blur-md">
            <span className="text-sm font-medium">{error}</span>
            <button onClick={clearError} className="p-1 hover:bg-white/5 rounded"><XIcon className="w-4 h-4" /></button>
          </div>
        </div>
      )}
      <Header connectionState={headerState} onOpenSettings={() => setIsSettingsOpen(true)} />
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        <div className="flex-none h-[45%] lg:h-auto lg:flex-1 lg:border-r border-surfaceHighlight relative">
          <LiveDisplay message={currentDisplayMessage} />
        </div>
        <div className="flex-1 lg:w-[400px] lg:flex-none flex flex-col bg-surface/20 lg:bg-surface/10 backdrop-blur-sm z-10 min-h-0">
          <HistoryLog history={history} onClear={handleClearHistory} />
          <ControlBar isConnected={effectiveIsConnected} isConnecting={isConnecting} isSpeaking={isSpeakingEnabled} isListening={isListening} onConnect={handleConnectClick} onDisconnect={handleDisconnectClick} onToggleSpeech={() => setIsSpeakingEnabled(!isSpeakingEnabled)} onToggleListening={toggleListening} />
        </div>
      </main>
    </div>
  );

  if (!isSupported) {
    return (
      <div className="h-[100dvh] bg-background flex flex-col items-center justify-center p-6 text-center relative">
        <button onClick={() => setIsSettingsOpen(true)} className="absolute top-4 right-4 p-2 text-textMuted hover:text-textMain"><SettingsIcon className="w-6 h-6" /></button>
        <SettingsModal 
          isOpen={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)} 
          baudRate={baudRate} 
          setBaudRate={setBaudRate} 
          isConnected={false} 
          allowDuplicates={allowDuplicates} 
          setAllowDuplicates={setAllowDuplicates} 
          emergencyContact={emergencyContact}
          setEmergencyContact={setEmergencyContact}
          emergencyMessage={emergencyMessage}
          setEmergencyMessage={setEmergencyMessage}
          myId={myId} 
          remoteStatus={connectionStatus} 
          onConnectRemote={(id) => { connectToPeer(id); setIsSenderMode(true); }} 
          onOpenSender={() => setIsSenderMode(true)} 
          onOpenCalibration={() => setIsCalibrationOpen(true)} 
        />
        <div className="w-20 h-20 bg-surfaceHighlight/50 rounded-3xl flex items-center justify-center mb-6 text-danger animate-pulse"><UsbIcon className="w-10 h-10" /></div>
        <h2 className="text-3xl font-bold text-textMain mb-3">USB Not Supported</h2>
        <p className="text-textMuted max-w-md leading-relaxed">Browser doesn't support Web Serial. Use as Remote Controller from top-right settings.</p>
      </div>
    );
  }
  return renderMainContent();
};

export default App;