import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import { createServer, type Server as HTTPServer } from 'http';
import { randomBytes } from 'crypto';
import { pluginLinks, validateTokenPayload } from 'token-beam';
import type { SyncMessage, SyncIcon } from 'token-beam';

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

export class TokenSyncServer {
  private wss: WebSocketServer;
  private httpServer: HTTPServer;
  private sessions: Map<string, SyncSession> = new Map();
  private tokenToSessionId: Map<string, string> = new Map();
  private clientToSessionId: Map<WebSocket, string> = new Map();
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
        res.end('Token Beam Sync Server is running');
      } else if (req.method === 'GET' && req.url === '/plugins.json') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(pluginLinks));
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
      return this.BLOCKED_ORIGINS.some(
        (blocked) => hostname === blocked || hostname.endsWith('.' + blocked),
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

    // Web client — rejoin existing session or create new one
    if (clientType === 'web') {
      // If the web client provides a session token, try to rejoin
      if (sessionToken) {
        const existing = this.getSessionByToken(sessionToken);
        if (existing && !existing.webClient) {
          // Rejoin: restore the web client on the existing session
          existing.webClient = ws;
          existing.lastActivity = new Date();
          this.clientToSessionId.set(ws, existing.id);

          // Update origin and icon if provided
          if (message.origin) existing.webOrigin = message.origin;
          if (message.icon) {
            const webIcon = this.sanitizeIcon(message.icon);
            if (webIcon) existing.webIcon = webIcon;
          }

          this.send(ws, {
            type: 'pair',
            sessionToken: existing.token,
            clientType: 'web',
          });

          // Notify connected targets that web client is back
          for (const target of existing.targetClients) {
            if (target.ws.readyState === WebSocket.OPEN) {
              this.send(target.ws, {
                type: 'pair',
                clientType: 'web',
                origin: existing.webOrigin,
                icon: existing.webIcon,
              });
            }
          }

          console.log(`Web client rejoined session: ${existing.token}`);
          return;
        }
        // Token invalid or session already has a web client — fall through to create new
      }

      const token = this.generateToken();

      // Sanitize icon — warn client if it was rejected
      let webIcon: SyncIcon | undefined;
      if (message.icon) {
        webIcon = this.sanitizeIcon(message.icon);
        if (!webIcon) {
          console.log(
            `Rejected invalid icon from ${message.origin ?? 'unknown'}: type=${(message.icon as Record<string, unknown>).type}`,
          );
          this.sendWarning(
            ws,
            'Icon rejected: invalid or unsafe content. Unicode icons must be 1–3 visible characters. SVG icons must be under 10KB with no scripts or event handlers.',
          );
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
      this.tokenToSessionId.set(session.token, session.id);
      this.clientToSessionId.set(ws, session.id);

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
      const session = this.getSessionByToken(sessionToken);

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
      this.clientToSessionId.set(ws, session.id);
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

      console.log(
        `${clientType} client joined session: ${sessionToken} (${session.targetClients.length} target clients)`,
      );
      return;
    }

    this.sendError(ws, 'Invalid pair request');
  }

  private handleSync(ws: WebSocket, message: SyncMessage) {
    const session = this.getSessionByClient(ws);

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
      // Validate payload from target client before forwarding
      const targetValidation = validateTokenPayload(message.payload);
      if (!targetValidation.success) {
        console.error('Invalid payload from target client:', targetValidation.error);
        this.sendError(ws, 'Invalid payload structure');
        return;
      }

      // Send to web client
      if (session.webClient && session.webClient.readyState === WebSocket.OPEN) {
        this.send(session.webClient, {
          type: 'sync',
          payload: message.payload,
        });
        const targetType = session.targetClients.find((t) => t.ws === ws)?.type || 'unknown';
        console.log(`Synced from ${targetType} to web`);
      } else {
        this.sendError(ws, 'Web client not connected');
      }
    }
  }

  private handlePing(ws: WebSocket, _message: SyncMessage) {
    const session = this.getSessionByClient(ws);
    if (session) {
      session.lastActivity = new Date();
    }
    this.send(ws, { type: 'ping' });
  }

  private handleDisconnect(ws: WebSocket) {
    const session = this.getSessionByClient(ws);

    if (!session) return;

    this.clientToSessionId.delete(ws);

    if (ws === session.webClient) {
      // Web client disconnected - keep session for potential rejoin
      session.webClient = undefined;
      for (const target of session.targetClients) {
        if (target.ws.readyState === WebSocket.OPEN) {
          this.send(target.ws, {
            type: 'peer-disconnected',
            clientType: 'web',
            reason: 'Web client disconnected',
          });
        }
      }

      if (session.targetClients.length === 0) {
        this.removeSession(session.id);
        console.log(`Session ${session.token} ended (web disconnect)`);
      } else {
        console.log(`Web client disconnected from session ${session.token}`);
      }
    } else {
      // Target client disconnected - remove from array
      const disconnectedTarget = session.targetClients.find((t) => t.ws === ws);
      session.targetClients = session.targetClients.filter((t) => t.ws !== ws);

      if (disconnectedTarget && session.webClient?.readyState === WebSocket.OPEN) {
        this.send(session.webClient, {
          type: 'peer-disconnected',
          clientType: disconnectedTarget.type,
          reason: `${disconnectedTarget.type} client disconnected`,
        });
      }
      if (!session.webClient && session.targetClients.length === 0) {
        this.removeSession(session.id);
        console.log(`Session ${session.token} ended (last target disconnect)`);
      } else {
        console.log(
          `${disconnectedTarget?.type || 'Target'} client disconnected from session ${session.token}`,
        );
      }
    }
  }

  private getSessionByToken(token: string): SyncSession | undefined {
    const sessionId = this.tokenToSessionId.get(token);
    if (!sessionId) return undefined;
    return this.sessions.get(sessionId);
  }

  private getSessionByClient(ws: WebSocket): SyncSession | undefined {
    const sessionId = this.clientToSessionId.get(ws);
    if (!sessionId) return undefined;
    return this.sessions.get(sessionId);
  }

  private removeSession(sessionId: string): SyncSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    this.sessions.delete(sessionId);
    this.tokenToSessionId.delete(session.token);

    if (session.webClient) {
      this.clientToSessionId.delete(session.webClient);
    }
    for (const target of session.targetClients) {
      this.clientToSessionId.delete(target.ws);
    }

    return session;
  }

  private send(ws: WebSocket, message: SyncMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: WebSocket, error: string) {
    this.send(ws, { type: 'error', error });
  }

  private sendWarning(ws: WebSocket, warning: string) {
    this.send(ws, { type: 'warning', warning });
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
      const forbidden =
        /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF\uFFF9-\uFFFB]|\uDB40[\uDC01-\uDC7F]/;
      if (forbidden.test(trimmed)) return undefined;

      return { type: 'unicode', value: trimmed };
    }

    if (type === 'svg') {
      // Must look like an SVG element
      if (!value.trim().startsWith('<svg')) return undefined;

      // Strip anything dangerous
      let clean = value;
      // Remove <script>…</script> blocks
      clean = clean.replace(/<script[\s\S]*?<\/script\s*>/gi, '');
      // Remove standalone <script.../> or unclosed <script
      clean = clean.replace(/<script[^>]*\/?>/gi, '');
      // Remove <style>…</style> blocks (can contain url(), expression(), etc.)
      clean = clean.replace(/<style[\s\S]*?<\/style\s*>/gi, '');
      clean = clean.replace(/<style[^>]*\/?>/gi, '');
      // Remove on* event attributes (onclick, onload, onerror, etc.)
      // Use [\s/] prefix to catch attributes after whitespace or in self-closing tags
      clean = clean.replace(/[\s/]+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
      // Remove javascript: / data: in any attribute value
      clean = clean.replace(
        /(?:href|xlink:href|src|action)\s*=\s*(?:"(?:javascript|data):[^"]*"|'(?:javascript|data):[^']*')/gi,
        '',
      );
      // Remove <foreignObject>, <iframe>, <embed>, <object> elements
      clean = clean.replace(/<\/?(foreignObject|iframe|embed|object)[^>]*>/gi, '');
      // Remove <set>, <animate*> that can trigger JS via attributeName="href" etc.
      clean = clean.replace(/<\/?(set|animate\w*)[^>]*>/gi, '');
      // Remove <use> elements with external references (http://, https://, //, data:)
      clean = clean.replace(
        /<use[^>]*(?:href|xlink:href)\s*=\s*(?:"(?:https?:|\/\/|data:)[^"]*"|'(?:https?:|\/\/|data:)[^']*')[^>]*\/?>/gi,
        '',
      );
      // Remove inline style attributes containing url() (can exfiltrate data)
      clean = clean.replace(
        /\s+style\s*=\s*(?:"[^"]*url\s*\([^)]*\)[^"]*"|'[^']*url\s*\([^)]*\)[^']*')/gi,
        '',
      );

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
      const expiredSessionIds = Array.from(this.sessions.entries())
        .filter(([, session]) => now - session.lastActivity.getTime() > this.SESSION_TIMEOUT)
        .map(([id]) => id);

      for (const sessionId of expiredSessionIds) {
        const session = this.removeSession(sessionId);
        if (!session) continue;

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
        console.log(`Session ${session.token} expired and removed`);
      }
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
    this.tokenToSessionId.clear();
    this.clientToSessionId.clear();

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
