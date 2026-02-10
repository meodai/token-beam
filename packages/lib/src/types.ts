// W3C DTCG-aligned generic token types
export type TokenType = 'color' | 'number' | 'string' | 'boolean';

export interface DesignToken {
  name: string;
  type: TokenType;
  value: string | number | boolean;
}

export interface TokenMode {
  name: string;
  tokens: DesignToken[];
}

export interface TokenCollection {
  name: string;
  modes: TokenMode[];
}

export interface TokenSyncPayload {
  collections: TokenCollection[];
}

// Helper types for input
export type TokenInput = string | number | boolean;

export interface ExplicitTokenEntry {
  name: string;
  value: TokenInput;
  type?: TokenType;
}

// Adapter interface
export interface TargetAdapter<T> {
  name: string;
  transform(payload: TokenSyncPayload): T;
}
