import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import { createServer, type Server as HTTPServer } from 'http';
import { randomBytes } from 'crypto';
import { validateTokenPayload } from 'token-beam';

/** Icon provided by the source app — either a single unicode character or an SVG string. */
export type SyncIcon = { type: 'unicode'; value: string } | { type: 'svg'; value: string };

export interface SyncSession {
  id: string;
  token: string;
  webClient?: WebSocket;
  targetClients: Array<{ ws: WebSocket; type: string; origin?: string }>;
  webOrigin?: string;
  webIcon?: SyncIcon;
  createdAt: Date;
  lastActivity: Date;
}

export interface SyncMessage {
  type: 'pair' | 'sync' | 'ping' | 'error';
  sessionToken?: string;
  clientType?: string;
  origin?: string;
  icon?: SyncIcon;
  payload?: unknown;
  error?: string;
}

export class TokenSyncServer {
  private wss: WebSocketServer;
  private httpServer: HTTPServer;
  private sessions: Map<string, SyncSession> = new Map();
  private cleanupTimer?: ReturnType<typeof setInterval>;
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private readonly MAX_PAYLOAD_SIZE = 10 * 1024 * 1024; // 10MB - reasonable for design tokens with embedded assets
  
  // Blocked origins - manually curate commercial users
  private readonly BLOCKED_ORIGINS = [
    // Example: 'big-company-design-system.com',
    // Example: 'startup-ui-kit.io',
  ];

  constructor(private port: number = 8080) {
    this.httpServer = createServer((req, res) => {
      // Enable CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'ok',
            activeSessions: this.sessions.size,
            timestamp: new Date().toISOString(),
          }),
        );
      } else if (req.method === 'GET' && req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Token Sync Server is running');
      } else if (req.method === 'GET' && req.url === '/plugins.json') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify([
            {
              id: 'figma',
              name: 'Figma',
              url: 'https://github.com/meodai/token-sync/tree/main/packages/figma-plugin',
            },
            {
              id: 'sketch',
              name: 'Sketch',
              url: 'https://github.com/meodai/token-sync/tree/main/packages/sketch-plugin',
            },
            {
              id: 'aseprite',
              name: 'Aseprite',
              url: 'https://github.com/meodai/token-sync/tree/main/packages/aseprite-plugin',
            },
            {
              id: 'krita',
              name: 'Krita',
              url: 'https://github.com/meodai/token-sync/tree/main/packages/krita-plugin',
            },
            {
              id: 'adobe-xd',
              name: 'Adobe XD',
              url: 'https://github.com/meodai/token-sync/tree/main/packages/adobe-xd-plugin',
            },
          ]),
        );
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    this.wss = new WebSocketServer({ 
      server: this.httpServer,
      maxPayload: this.MAX_PAYLOAD_SIZE,
      verifyClient: (info: { origin: string; req: IncomingMessage }) => {
        // Check HTTP Origin header (set by browser, harder to fake)
        const origin = info.origin || info.req.headers.origin;
        if (origin && this.isOriginBlocked(origin)) {
          console.log(`Blocked connection from: ${origin}`);
          return false;
        }
        return true;
      },
    });
    this.setupWebSocket();
    this.startCleanupInterval();
  }

  private isOriginBlocked(origin: string): boolean {
    try {
      const hostname = new URL(origin).hostname;
      return this.BLOCKED_ORIGINS.some(blocked => 
        hostname === blocked || hostname.endsWith('.' + blocked)
      );
    } catch {
      return false;
    }
  }

  private setupWebSocket() {
    this.wss.on('connection', (ws: WebSocket, req) => {
      const httpOrigin = req.headers.origin;
      console.log('New WebSocket connection', { origin: httpOrigin });

      ws.on('message', (data: Buffer) => {
        // Check message size
        if (data.length > this.MAX_PAYLOAD_SIZE) {
          this.sendError(ws, 'Message too large');
          return;
        }

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

    if (!clientType) {
      this.sendError(ws, 'clientType is required');
      return;
    }

    // Also check user-provided origin (can be spoofed but good for logging)
    if (message.origin && this.isOriginBlocked(message.origin)) {
      console.log(`Blocked pairing from reported origin: ${message.origin}`);
      this.sendError(ws, 'Commercial use detected. Contact token-beam@elastiq.ch for licensing.');
      ws.close();
      return;
    }

    // Log origin for monitoring
    if (message.origin) {
      console.log(`Session paired with origin: ${message.origin}`);
    }

    // Web client creates new session
    if (clientType === 'web') {
      const token = this.generateToken();

      // Sanitize icon — warn client if it was rejected
      let webIcon: SyncIcon | undefined;
      if (message.icon) {
        webIcon = this.sanitizeIcon(message.icon);
        if (!webIcon) {
          console.log(`Rejected invalid icon from ${message.origin ?? 'unknown'}: type=${(message.icon as Record<string, unknown>).type}`);
          this.send(ws, {
            type: 'error',
            error: '[warn] Icon rejected: invalid or unsafe content. Unicode icons must be 1–3 visible characters. SVG icons must be under 10KB with no scripts or event handlers.',
          });
        }
      }

      const session: SyncSession = {
        id: this.generateSessionId(),
        token,
        webClient: ws,
        targetClients: [],
        webOrigin: message.origin,
        webIcon,
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

    // Target client (Figma, Aseprite, Sketch, etc.) joins existing session
    if (clientType !== 'web' && sessionToken) {
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

      // Send web origin + icon to target client so it knows who it's paired with
      this.send(ws, {
        type: 'pair',
        sessionToken,
        clientType,
        origin: session.webOrigin,
        icon: session.webIcon,
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
      // Validate payload before broadcasting
      const validation = validateTokenPayload(message.payload);
      if (!validation.success) {
        console.error('Invalid payload received:', validation.error);
        this.sendError(ws, 'Invalid payload structure');
        return;
      }

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
      // Web client disconnected - keep session until all targets disconnect
      session.webClient = undefined;
      for (const target of session.targetClients) {
        if (target.ws.readyState === WebSocket.OPEN) {
          this.sendError(target.ws, 'Web client disconnected');
        }
      }

      if (session.targetClients.length === 0) {
        this.sessions.delete(session.id);
        console.log(`Session ${session.token} ended (web disconnect)`);
      } else {
        console.log(`Web client disconnected from session ${session.token}`);
      }
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
      if (!session.webClient && session.targetClients.length === 0) {
        this.sessions.delete(session.id);
        console.log(`Session ${session.token} ended (last target disconnect)`);
      } else {
        console.log(`${disconnectedTarget?.type || 'Target'} client disconnected from session ${session.token}`);
      }
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

  /** Sanitize a client-provided icon, returning undefined if invalid. */
  private sanitizeIcon(icon: unknown): SyncIcon | undefined {
    if (!icon || typeof icon !== 'object') return undefined;
    const { type, value } = icon as Record<string, unknown>;
    if (typeof value !== 'string') return undefined;

    if (type === 'unicode') {
      // Allow at most a few codepoints (single grapheme cluster)
      const trimmed = value.trim();
      if (trimmed.length === 0 || [...trimmed].length > 3) return undefined;

      // Reject dangerous unicode: control chars, bidi overrides, zero-width chars, tag chars
      const forbidden = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF\uFFF9-\uFFFB]|\uDB40[\uDC01-\uDC7F]/;
      if (forbidden.test(trimmed)) return undefined;

      return { type: 'unicode', value: trimmed };
    }

    if (type === 'svg') {
      // Must look like an SVG element
      if (!value.trim().startsWith('<svg')) return undefined;

      // Strip anything dangerous: <script>, on* attributes, javascript: URLs,
      // <foreignObject>, <iframe>, <embed>, <object>, data: URIs, <use> with external hrefs
      let clean = value;
      // Remove <script>…</script> blocks
      clean = clean.replace(/<script[\s\S]*?<\/script\s*>/gi, '');
      // Remove standalone <script.../> or unclosed <script
      clean = clean.replace(/<script[^>]*\/?>/gi, '');
      // Remove on* event attributes (onclick, onload, onerror, etc.)
      clean = clean.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
      // Remove javascript: / data: in attribute values
      clean = clean.replace(/(?:href|xlink:href|src|action)\s*=\s*(?:"(?:javascript|data):[^"]*"|'(?:javascript|data):[^']*')/gi, '');
      // Remove <foreignObject>, <iframe>, <embed>, <object> elements
      clean = clean.replace(/<\/?(foreignObject|iframe|embed|object)[^>]*>/gi, '');
      // Remove <set>, <animate*> that can trigger JS via attributeName="href" etc.
      clean = clean.replace(/<\/?(set|animate\w*)[^>]*>/gi, '');

      // Cap size at 10KB for an icon
      if (clean.length > 10240) return undefined;

      return { type: 'svg', value: clean };
    }

    return undefined;
  }

  private generateToken(): string {
    // Generate 6 random bytes and convert to hex (12 chars)
    // Format: beam://XXXXXXXXXXXX
    const hex = randomBytes(6).toString('hex').toUpperCase();
    return `beam://${hex}`;
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${randomBytes(4).toString('hex')}`;
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
        console.log(`Token Beam Server running on port ${this.port}`);
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
          console.log('Token Beam Server stopped');
          resolve();
        });
      });
    });
  }
}
