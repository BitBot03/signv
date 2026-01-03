import { useState, useRef, useCallback, useEffect } from 'react';

export interface SerialMessage {
  id: string;
  text: string;
  timestamp: number;
  origin?: 'device' | 'user'; // 'device' = Arduino/Remote, 'user' = Voice input
}

interface SerialOptions {
  baudRate: number;
}

interface SerialPort extends EventTarget {
    readable: ReadableStream<Uint8Array>;
    writable: WritableStream<Uint8Array>;
    open(options: { baudRate: number }): Promise<void>;
    close(): Promise<void>;
}

interface SerialConnectionEvent extends Event {
  port: SerialPort;
}

interface NavigatorWithSerial extends Navigator {
    serial: {
        requestPort(options?: any): Promise<SerialPort>;
        getPorts(): Promise<SerialPort[]>;
        addEventListener(type: string, listener: (this: EventTarget, ev: Event) => any): void;
        removeEventListener(type: string, listener: (this: EventTarget, ev: Event) => any): void;
    };
}

export const useSerial = ({ baudRate }: SerialOptions) => {
  const [isSupported, setIsSupported] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // We store only the very last packet received. App logic handles history.
  const [lastMessage, setLastMessage] = useState<SerialMessage | null>(null);

  const port = useRef<SerialPort | null>(null);
  const reader = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const keepReading = useRef(false);
  const readBuffer = useRef(''); 
  const textDecoder = useRef(new TextDecoder()); 
  const baudRateRef = useRef(baudRate); // Keep ref for auto-reconnects

  useEffect(() => {
    baudRateRef.current = baudRate;
  }, [baudRate]);

  useEffect(() => {
    if ('serial' in navigator) {
      setIsSupported(true);
    }
    
    // Cleanup on unmount
    return () => {
      keepReading.current = false;
      if (port.current) {
        port.current.close().catch(() => {});
      }
    };
  }, []);

  const processLine = useCallback((line: string) => {
    if (!line) return;
    const newMessage: SerialMessage = {
      id: crypto.randomUUID(),
      text: line,
      timestamp: Date.now(),
      origin: 'device'
    };
    setLastMessage(newMessage);
  }, []);

  const readLoop = useCallback(async () => {
    if (!port.current || !port.current.readable) return;

    while (port.current.readable && keepReading.current) {
      try {
        reader.current = port.current.readable.getReader();
        while (true) {
          const { value, done } = await reader.current.read();
          
          if (value) {
            readBuffer.current += textDecoder.current.decode(value, { stream: true });
            let newlineIndex;
            while ((newlineIndex = readBuffer.current.indexOf('\n')) !== -1) {
              const line = readBuffer.current.substring(0, newlineIndex).trim();
              readBuffer.current = readBuffer.current.substring(newlineIndex + 1);
              processLine(line);
            }
          }

          if (done) {
            break;
          }
        }
      } catch (err) {
        if (err instanceof Error) {
            // NetworkError/DeviceLost are normal on unplug
            if (!err.message.includes('device has been lost') && err.name !== 'NetworkError') {
               console.error("Serial read error:", err);
            }
            // Stop reading loop
            keepReading.current = false;
        }
      } finally {
        if (reader.current) {
            try { reader.current.releaseLock(); } catch (e) {}
            reader.current = null;
        }
      }
    }
    
    // Ensure state reflects disconnect if loop exits naturally
    if (isConnected) {
       setIsConnected(false);
       port.current = null;
    }
  }, [processLine, isConnected]);

  // --- NATIVE-LIKE AUTO CONNECT LOGIC ---
  const attemptAutoConnect = useCallback(async () => {
      const nav = navigator as NavigatorWithSerial;
      if (!nav.serial || port.current) return; // Already connected or not supported

      try {
          // Check for devices we already have permission for
          const ports = await nav.serial.getPorts();
          if (ports.length > 0) {
              console.log("Auto-connecting to known device...");
              setIsConnecting(true);
              
              // Take the first available port (Native App behavior)
              port.current = ports[0];
              await port.current.open({ baudRate: baudRateRef.current });
              
              readBuffer.current = '';
              keepReading.current = true;
              setIsConnected(true);
              setError(null);
              
              // Start reading
              readLoop();
          }
      } catch (err: any) {
          console.error("Auto-connect failed:", err);
          // Don't set global error on auto-connect failure, just stay disconnected
          setIsConnected(false);
          port.current = null;
      } finally {
          setIsConnecting(false);
      }
  }, [readLoop]);

  // 1. Check for devices on App Launch (Native feel)
  useEffect(() => {
      if (isSupported && !isConnected) {
          attemptAutoConnect();
      }
  }, [isSupported, attemptAutoConnect]);

  // 2. Handle Plug/Unplug Events (Native feel)
  useEffect(() => {
    if (!isSupported) return;

    const nav = navigator as NavigatorWithSerial;

    const handleConnect = (event: Event) => {
       // Device plugged in (and we have permission from a previous session)
       console.log("Device plugged in");
       if (!isConnected) {
           attemptAutoConnect();
       }
    };

    const handleDisconnect = (event: Event) => {
      const serialEvent = event as SerialConnectionEvent;
      if (port.current === serialEvent.port) {
        console.log("Device unplugged");
        keepReading.current = false;
        setIsConnected(false);
        port.current = null;
        setError("Device disconnected");
      }
    };

    nav.serial.addEventListener('connect', handleConnect);
    nav.serial.addEventListener('disconnect', handleDisconnect);

    return () => {
      nav.serial.removeEventListener('connect', handleConnect);
      nav.serial.removeEventListener('disconnect', handleDisconnect);
    };
  }, [isSupported, isConnected, attemptAutoConnect]);

  // --- MANUAL CONNECT (The "Connect" Button) ---
  const connect = useCallback(async () => {
    if (!isSupported) return;
    setError(null);
    setIsConnecting(true);
    try {
      const navigatorWithSerial = navigator as NavigatorWithSerial;
      // Request user to select device (Native Permission Popup)
      const selectedPort = await navigatorWithSerial.serial.requestPort();
      
      port.current = selectedPort;
      await port.current.open({ baudRate: baudRateRef.current });
      
      readBuffer.current = ''; 
      keepReading.current = true;
      setIsConnected(true);
      
      readLoop();

    } catch (err) {
      if (err instanceof Error) {
        if (err.name !== 'NotFoundError') { // NotFoundError = user cancelled selection
           setError(`Connection failed: ${err.message}`);
        }
      }
      setIsConnected(false);
    } finally {
        setIsConnecting(false);
    }
  }, [isSupported, readLoop]);

  const disconnect = useCallback(async () => {
    keepReading.current = false;
    
    if (reader.current) {
        try { await reader.current.cancel(); } catch(e) {}
    }

    setTimeout(async () => {
        if (port.current) {
            try { await port.current.close(); } catch(e) {}
            port.current = null;
        }
        setIsConnected(false);
        readBuffer.current = '';
    }, 100);

  }, []);

  return { 
    isSupported, 
    isConnected, 
    isConnecting, 
    connect, 
    disconnect, 
    lastMessage,
    error,
    clearError: () => setError(null)
  };
};