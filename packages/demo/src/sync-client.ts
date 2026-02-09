import type { FigmaCollectionPayload } from 'token-sync';

export type ClientType = 'web' | 'figma';

export interface SyncMessage {
  type: 'pair' | 'sync' | 'ping' | 'error';
  sessionToken?: string;
  clientType?: ClientType;
  payload?: FigmaCollectionPayload;
  error?: string;
}

export interface SyncClientOptions {
  serverUrl: string;
  clientType: ClientType;
  sessionToken?: string;
  onPaired?: (token: string) => void;
  onSync?: (payload: FigmaCollectionPayload) => void;
  onError?: (error: string) => void;
  onDisconnected?: () => void;
  onConnected?: () => void;
}

export class SyncClient {
  private ws?: WebSocket;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private pingTimer?: ReturnType<typeof setInterval>;
  private readonly RECONNECT_DELAY = 3000;
  private readonly PING_INTERVAL = 30000;

  constructor(private options: SyncClientOptions) {}

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.options.serverUrl);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.options.onConnected?.();
          
          // Send pair request
          this.send({
            type: 'pair',
            clientType: this.options.clientType,
            sessionToken: this.options.sessionToken,
          });

          // Start ping interval
          this.startPing();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: SyncMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.options.onDisconnected?.();
          this.stopPing();
          this.scheduleReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleMessage(message: SyncMessage) {
    switch (message.type) {
      case 'pair':
        if (message.sessionToken && this.options.clientType === 'web') {
          this.options.onPaired?.(message.sessionToken);
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
        // Ping response received
        break;
    }
  }

  public sync(payload: FigmaCollectionPayload) {
    this.send({
      type: 'sync',
      payload,
    });
  }

  private send(message: SyncMessage) {
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
      console.log('Attempting to reconnect...');
      this.reconnectTimer = undefined;
      this.connect().catch((error) => {
        console.error('Reconnection failed:', error);
      });
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
