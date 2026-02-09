import type {
  TokenSyncPayload,
  TokenType,
  DesignToken,
  TargetAdapter,
  FigmaVariableType,
  FigmaSyncVariable,
  FigmaCollectionPayload,
  ColorValue,
  FigmaColorValue,
} from '../types';

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
    value: token.value as FigmaColorValue | number | string | boolean,
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
