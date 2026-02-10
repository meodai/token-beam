export interface SyncMessage<T = unknown> {
  type: 'pair' | 'sync' | 'ping' | 'error';
  sessionToken?: string;
  clientType?: string;
  payload?: T;
  error?: string;
}

export interface SyncClientOptions<T = unknown> {
  serverUrl: string;
  clientType: string;
  sessionToken?: string;
  onPaired?: (token: string) => void;
  onTargetConnected?: (clientType: string) => void;
  onSync?: (payload: T) => void;
  onError?: (error: string) => void;
  onDisconnected?: () => void;
  onConnected?: () => void;
}

export class SyncClient<T = unknown> {
  private ws?: WebSocket;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private pingTimer?: ReturnType<typeof setInterval>;
  private readonly RECONNECT_DELAY = 3000;
  private readonly PING_INTERVAL = 30000;

  constructor(private options: SyncClientOptions<T>) {}

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.options.serverUrl);

        this.ws.onopen = () => {
          this.options.onConnected?.();

          this.send({
            type: 'pair',
            clientType: this.options.clientType,
            sessionToken: this.options.sessionToken,
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

        this.ws.onerror = () => reject(new Error('WebSocket connection failed'));

        this.ws.onclose = () => {
          this.options.onDisconnected?.();
          this.stopPing();
          this.scheduleReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleMessage(message: SyncMessage<T>) {
    switch (message.type) {
      case 'pair':
        if (message.sessionToken) {
          // We received our own session token (session creator)
          this.options.onPaired?.(message.sessionToken);
        } else if (message.clientType) {
          // Another client joined our session
          this.options.onTargetConnected?.(message.clientType);
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

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect().catch(() => {});
    }, this.RECONNECT_DELAY);
  }

  public disconnect() {
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
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
