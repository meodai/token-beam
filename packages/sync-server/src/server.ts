import { WebSocketServer, WebSocket } from 'ws';
import { createServer, type Server as HTTPServer } from 'http';

export interface SyncSession {
  id: string;
  token: string;
  webClient?: WebSocket;
  targetClients: Array<{ ws: WebSocket; type: string; origin?: string }>;
  webOrigin?: string;
  createdAt: Date;
  lastActivity: Date;
}

export interface SyncMessage {
  type: 'pair' | 'sync' | 'ping' | 'error';
  sessionToken?: string;
  clientType?: 'web' | 'figma' | 'aseprite';
  origin?: string;
  payload?: unknown;
  error?: string;
}

export class TokenSyncServer {
  private wss: WebSocketServer;
  private httpServer: HTTPServer;
  private sessions: Map<string, SyncSession> = new Map();
  private cleanupTimer?: ReturnType<typeof setInterval>;
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  constructor(private port: number = 8080) {
    this.httpServer = createServer((req, res) => {
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'ok',
            activeSessions: this.sessions.size,
            timestamp: new Date().toISOString(),
          }),
        );
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    this.wss = new WebSocketServer({ server: this.httpServer });
    this.setupWebSocket();
    this.startCleanupInterval();
  }

  private setupWebSocket() {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('New WebSocket connection');

      ws.on('message', (data: Buffer) => {
        try {
          const message: SyncMessage = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          this.sendError(ws, 'Invalid message format');
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });
  }

  private handleMessage(ws: WebSocket, message: SyncMessage) {
    switch (message.type) {
      case 'pair':
        this.handlePair(ws, message);
        break;
      case 'sync':
        this.handleSync(ws, message);
        break;
      case 'ping':
        this.handlePing(ws, message);
        break;
      default:
        this.sendError(ws, 'Unknown message type');
    }
  }

  private handlePair(ws: WebSocket, message: SyncMessage) {
    const { sessionToken, clientType } = message;

    if (!clientType || (clientType !== 'web' && clientType !== 'figma' && clientType !== 'aseprite')) {
      this.sendError(ws, 'Invalid client type. Must be "web", "figma", or "aseprite"');
      return;
    }

    // Web client creates new session
    if (clientType === 'web') {
      const token = this.generateToken();
      const session: SyncSession = {
        id: this.generateSessionId(),
        token,
        webClient: ws,
        targetClients: [],
        webOrigin: message.origin,
        createdAt: new Date(),
        lastActivity: new Date(),
      };
      this.sessions.set(session.id, session);

      this.send(ws, {
        type: 'pair',
        sessionToken: token,
        clientType: 'web',
      });

      console.log(`Web client paired with token: ${token}`);
      return;
    }

    // Target client (Figma, Aseprite, etc.) joins existing session
    if ((clientType === 'figma' || clientType === 'aseprite') && sessionToken) {
      const session = Array.from(this.sessions.values()).find((s) => s.token === sessionToken);

      if (!session) {
        this.sendError(ws, 'Invalid session token');
        return;
      }

      // Add to target clients
      session.targetClients.push({
        ws,
        type: clientType,
        origin: message.origin,
      });
      session.lastActivity = new Date();

      // Send web origin to target client so it knows who it's paired with
      this.send(ws, {
        type: 'pair',
        sessionToken,
        clientType,
        origin: session.webOrigin,
      });

      // Notify web client that a new target connected
      if (session.webClient && session.webClient.readyState === WebSocket.OPEN) {
        this.send(session.webClient, {
          type: 'pair',
          clientType,
          origin: message.origin,
        });
      }

      console.log(`${clientType} client joined session: ${sessionToken} (${session.targetClients.length} target clients)`);
      return;
    }

    this.sendError(ws, 'Invalid pair request');
  }

  private handleSync(ws: WebSocket, message: SyncMessage) {
    const session = this.findSessionByClient(ws);

    if (!session) {
      this.sendError(ws, 'No active session');
      return;
    }

    session.lastActivity = new Date();

    const isFromWeb = ws === session.webClient;

    if (isFromWeb) {
      // Broadcast to all target clients
      let sentCount = 0;
      for (const target of session.targetClients) {
        if (target.ws.readyState === WebSocket.OPEN) {
          this.send(target.ws, {
            type: 'sync',
            payload: message.payload,
          });
          sentCount++;
        }
      }
      console.log(`Synced from web to ${sentCount} target client(s)`);
    } else {
      // Send to web client
      if (session.webClient && session.webClient.readyState === WebSocket.OPEN) {
        this.send(session.webClient, {
          type: 'sync',
          payload: message.payload,
        });
        const targetType = session.targetClients.find(t => t.ws === ws)?.type || 'unknown';
        console.log(`Synced from ${targetType} to web`);
      } else {
        this.sendError(ws, 'Web client not connected');
      }
    }
  }

  private handlePing(ws: WebSocket, _message: SyncMessage) {
    const session = this.findSessionByClient(ws);
    if (session) {
      session.lastActivity = new Date();
    }
    this.send(ws, { type: 'ping' });
  }

  private handleDisconnect(ws: WebSocket) {
    const session = this.findSessionByClient(ws);

    if (!session) return;

    if (ws === session.webClient) {
      // Web client disconnected - clean up session
      for (const target of session.targetClients) {
        if (target.ws.readyState === WebSocket.OPEN) {
          this.sendError(target.ws, 'Web client disconnected');
          target.ws.close();
        }
      }
      this.sessions.delete(session.id);
      console.log(`Session ${session.token} ended (web disconnect)`);
    } else {
      // Target client disconnected - remove from array
      const disconnectedTarget = session.targetClients.find(t => t.ws === ws);
      session.targetClients = session.targetClients.filter(t => t.ws !== ws);
      
      if (disconnectedTarget && session.webClient?.readyState === WebSocket.OPEN) {
        this.send(session.webClient, {
          type: 'error',
          error: `${disconnectedTarget.type} client disconnected`,
        });
      }
      console.log(`${disconnectedTarget?.type || 'Target'} client disconnected from session ${session.token}`);
    }
  }

  private findSessionByClient(ws: WebSocket): SyncSession | undefined {
    return Array.from(this.sessions.values()).find(
      (s) => s.webClient === ws || s.targetClients.some(t => t.ws === ws),
    );
  }

  private send(ws: WebSocket, message: SyncMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: WebSocket, error: string) {
    this.send(ws, { type: 'error', error });
  }

  private generateToken(): string {
    return `dts://${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private startCleanupInterval() {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      const sessionsToDelete: string[] = [];

      for (const [id, session] of this.sessions) {
        if (now - session.lastActivity.getTime() > this.SESSION_TIMEOUT) {
          sessionsToDelete.push(id);
          if (session.webClient?.readyState === WebSocket.OPEN) {
            this.sendError(session.webClient, 'Session expired');
            session.webClient.close();
          }
          for (const target of session.targetClients) {
            if (target.ws.readyState === WebSocket.OPEN) {
              this.sendError(target.ws, 'Session expired');
              target.ws.close();
            }
          }
        }
      }

      sessionsToDelete.forEach((id) => {
        const session = this.sessions.get(id);
        console.log(`Session ${session?.token} expired and removed`);
        this.sessions.delete(id);
      });
    }, 60000); // Check every minute
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer.listen(this.port, () => {
        console.log(`Token Sync Server running on port ${this.port}`);
        console.log(`WebSocket: ws://localhost:${this.port}`);
        console.log(`Health check: http://localhost:${this.port}/health`);
        resolve();
      });
    });
  }

  public stop(): Promise<void> {
    // Stop the cleanup timer
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    // Close all active connections so wss.close() doesn't hang
    for (const session of this.sessions.values()) {
      if (session.webClient?.readyState === WebSocket.OPEN) {
        session.webClient.close();
      }
      for (const target of session.targetClients) {
        if (target.ws.readyState === WebSocket.OPEN) {
          target.ws.close();
        }
      }
    }
    this.sessions.clear();

    // Terminate any remaining connections not tracked in sessions
    for (const client of this.wss.clients) {
      client.terminate();
    }

    return new Promise((resolve) => {
      this.wss.close(() => {
        this.httpServer.close(() => {
          console.log('Token Sync Server stopped');
          resolve();
        });
      });
    });
  }
}
