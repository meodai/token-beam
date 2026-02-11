import type { TokenSyncPayload, TokenType, DesignToken, TargetAdapter } from 'token-beam';

// Figma-specific color type (0–1 range RGBA)
export interface FigmaColorValue {
  r: number;
  g: number;
  b: number;
  a: number;
}

// Figma-specific output types
export type FigmaVariableType = 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';

export interface FigmaSyncVariable {
  name: string;
  type: FigmaVariableType;
  value: FigmaColorValue | number | string | boolean;
}

export interface FigmaSyncMode {
  name: string;
  variables: FigmaSyncVariable[];
}

export interface FigmaCollectionPayload {
  collectionName: string;
  modes: FigmaSyncMode[];
}

// --- Color conversion (owned by this adapter) ---

function hexToRGBA(hex: string): FigmaColorValue {
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

// --- Token → Figma variable mapping ---

function tokenTypeToFigma(type: TokenType): FigmaVariableType {
  switch (type) {
    case 'color':
      return 'COLOR';
    case 'number':
      return 'FLOAT';
    case 'string':
      return 'STRING';
    case 'boolean':
      return 'BOOLEAN';
  }
}

function tokenToVariable(token: DesignToken): FigmaSyncVariable {
  // Color tokens arrive as hex strings — convert to Figma's 0–1 RGBA
  if (token.type === 'color' && typeof token.value === 'string') {
    return {
      name: token.name,
      type: 'COLOR',
      value: hexToRGBA(token.value),
    };
  }

  return {
    name: token.name,
    type: tokenTypeToFigma(token.type),
    value: token.value,
  };
}

export const figmaCollectionAdapter: TargetAdapter<FigmaCollectionPayload[]> = {
  name: 'figma-collection',
  transform(payload: TokenSyncPayload): FigmaCollectionPayload[] {
    return payload.collections.map((collection) => ({
      collectionName: collection.name,
      modes: collection.modes.map((mode) => ({
        name: mode.name,
        variables: mode.tokens.map(tokenToVariable),
      })),
    }));
  },
};
