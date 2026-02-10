import type {
  TokenType,
  DesignToken,
  TokenSyncPayload,
  TokenMode,
  TokenInput,
  ExplicitTokenEntry,
} from './types';

function isHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value);
}

export function resolveToken(
  name: string,
  value: TokenInput,
  explicitType?: TokenType,
): DesignToken {
  if (explicitType) {
    return { name, type: explicitType, value };
  }

  if (typeof value === 'boolean') {
    return { name, type: 'boolean', value };
  }
  if (typeof value === 'number') {
    return { name, type: 'number', value };
  }
  if (typeof value === 'string' && isHexColor(value)) {
    return { name, type: 'color', value };
  }
  return { name, type: 'string', value: String(value) };
}

export function createCollection(
  name: string,
  tokens: Record<string, TokenInput> | ExplicitTokenEntry[],
  modeName: string = 'Value',
): TokenSyncPayload {
  const resolved: DesignToken[] = Array.isArray(tokens)
    ? tokens.map((t) => resolveToken(t.name, t.value, t.type))
    : Object.entries(tokens).map(([k, v]) => resolveToken(k, v));

  return {
    collections: [
      {
        name,
        modes: [{ name: modeName, tokens: resolved }],
      },
    ],
  };
}

export function createMultiModeCollection(
  name: string,
  modeTokens: Record<string, Record<string, TokenInput> | ExplicitTokenEntry[]>,
): TokenSyncPayload {
  const modes: TokenMode[] = Object.entries(modeTokens).map(([modeName, tokens]) => {
    const resolved: DesignToken[] = Array.isArray(tokens)
      ? tokens.map((t) => resolveToken(t.name, t.value, t.type))
      : Object.entries(tokens).map(([k, v]) => resolveToken(k, v));

    return { name: modeName, tokens: resolved };
  });

  return { collections: [{ name, modes }] };
}
