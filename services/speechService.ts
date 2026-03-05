let voices: SpeechSynthesisVoice[] = [];

// Helper to update voices list
const loadVoices = () => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    voices = window.speechSynthesis.getVoices();
  }
};

// Initialize voice loading
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoices();
  // Chrome loads voices asynchronously
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
}

export const initTTS = () => {
  if ('speechSynthesis' in window) {
    // Calling getVoices triggers loading in some browsers
    loadVoices();
    // Play a silent short sound to unlock audio context on mobile
    const utterance = new SpeechSynthesisUtterance(" ");
    utterance.volume = 0;
    utterance.rate = 10; // Fast
    window.speechSynthesis.speak(utterance);
  }
};

export const speak = (text: string) => {
  if ('speechSynthesis' in window && text) {
    // Cancel any ongoing speech to avoid overlap/queue buildup
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    // Explicitly try to select a high-quality English voice
    if (voices.length === 0) loadVoices();
    
    if (voices.length > 0) {
       // Priority: Google US English -> Any US English -> Any English -> Default
       const preferredVoice = voices.find(v => v.name.includes("Google US English")) || 
                              voices.find(v => v.lang === 'en-US') || 
                              voices.find(v => v.lang.startsWith('en'));
                              
       if (preferredVoice) {
         utterance.voice = preferredVoice;
       }
    }
    
    window.speechSynthesis.speak(utterance);
  } else {
    console.warn('Text-to-speech not supported or no text provided.');
  }
};