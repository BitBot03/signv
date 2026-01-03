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

  // Handle physical disconnection events (cable unplugged)
  useEffect(() => {
    if (!isSupported) return;

    const handleDisconnect = (event: Event) => {
      const serialEvent = event as SerialConnectionEvent;
      if (port.current === serialEvent.port) {
        // The connected device was unplugged
        keepReading.current = false;
        setIsConnected(false);
        port.current = null;
        setError("Device disconnected");
      }
    };

    const nav = navigator as NavigatorWithSerial;
    nav.serial.addEventListener('disconnect', handleDisconnect);
    return () => {
      nav.serial.removeEventListener('disconnect', handleDisconnect);
    };
  }, [isSupported]);
  
  const processLine = useCallback((line: string) => {
    if (!line) return;
    // Create a unique message object even if text is identical to previous
    const newMessage: SerialMessage = {
      id: crypto.randomUUID(),
      text: line,
      timestamp: Date.now(),
      origin: 'device'
    };
    setLastMessage(newMessage);
  }, []);

  const readLoop = useCallback(async () => {
    while (port.current?.readable && keepReading.current) {
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
            if (readBuffer.current.trim()) {
              processLine(readBuffer.current.trim());
              readBuffer.current = '';
            }
            break;
          }
        }
      } catch (err) {
        if (err instanceof Error) {
            // "The device has been lost" is the standard error when unplugged
            if (err.message.includes('device has been lost') || err.name === 'NetworkError') {
               // Loop will restart but port.readable will likely be null or loop will exit next check
               keepReading.current = false;
            } else {
               console.error("Serial read error:", err);
               setError(`Read error: ${err.message}`);
            }
        }
      } finally {
        if (reader.current) {
            try {
                reader.current.releaseLock();
            } catch (e) { /* ignore */ }
            reader.current = null;
        }
      }
    }
    
    // If loop exits and we didn't intend to stop, update state
    if (!keepReading.current && isConnected) {
       setIsConnected(false);
       port.current = null;
    }
  }, [processLine, isConnected]);

  const connect = useCallback(async () => {
    if (!isSupported) return;
    setError(null);
    setIsConnecting(true);
    try {
      const navigatorWithSerial = navigator as NavigatorWithSerial;
      port.current = await navigatorWithSerial.serial.requestPort();
      await port.current.open({ baudRate });
      
      readBuffer.current = ''; 
      keepReading.current = true;
      setIsConnected(true);
      
      // Start reading without awaiting it so we don't block
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
  }, [baudRate, isSupported, readLoop]);

  const disconnect = useCallback(async () => {
    keepReading.current = false;
    
    // Close logic needs to be careful. 
    // We must first cancel the reader, then close port.
    if (reader.current) {
        try {
            await reader.current.cancel();
            // releaseLock handled in readLoop finally
        } catch(e) { /* ignore */ }
    }

    // Small delay to allow readLoop to exit lock
    setTimeout(async () => {
        if (port.current) {
            try {
                await port.current.close();
            } catch(e) { /* ignore */ }
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