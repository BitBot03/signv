import { useState, useEffect, useRef, useCallback } from 'react';

// Declare PeerJS global
declare const Peer: any;

export interface RemoteMessage {
  text: string;
}

export const useRemote = () => {
  const [myId, setMyId] = useState<string>('');
  const [remoteId, setRemoteId] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [lastRemoteMessage, setLastRemoteMessage] = useState<RemoteMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const peerRef = useRef<any>(null);
  const connRef = useRef<any>(null);
  const targetIdRef = useRef<string | null>(null); 
  const mountedRef = useRef(true);

  // --- 1. SETUP PEER ---
  const initializePeer = useCallback((preferredId?: string) => {
    if (peerRef.current) return;

    // Host Mode: Use "sg-v2-" + preferredId
    // Client Mode: Use undefined (Random ID)
    const peerId = preferredId ? `sg-v2-${preferredId}` : undefined;
    
    console.log(`[Peer] Init: ${peerId || 'Auto'}`);

    const peer = new Peer(peerId, {
      debug: 1, // Log errors
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });

    peer.on('open', (id: string) => {
      if (!mountedRef.current) return;
      console.log(`[Peer] READY. My ID: ${id}`);
      setMyId(preferredId || id);
      setError(null);

      // If we are a Client waiting to connect, DO IT NOW.
      if (targetIdRef.current) {
        attemptConnection(targetIdRef.current);
      }
    });

    peer.on('connection', (conn: any) => {
      console.log(`[Peer] Incoming connection from: ${conn.peer}`);
      // Host Logic: Accept connection, kill old one if exists
      if (connRef.current) {
          try { connRef.current.close(); } catch(e){}
      }
      setupConnectionHandlers(conn);
    });

    peer.on('error', (err: any) => {
      console.error(`[Peer] Error:`, err);
      if (err.type === 'unavailable-id' && preferredId) {
          // Retry hosting if ID taken
          console.warn("[Peer] ID Collision. Restarting...");
          peer.destroy();
          setTimeout(() => {
             peerRef.current = null;
             initializePeer(preferredId);
          }, 1500);
      }
    });

    peer.on('disconnected', () => {
       console.warn("[Peer] Disconnected from server. Reconnecting...");
       if (!peer.destroyed) peer.reconnect();
    });

    peerRef.current = peer;
  }, []);

  // --- 2. CONNECT (Client) ---
  const connectToPeer = useCallback((targetId: string) => {
    if (!targetId) return;
    
    targetIdRef.current = targetId;
    setConnectionStatus('connecting');
    setRemoteId(targetId);

    // If peer exists, connect. If not, init first.
    if (peerRef.current && !peerRef.current.destroyed) {
        attemptConnection(targetId);
    } else {
        initializePeer(); 
    }
  }, [initializePeer]);


  const attemptConnection = (target: string) => {
      if (!peerRef.current || peerRef.current.destroyed) return;

      const fullTargetId = `sg-v2-${target}`;
      console.log(`[Peer] Connecting to ${fullTargetId}...`);

      // Cleanup old
      if (connRef.current) {
          connRef.current.close();
      }

      try {
          // Serialization: json is crucial for compatibility
          const conn = peerRef.current.connect(fullTargetId, { 
              reliable: true,
              serialization: 'json'
          });
          
          if (!conn) {
              console.error("[Peer] Connect failed to return object");
              return;
          }

          setupConnectionHandlers(conn);
          
      } catch (e) {
          console.error("[Peer] Connect Exception", e);
      }
  };

  // --- 3. HANDLERS ---
  const setupConnectionHandlers = (conn: any) => {
      connRef.current = conn;

      conn.on('open', () => {
          console.log(`[Peer] >>> CHANNEL OPEN with ${conn.peer}`);
          setConnectionStatus('connected');
          setRemoteId(conn.peer.replace('sg-v2-', ''));
          setError(null);
      });

      conn.on('data', (data: any) => {
          console.log("[Peer] Data:", data);
          if (data && data.text) {
              setLastRemoteMessage({ text: data.text });
          }
      });

      conn.on('close', () => {
          console.log("[Peer] Connection Closed");
          setConnectionStatus('disconnected');
          connRef.current = null;
      });

      // Handle connection errors (e.g. peer not found)
      conn.on('error', (err: any) => {
          console.error("[Peer] Connection Error:", err);
          setConnectionStatus('disconnected');
      });
  };

  const sendData = useCallback((text: string) => {
    if (connRef.current && connRef.current.open) {
      connRef.current.send({ text });
    }
  }, []);

  const startHosting = useCallback((id: string) => {
      initializePeer(id);
  }, [initializePeer]);

  // --- 4. ROBUST RETRY LOOP ---
  useEffect(() => {
      mountedRef.current = true;
      
      const retryLoop = setInterval(() => {
          if (!mountedRef.current) return;

          // Only retry if we WANT to be connected (Client Mode)
          if (targetIdRef.current) {
               const isConnected = connRef.current && connRef.current.open;
               
               if (!isConnected) {
                   console.log("[Peer] Status check: Disconnected. Retrying...");
                   
                   // Check if Peer is dead
                   if (peerRef.current && peerRef.current.disconnected && !peerRef.current.destroyed) {
                       peerRef.current.reconnect();
                   } 
                   // Check if Peer is missing
                   else if (!peerRef.current) {
                       initializePeer();
                   }
                   // If Peer is healthy, try connect
                   else if (peerRef.current && !peerRef.current.destroyed) {
                       attemptConnection(targetIdRef.current);
                   }
               }
          }
      }, 2000); // Retry every 2 seconds

      return () => {
          mountedRef.current = false;
          clearInterval(retryLoop);
          if (connRef.current) connRef.current.close();
          if (peerRef.current) peerRef.current.destroy();
      };
  }, []); // Run once, relies on refs

  return {
    myId,
    startHosting,
    connectToPeer,
    connectionStatus,
    sendData,
    lastRemoteMessage,
    error,
    remoteId
  };
};