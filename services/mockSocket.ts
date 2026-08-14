import { Peer, DataConnection } from 'peerjs';
import { Player, Room, GameType, RoomSettings, MovieCategory } from '../types';
import { DEFAULT_SETTINGS } from '../constants';

// Unique prefix to avoid collisions on the public PeerJS server
const PEER_ID_PREFIX = 'CHILLBRO_V1_';
const CONNECTION_TIMEOUT_MS = 15000;

// Expanded list of STUN servers for better mobile connectivity
const ICE_SERVERS = [
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
];

type EventCallback = (data: any) => void;

class RealGameService {
  private static instance: RealGameService;
  private peer: Peer | null = null;
  private connections: DataConnection[] = []; // List of connected peers (if Host)
  private connectionMap = new Map<DataConnection, string>(); // Map Connection -> PlayerID
  private hostConnection: DataConnection | null = null; // Connection to Host (if Client)
  private room: Room | null = null;
  private listeners: Function[] = []; // Room state listeners
  private eventListeners: Record<string, EventCallback[]> = {}; // Specific event listeners (e.g. 'draw')
  private playerId: string | null = null;

  private constructor() {}

  public static getInstance(): RealGameService {
    if (!RealGameService.instance) {
      RealGameService.instance = new RealGameService();
    }
    return RealGameService.instance;
  }

  // --- Connection & Room Management ---

  private generateRoomCode(): string {
    // Exclude I, 1, O, 0 to avoid confusion
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; 
    let result = '';
    for (let i = 0; i < 5; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  public async createRoom(hostPlayer: Player, gameType: GameType): Promise<string> {
    this.playerId = hostPlayer.id;
    const roomCode = this.generateRoomCode();
    const peerId = `${PEER_ID_PREFIX}${roomCode}`;
    
    // Initialize Room State
    this.room = {
      code: roomCode,
      players: [hostPlayer],
      gameType,
      settings: { ...DEFAULT_SETTINGS[gameType], category: MovieCategory.ENGLISH },
      currentRound: 0,
      maxRounds: DEFAULT_SETTINGS[gameType].rounds,
      state: 'WAITING',
    };

    return new Promise((resolve) => {
      let isResolved = false;
      const finish = () => {
        if (isResolved) return;
        isResolved = true;
        this.notify();
        resolve(roomCode);
      };

      // Fallback timeout if PeerJS signaling is slow or unreachable in sandbox
      const timeout = setTimeout(() => {
        console.warn('PeerJS host signaling timed out; continuing in local host mode.');
        finish();
      }, 3000);

      try {
        if (this.peer) {
          try { this.peer.destroy(); } catch {}
        }

        this.peer = new Peer(peerId, { 
          debug: 1,
          config: {
              iceServers: ICE_SERVERS
          }
        });

        this.peer.on('open', (id) => {
          console.log('Host created room with Peer ID:', id);
          clearTimeout(timeout);
          finish();
        });

        this.peer.on('connection', (conn) => {
          console.log('Host received connection from:', conn.peer);
          this.handleConnection(conn);
        });

        this.peer.on('error', (err) => {
          console.warn('Peer host notice/error:', err);
          clearTimeout(timeout);
          finish();
        });
        
        this.peer.on('disconnected', () => {
          try { this.peer?.reconnect(); } catch {}
        });
      } catch (err) {
        console.warn('Error setting up host peer:', err);
        clearTimeout(timeout);
        finish();
      }
    });
  }

  public async joinRoom(player: Player, code: string): Promise<boolean> {
    this.playerId = player.id;
    // Ensure code is upper case and trimmed
    const cleanCode = code.toUpperCase().trim();
    const peerIdToConnect = `${PEER_ID_PREFIX}${cleanCode}`;
    
    return new Promise((resolve) => {
      // Clean up previous connection if exists
      if (this.peer) {
          this.peer.destroy();
          this.peer = null;
      }

      this.peer = new Peer(undefined, {
          debug: 1,
          config: {
            iceServers: ICE_SERVERS
        }
      }); 

      let connectionTimeout: any;
      let isResolved = false;

      // Safe resolve wrapper to prevent multiple calls
      const finish = (result: boolean) => {
          if (isResolved) return;
          isResolved = true;
          clearTimeout(connectionTimeout);
          if (!result) {
              this.reset();
          }
          resolve(result);
      };

      // Set explicit timeout
      connectionTimeout = setTimeout(() => {
          console.error("Connection timed out - Host not reachable");
          finish(false);
      }, CONNECTION_TIMEOUT_MS);

      this.peer.on('open', () => {
        console.log('Client Peer initialized. Connecting to:', peerIdToConnect);
        
        // Connect to host
        const conn = this.peer!.connect(peerIdToConnect, { 
            reliable: true,
            serialization: 'json', // CRITICAL: Ensure consistent serialization (fixes mobile/desktop issues)
            metadata: { player }   // Send player info in metadata as backup
        });

        conn.on('open', () => {
          console.log('Connection to host OPEN.');
          this.hostConnection = conn;
          
          // CRITICAL: Delay sending data slightly to allow WebRTC channel to fully stabilize.
          // This fixes the "Connecting..." hang where the JOIN message is lost.
          setTimeout(() => {
              console.log('Sending JOIN request...');
              this.sendToHost({ type: 'JOIN', payload: player });
          }, 800);
          
          // Wait for STATE_UPDATE to confirm we are in
          conn.on('data', (data) => {
               this.handleData(data);
               
               // If we receive the room state, we are successfully joined
               if ((data as any).type === 'STATE_UPDATE') {
                   finish(true);
               }
          });
        });

        conn.on('error', (err) => {
          console.error('Connection error:', err);
          finish(false);
        });
        
        conn.on('close', () => {
            console.log("Connection closed by host");
            this.room = null;
            this.notify();
            finish(false);
        });
      });
      
      this.peer.on('error', (err) => {
          console.error("Peer Error", err);
          // @ts-ignore
          if (err.type === 'peer-unavailable') {
              console.error("Room code not found or host offline");
          }
          finish(false);
      });
    });
  }

  // --- Host Logic: Handle Incoming Connections ---

  private handleConnection(conn: DataConnection) {
    this.connections.push(conn);

    conn.on('data', (data) => {
      this.handleHostData(data, conn);
    });

    conn.on('open', () => {
        // Backup: If explicit JOIN message fails, try to use metadata if available
        if (conn.metadata && conn.metadata.player) {
            console.log("Connection opened with metadata player:", conn.metadata.player.name);
            // We wait a moment for the explicit JOIN, but if needed we could register here.
            // For now, let's just log it.
        }
    });

    conn.on('close', () => {
      // Remove from connection list
      this.connections = this.connections.filter(c => c !== conn);
      
      // Identify who disconnected
      const disconnectedPlayerId = this.connectionMap.get(conn);
      
      if (disconnectedPlayerId && this.room) {
          console.log(`Player ${disconnectedPlayerId} disconnected`);
          
          // Remove player from room
          this.room.players = this.room.players.filter(p => p.id !== disconnectedPlayerId);
          this.connectionMap.delete(conn);
          
          // Broadcast updated state to remaining players
          this.broadcastState();
      }
    });
    
    conn.on('error', (err) => {
        console.error("Host connection error:", err);
        conn.close();
    });
  }

  // --- Data Handling ---

  private handleHostData(data: any, sender: DataConnection) {
    if (!this.room) return;
    const { type, payload } = data;

    switch (type) {
      case 'JOIN':
        console.log("Host received JOIN request:", payload.name);
        
        // Map connection to player ID for disconnect handling
        this.connectionMap.set(sender, payload.id);

        // Check duplicate
        const existingPlayerIndex = this.room.players.findIndex(p => p.id === payload.id);
        if (existingPlayerIndex === -1) {
            this.room.players.push(payload);
        } else {
            // Update existing player info (reconnect scenario)
            this.room.players[existingPlayerIndex] = payload;
        }

        // CRITICAL: Send state immediately back to the joiner
        // Use sender directly to ensure response goes to the right person
        sender.send({ type: 'STATE_UPDATE', payload: this.room });
            
        // Then update everyone else
        this.broadcastState();
        break;
      
      case 'UPDATE_SETTINGS':
        this.room.settings = { ...this.room.settings, ...payload };
        this.broadcastState();
        break;

      case 'START_GAME':
        this.room.state = 'PLAYING';
        this.room.currentRound = 1;
        this.broadcastState();
        break;

      case 'NEXT_ROUND':
        if (this.room.currentRound < this.room.maxRounds) {
            this.room.currentRound++;
        } else {
            this.room.state = 'FINISHED';
        }
        this.broadcastState();
        break;

      case 'UPDATE_SCORE':
        const player = this.room.players.find(p => p.id === payload.playerId);
        if (player) {
            player.score += payload.points;
            this.broadcastState();
        }
        break;

      case 'DRAW_EVENT':
        // Broadcast draw events to everyone EXCEPT sender
        this.connections.forEach(conn => {
            if (conn !== sender && conn.open) conn.send({ type: 'DRAW_EVENT', payload });
        });
        // Also trigger local event for Host
        this.triggerEvent('DRAW_EVENT', payload);
        break;
        
      case 'CHAT':
          this.broadcast({ type: 'CHAT', payload });
          this.triggerEvent('CHAT', payload);
          break;
    }
  }

  private handleData(data: any) {
    const { type, payload } = data;

    if (type === 'STATE_UPDATE') {
      this.room = payload;
      this.notify();
    } else {
      // Pass specific events (DRAW, CHAT) to subscribers
      this.triggerEvent(type, payload);
    }
  }

  private broadcastState() {
    this.broadcast({ type: 'STATE_UPDATE', payload: this.room });
    this.notify(); // Update local host UI
  }

  private broadcast(data: any) {
    this.connections.forEach(conn => {
        if(conn.open) conn.send(data);
    });
  }

  private sendToHost(data: any) {
    if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send(data);
    } else {
        console.warn("Cannot send to host, connection not open");
    }
  }

  // --- Public API for UI Components ---

  public updateSettings(settings: Partial<RoomSettings>) {
    if (this.hostConnection) {
      this.sendToHost({ type: 'UPDATE_SETTINGS', payload: settings });
    } else if (this.room) {
      this.room.settings = { ...this.room.settings, ...settings };
      this.broadcastState();
    }
  }

  public startGame() {
    if (this.hostConnection) {
        this.sendToHost({ type: 'START_GAME' });
    } else {
        this.handleHostData({ type: 'START_GAME' }, null as any);
    }
  }

  public nextRound() {
    if (this.hostConnection) {
        this.sendToHost({ type: 'NEXT_ROUND' });
    } else {
        this.handleHostData({ type: 'NEXT_ROUND' }, null as any);
    }
  }

  public updateScore(playerId: string, points: number) {
    if (this.hostConnection) {
        this.sendToHost({ type: 'UPDATE_SCORE', payload: { playerId, points } });
    } else {
        this.handleHostData({ type: 'UPDATE_SCORE', payload: { playerId, points } }, null as any);
    }
  }

  public sendDrawEvent(eventData: any) {
      if (this.hostConnection) {
          this.sendToHost({ type: 'DRAW_EVENT', payload: eventData });
      } else {
          // Host drawing: broadcast to all
          this.broadcast({ type: 'DRAW_EVENT', payload: eventData });
      }
  }
  
  public sendChat(msg: any) {
      if(this.hostConnection) {
          this.sendToHost({ type: 'CHAT', payload: msg });
      } else {
          this.handleHostData({ type: 'CHAT', payload: msg }, null as any);
      }
  }

  public addBot(name?: string, avatar?: string) {
    if (!this.room) return;
    const BOT_NAMES = ['PixelFox', 'QuizWhiz', 'ChillBot', 'CyberPanda', 'NeonKoala', 'TurboCat'];
    const BOT_AVATARS = ['🤖', '🦊', '🐱', '🐼', '🐨', '🦄', '🐙'];
    const botId = `bot_${Math.random().toString(36).substring(2, 8)}`;
    const randomName = name || BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    const randomAvatar = avatar || BOT_AVATARS[Math.floor(Math.random() * BOT_AVATARS.length)];
    
    const botPlayer: Player = {
      id: botId,
      name: `${randomName}`,
      avatar: randomAvatar,
      score: 0,
      isHost: false,
    };

    this.room.players.push(botPlayer);
    this.broadcastState();
  }

  public removePlayer(playerId: string) {
    if (!this.room) return;
    this.room.players = this.room.players.filter(p => p.id !== playerId);
    this.broadcastState();
  }

  public getRoom(): Room | null {
    return this.room;
  }
  
  public reset() {
      if (this.peer) {
          this.peer.destroy();
          this.peer = null;
      }
      this.room = null;
      this.connections = [];
      this.connectionMap.clear();
      this.hostConnection = null;
      this.notify();
  }

  // --- Pub/Sub ---

  public subscribe(callback: Function) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  public onEvent(event: string, callback: EventCallback) {
      if (!this.eventListeners[event]) {
          this.eventListeners[event] = [];
      }
      this.eventListeners[event].push(callback);
      return () => {
          this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
      };
  }

  private notify() {
    this.listeners.forEach(cb => cb(this.room));
  }
  
  private triggerEvent(event: string, payload: any) {
      if (this.eventListeners[event]) {
          this.eventListeners[event].forEach(cb => cb(payload));
      }
  }
}

export const socket = RealGameService.getInstance();