export type FigmaVariableType = 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';

export interface FigmaColorValue {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface FigmaSyncVariable {
  name: string;
  type: FigmaVariableType;
  value: FigmaColorValue | number | string | boolean;
}

export interface FigmaSyncMode {
  name: string;
  variables: FigmaSyncVariable[];
}

export interface FigmaSyncPayload {
  collectionName: string;
  modes: FigmaSyncMode[];
}

export type VariableInput = string | number | boolean | FigmaColorValue;

export interface ExplicitVariableEntry {
  name: string;
  value: VariableInput;
  type?: FigmaVariableType;
}
