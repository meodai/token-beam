import { isWarningError, normalizeSessionToken } from './consumer';
import type { SyncClientOptions, SyncIcon } from './sync-client';
import { SyncClient } from './sync-client';

export const DEFAULT_SYNC_SERVER_URL = 'wss://tokenbeam.dev';

export type SessionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'paired'
  | 'disconnected'
  | 'error';

export interface SessionPeer {
  clientType: string;
  origin?: string;
}

export interface SessionStateEvent {
  previous: SessionState;
  current: SessionState;
}

export interface SessionPairedEvent {
  sessionToken: string;
  origin?: string;
  icon?: SyncIcon;
}

export interface SessionPeerConnectedEvent extends SessionPeer {}

export interface SessionPeerDisconnectedEvent {
  clientType: string;
  reason: string;
}

export interface SessionSyncEvent<TPayload> {
  payload: TPayload;
}

export interface SessionErrorEvent {
  message: string;
}

export interface SessionWarningEvent {
  message: string;
}

export interface SessionEvents<TPayload> {
  state: SessionStateEvent;
  connected: undefined;
  disconnected: undefined;
  paired: SessionPairedEvent;
  'peer-connected': SessionPeerConnectedEvent;
  'peer-disconnected': SessionPeerDisconnectedEvent;
  sync: SessionSyncEvent<TPayload>;
  warning: SessionWarningEvent;
  error: SessionErrorEvent;
}

type SessionEventHandler<TPayload, TEventName extends keyof SessionEvents<TPayload>> = (
  event: SessionEvents<TPayload>[TEventName],
) => void;

class TypedEmitter<TPayload> {
  private handlers = new Map<
    keyof SessionEvents<TPayload>,
    Set<SessionEventHandler<TPayload, keyof SessionEvents<TPayload>>>
  >();

  public on<TEventName extends keyof SessionEvents<TPayload>>(
    eventName: TEventName,
    handler: SessionEventHandler<TPayload, TEventName>,
  ): () => void {
    const handlerSet =
      this.handlers.get(eventName) ??
      new Set<SessionEventHandler<TPayload, keyof SessionEvents<TPayload>>>();
    handlerSet.add(handler as SessionEventHandler<TPayload, keyof SessionEvents<TPayload>>);
    this.handlers.set(eventName, handlerSet);

    return () => {
      this.off(eventName, handler);
    };
  }

  public off<TEventName extends keyof SessionEvents<TPayload>>(
    eventName: TEventName,
    handler: SessionEventHandler<TPayload, TEventName>,
  ) {
    const handlerSet = this.handlers.get(eventName);
    if (!handlerSet) return;

    handlerSet.delete(handler as SessionEventHandler<TPayload, keyof SessionEvents<TPayload>>);
    if (handlerSet.size === 0) {
      this.handlers.delete(eventName);
    }
  }

  public emit<TEventName extends keyof SessionEvents<TPayload>>(
    eventName: TEventName,
    event: SessionEvents<TPayload>[TEventName],
  ) {
    const handlerSet = this.handlers.get(eventName);
    if (!handlerSet) return;
    for (const handler of handlerSet) {
      handler(event);
    }
  }
}

export interface SessionOptions<TPayload = unknown> {
  serverUrl: string;
  clientType: string;
  sessionToken?: string;
  origin?: string;
  icon?: SyncIcon;
}

export interface SourceSessionOptions<TPayload = unknown> extends Omit<
  SessionOptions<TPayload>,
  'serverUrl' | 'sessionToken'
> {
  serverUrl?: string;
  sessionToken?: string;
}

export interface TargetSessionOptions<TPayload = unknown> extends Omit<
  SessionOptions<TPayload>,
  'serverUrl'
> {
  serverUrl?: string;
  sessionToken: string;
}

const CLIENT_DISCONNECTED_PATTERN = /^([a-z0-9-]+) client disconnected$/i;

class SessionBase<TPayload = unknown> {
  private readonly events = new TypedEmitter<TPayload>();
  private syncClient: SyncClient<TPayload> | null = null;
  private state: SessionState = 'idle';
  private sessionToken?: string;
  private readonly peers = new Map<string, SessionPeer>();

  constructor(private readonly options: SessionOptions<TPayload>) {
    this.sessionToken = options.sessionToken;
  }

  public on<TEventName extends keyof SessionEvents<TPayload>>(
    eventName: TEventName,
    handler: SessionEventHandler<TPayload, TEventName>,
  ) {
    return this.events.on(eventName, handler);
  }

  public off<TEventName extends keyof SessionEvents<TPayload>>(
    eventName: TEventName,
    handler: SessionEventHandler<TPayload, TEventName>,
  ) {
    this.events.off(eventName, handler);
  }

  public getState(): SessionState {
    return this.state;
  }

  public getSessionToken(): string | undefined {
    return this.sessionToken;
  }

  public getPeers(): SessionPeer[] {
    return Array.from(this.peers.values());
  }

  public hasPeers(): boolean {
    return this.peers.size > 0;
  }

  public isPaired(): boolean {
    return !!this.sessionToken;
  }

  public setSessionToken(rawSessionToken: string): boolean {
    const normalized = normalizeSessionToken(rawSessionToken);
    if (!normalized) return false;
    this.sessionToken = normalized;
    return true;
  }

  public async connect() {
    if (this.syncClient?.isConnected()) {
      return;
    }

    const normalizedToken =
      this.sessionToken !== undefined ? normalizeSessionToken(this.sessionToken) : undefined;
    if (this.sessionToken !== undefined && !normalizedToken) {
      const message = 'Invalid session token format';
      this.setState('error');
      this.events.emit('error', { message });
      throw new Error(message);
    }
    if (normalizedToken) {
      this.sessionToken = normalizedToken;
    }

    this.setState('connecting');

    const syncClientOptions: SyncClientOptions<TPayload> = {
      serverUrl: this.options.serverUrl,
      clientType: this.options.clientType,
      sessionToken: this.sessionToken,
      origin: this.options.origin,
      icon: this.options.icon,
      onConnected: () => {
        this.setState('connected');
        this.events.emit('connected', undefined);
      },
      onDisconnected: () => {
        this.setState('disconnected');
        this.events.emit('disconnected', undefined);
      },
      onPaired: (token, origin, icon) => {
        this.sessionToken = normalizeSessionToken(token) ?? token;
        this.setState('paired');
        this.events.emit('paired', {
          sessionToken: this.sessionToken,
          origin,
          icon,
        });
      },
      onTargetConnected: (clientType, origin) => {
        const peer: SessionPeer = { clientType, origin };
        this.peers.set(this.peerKey(peer), peer);
        this.events.emit('peer-connected', peer);
      },
      onSync: (payload) => {
        this.events.emit('sync', { payload });
      },
      onError: (errorMessage) => {
        if (isWarningError(errorMessage)) {
          this.events.emit('warning', { message: errorMessage });
          return;
        }

        const disconnectedClientType = this.extractDisconnectedClientType(errorMessage);
        if (disconnectedClientType) {
          this.removePeerByType(disconnectedClientType);
          this.events.emit('peer-disconnected', {
            clientType: disconnectedClientType,
            reason: errorMessage,
          });
          return;
        }

        this.setState('error');
        this.events.emit('error', { message: errorMessage });
      },
    };

    this.syncClient = new SyncClient(syncClientOptions);
    await this.syncClient.connect();
  }

  public disconnect() {
    this.syncClient?.disconnect();
    this.syncClient = null;
    this.peers.clear();
    this.setState('idle');
  }

  public sync(payload: TPayload) {
    if (!this.syncClient) {
      throw new Error('Cannot sync before connecting');
    }
    this.syncClient.sync(payload);
  }

  private setState(nextState: SessionState) {
    if (this.state === nextState) return;
    const previousState = this.state;
    this.state = nextState;
    this.events.emit('state', { previous: previousState, current: nextState });
  }

  private peerKey(peer: SessionPeer): string {
    return `${peer.clientType}:${peer.origin ?? ''}`;
  }

  private removePeerByType(clientType: string) {
    for (const [key, peer] of this.peers.entries()) {
      if (peer.clientType === clientType) {
        this.peers.delete(key);
      }
    }
  }

  private extractDisconnectedClientType(errorMessage: string): string | null {
    const match = CLIENT_DISCONNECTED_PATTERN.exec(errorMessage.trim());
    if (!match) return null;
    return match[1];
  }
}

export class SourceSession<TPayload = unknown> extends SessionBase<TPayload> {
  constructor(options: SourceSessionOptions<TPayload>) {
    super({
      ...options,
      serverUrl: options.serverUrl ?? DEFAULT_SYNC_SERVER_URL,
    });
  }
}

export class TargetSession<TPayload = unknown> extends SessionBase<TPayload> {
  constructor(options: TargetSessionOptions<TPayload>) {
    super({
      ...options,
      serverUrl: options.serverUrl ?? DEFAULT_SYNC_SERVER_URL,
    });
  }
}
