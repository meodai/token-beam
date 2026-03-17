export type TokenType = 'color' | 'number' | 'string' | 'boolean';
export type Capability = 'send' | 'receive';

export interface TokenExtractor {
  /** Name prefix for the tokens (e.g., "palette", "brand") */
  name: string;
  /** Token type */
  type: TokenType;
  /** Extract current token values from the page */
  extract: () => Array<{ name: string; value: string | number | boolean }>;
  /** Start observing changes — call `onChange` whenever tokens update */
  observe: (onChange: () => void) => () => void;
}

export interface TokenApplier {
  /** Apply received tokens to the page */
  apply: (
    tokens: Array<{ name: string; type: TokenType; value: string | number | boolean }>,
  ) => void;
}

export interface SiteProvider {
  /** Domain to match (e.g., "meodai.github.io") */
  domain: string;
  /** Optional path prefix to match (e.g., "/poline/") */
  path?: string;
  /** Display name */
  name: string;
  /** What this provider can do */
  capabilities: Capability[];
  /** Token extractors for sending */
  extractors?: TokenExtractor[];
  /** Token applier for receiving */
  applier?: TokenApplier;
}
