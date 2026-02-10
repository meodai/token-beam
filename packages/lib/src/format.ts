import type {
  ColorValue,
  TokenType,
  DesignToken,
  TokenSyncPayload,
  TokenMode,
  TokenInput,
  ExplicitTokenEntry,
} from './types';

export function hexToRGBA(hex: string): ColorValue {
  let h = hex.replace(/^#/, '');

  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  if (h.length === 4) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  }

  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;

  return { r, g, b, a };
}

function isColorValue(value: unknown): value is ColorValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    'r' in value &&
    'g' in value &&
    'b' in value &&
    'a' in value
  );
}

function isHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value);
}

export function resolveToken(
  name: string,
  value: TokenInput,
  explicitType?: TokenType,
): DesignToken {
  if (explicitType) {
    if (explicitType === 'color' && typeof value === 'string') {
      return { name, type: 'color', value: hexToRGBA(value) };
    }
    return { name, type: explicitType, value };
  }

  if (typeof value === 'boolean') {
    return { name, type: 'boolean', value };
  }
  if (typeof value === 'number') {
    return { name, type: 'number', value };
  }
  if (isColorValue(value)) {
    return { name, type: 'color', value };
  }
  if (typeof value === 'string' && isHexColor(value)) {
    return { name, type: 'color', value: hexToRGBA(value) };
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
