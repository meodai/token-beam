import type {
  TokenSyncPayload,
  TokenType,
  DesignToken,
  TargetAdapter,
  ColorValue,
} from 'token-sync';

// Figma-specific output types
export type FigmaVariableType = 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';

export interface FigmaSyncVariable {
  name: string;
  type: FigmaVariableType;
  value: ColorValue | number | string | boolean;
}

export interface FigmaSyncMode {
  name: string;
  variables: FigmaSyncVariable[];
}

export interface FigmaCollectionPayload {
  collectionName: string;
  modes: FigmaSyncMode[];
}

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
  return {
    name: token.name,
    type: tokenTypeToFigma(token.type),
    value: token.value as ColorValue | number | string | boolean,
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
