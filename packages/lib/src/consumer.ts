import { validateTokenPayload } from './schema';
import type { SyncMessage } from './sync-client';
import type { DesignToken, TokenSyncPayload, TokenType } from './types';

type SyncMessageType = SyncMessage['type'];

const SYNC_MESSAGE_TYPES: readonly SyncMessageType[] = [
  'pair',
  'sync',
  'ping',
  'error',
  'warning',
  'peer-disconnected',
];
const SESSION_TOKEN_PATTERN = /^(?:beam:\/\/)?([0-9a-f]+)$/i;
const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export interface TokenPath {
  collectionName: string;
  modeName: string;
  token: DesignToken;
}

export interface ColorTokenPath extends TokenPath {
  hex: string;
}

export function normalizeSessionToken(rawToken: string): string | null {
  const trimmed = rawToken.trim();
  if (!trimmed) return null;

  const match = SESSION_TOKEN_PATTERN.exec(trimmed);
  if (!match) return null;

  return `beam://${match[1].toUpperCase()}`;
}

export function isWarningError(error: string): boolean {
  return error.startsWith('[warn]');
}

export function isSyncMessage<T = unknown>(value: unknown): value is SyncMessage<T> {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SyncMessage<T>>;
  return typeof candidate.type === 'string' && SYNC_MESSAGE_TYPES.includes(candidate.type);
}

export function parseSyncMessage<T = unknown>(raw: string): SyncMessage<T> | null {
  try {
    const message = JSON.parse(raw);
    return isSyncMessage<T>(message) ? message : null;
  } catch {
    return null;
  }
}

export function flattenPayload(payload: unknown): TokenPath[] {
  const parsed = validateTokenPayload(payload);
  if (!parsed.success) return [];

  const result: TokenPath[] = [];
  for (const collection of parsed.data.collections) {
    for (const mode of collection.modes) {
      for (const token of mode.tokens) {
        result.push({
          collectionName: collection.name,
          modeName: mode.name,
          token,
        });
      }
    }
  }
  return result;
}

export function filterPayloadByType(
  payload: unknown,
  allowedTypes: readonly TokenType[],
): TokenSyncPayload | null {
  const parsed = validateTokenPayload(payload);
  if (!parsed.success) return null;

  const filteredCollections = parsed.data.collections
    .map((collection) => ({
      name: collection.name,
      modes: collection.modes
        .map((mode) => ({
          name: mode.name,
          tokens: mode.tokens.filter((token) => allowedTypes.includes(token.type)),
        }))
        .filter((mode) => mode.tokens.length > 0),
    }))
    .filter((collection) => collection.modes.length > 0);

  return { collections: filteredCollections };
}

export function extractColorTokens(payload: unknown): ColorTokenPath[] {
  return flattenPayload(payload)
    .filter((entry) => entry.token.type === 'color')
    .filter(
      (entry) => typeof entry.token.value === 'string' && HEX_COLOR_PATTERN.test(entry.token.value),
    )
    .map((entry) => ({
      ...entry,
      hex: entry.token.value as string,
    }));
}
