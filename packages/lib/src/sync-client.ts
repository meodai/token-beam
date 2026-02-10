export interface SyncMessage<T = unknown> {
  type: 'pair' | 'sync' | 'ping' | 'error';
  sessionToken?: string;
  clientType?: string;
  origin?: string;
  payload?: T;
  error?: string;
}

export interface SyncClientOptions<T = unknown> {
  serverUrl: string;
  clientType: string;
  sessionToken?: string;
  /** Display name for this client (e.g. "Token Sync Demo"). Defaults to location.hostname. */
  origin?: string;
  onPaired?: (token: string, origin?: string) => void;
  onTargetConnected?: (clientType: string, origin?: string) => void;
  onSync?: (payload: T) => void;
  onError?: (error: string) => void;
  onDisconnected?: () => void;
  onConnected?: () => void;
}

export class SyncClient<T = unknown> {
  private ws?: WebSocket;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private pingTimer?: ReturnType<typeof setInterval>;
  private connectionTimeout?: ReturnType<typeof setTimeout>;
  private manualDisconnect = false;
  private reconnectAttempts = 0;
  private readonly INITIAL_RECONNECT_DELAY = 1000;
  private readonly MAX_RECONNECT_DELAY = 30000;
  private readonly PING_INTERVAL = 30000;
  private readonly CONNECTION_TIMEOUT = 10000;

  constructor(private readonly options: SyncClientOptions<T>) {}

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.manualDisconnect = false;
        
        // Clean up existing connection if any
        if (this.ws) {
          this.ws.onclose = null;
          this.ws.onerror = null;
          this.ws.onmessage = null;
          this.ws.close();
          this.ws = undefined;
        }
        
        this.ws = new WebSocket(this.options.serverUrl);
        
        // Set connection timeout
        this.connectionTimeout = setTimeout(() => {
          if (this.ws?.readyState !== WebSocket.OPEN) {
            this.ws?.close();
            reject(new Error('Connection timeout'));
          }
        }, this.CONNECTION_TIMEOUT);

        this.ws.onopen = () => {
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = undefined;
          }
          
          // Reset reconnect attempts on successful connection
          this.reconnectAttempts = 0;
          
          this.options.onConnected?.();

          const resolvedOrigin =
            this.options.origin ??
            (typeof location !== 'undefined' ? location.hostname : undefined);

          this.send({
            type: 'pair',
            clientType: this.options.clientType,
            sessionToken: this.options.sessionToken,
            origin: resolvedOrigin,
          });

          this.startPing();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: SyncMessage<T> = JSON.parse(event.data);
            this.handleMessage(message);
          } catch {
            // ignore malformed messages
          }
        };

        this.ws.onerror = () => {
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = undefined;
          }
          reject(new Error('WebSocket connection failed'));
        };

        this.ws.onclose = () => {
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = undefined;
          }
          this.options.onDisconnected?.();
          this.stopPing();
          if (!this.manualDisconnect) {
            this.scheduleReconnect();
          }
        };
      } catch (error) {
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = undefined;
        }
        reject(error);
      }
    });
  }

  private handleMessage(message: SyncMessage<T>) {
    switch (message.type) {
      case 'pair':
        if (message.sessionToken) {
          // We received our session token (+ origin of paired client, if any)
          this.options.onPaired?.(message.sessionToken, message.origin);
        } else if (message.clientType) {
          // Another client joined our session
          this.options.onTargetConnected?.(message.clientType, message.origin);
        }
        break;

      case 'sync':
        if (message.payload) {
          this.options.onSync?.(message.payload);
        }
        break;

      case 'error':
        if (message.error) {
          this.options.onError?.(message.error);
        }
        break;

      case 'ping':
        break;
    }
  }

  public sync(payload: T) {
    this.send({ type: 'sync', payload });
  }

  private send(message: SyncMessage<T>) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private startPing() {
    this.pingTimer = setInterval(() => {
      this.send({ type: 'ping' });
    }, this.PING_INTERVAL);
  }

  private stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = undefined;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;

    this.reconnectAttempts++;
    
    // Exponential backoff: min(1000 * 2^attempts, 30000)
    const delay = Math.min(
      this.INITIAL_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts - 1),
      this.MAX_RECONNECT_DELAY
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect().catch(() => {
        // Will schedule another reconnect via onclose handler
      });
    }, delay);
  }

  public disconnect() {
    this.manualDisconnect = true;
    this.reconnectAttempts = 0;
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = undefined;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
  }

  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
