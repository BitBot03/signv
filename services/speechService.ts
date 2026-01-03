export const speak = (text: string) => {
  if ('speechSynthesis' in window && text) {
    // Cancel any ongoing speech to avoid overlap
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    window.speechSynthesis.speak(utterance);
  } else {
    console.warn('Text-to-speech not supported or no text provided.');
  }
};