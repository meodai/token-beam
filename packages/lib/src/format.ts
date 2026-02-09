import type {
  FigmaColorValue,
  FigmaVariableType,
  FigmaSyncVariable,
  FigmaSyncPayload,
  FigmaSyncMode,
  VariableInput,
  ExplicitVariableEntry,
} from './types';

export function hexToFigmaRGBA(hex: string): FigmaColorValue {
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

function isColorValue(value: unknown): value is FigmaColorValue {
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

export function resolveVariable(
  name: string,
  value: VariableInput,
  explicitType?: FigmaVariableType,
): FigmaSyncVariable {
  if (explicitType) {
    if (explicitType === 'COLOR' && typeof value === 'string') {
      return { name, type: 'COLOR', value: hexToFigmaRGBA(value) };
    }
    return { name, type: explicitType, value };
  }

  if (typeof value === 'boolean') {
    return { name, type: 'BOOLEAN', value };
  }
  if (typeof value === 'number') {
    return { name, type: 'FLOAT', value };
  }
  if (isColorValue(value)) {
    return { name, type: 'COLOR', value };
  }
  if (typeof value === 'string' && isHexColor(value)) {
    return { name, type: 'COLOR', value: hexToFigmaRGBA(value) };
  }
  return { name, type: 'STRING', value: String(value) };
}

export function createCollection(
  name: string,
  variables: Record<string, VariableInput> | ExplicitVariableEntry[],
  modeName: string = 'Value',
): FigmaSyncPayload {
  const resolved: FigmaSyncVariable[] = Array.isArray(variables)
    ? variables.map((v) => resolveVariable(v.name, v.value, v.type))
    : Object.entries(variables).map(([k, v]) => resolveVariable(k, v));

  return {
    collectionName: name,
    modes: [{ name: modeName, variables: resolved }],
  };
}

export function createMultiModeCollection(
  name: string,
  modeVariables: Record<string, Record<string, VariableInput> | ExplicitVariableEntry[]>,
): FigmaSyncPayload {
  const modes: FigmaSyncMode[] = Object.entries(modeVariables).map(
    ([modeName, variables]) => {
      const resolved: FigmaSyncVariable[] = Array.isArray(variables)
        ? variables.map((v) => resolveVariable(v.name, v.value, v.type))
        : Object.entries(variables).map(([k, v]) => resolveVariable(k, v));

      return { name: modeName, variables: resolved };
    },
  );

  return { collectionName: name, modes };
}
