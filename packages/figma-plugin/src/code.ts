interface FigmaColorValue {
  r: number;
  g: number;
  b: number;
  a: number;
}

type FigmaVariableType = 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';

interface SyncVariable {
  name: string;
  type: FigmaVariableType;
  value: FigmaColorValue | number | string | boolean;
}

interface SyncPayload {
  collectionName: string;
  modes: Array<{
    name: string;
    variables: SyncVariable[];
  }>;
}

interface SyncMessage {
  type: 'sync';
  payload: SyncPayload;
  existingCollectionId?: string;
  collectionName?: string;
}

interface RequestCollectionsMessage {
  type: 'request-collections';
}

type PluginMessage = SyncMessage | RequestCollectionsMessage;

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

function toVariableValue(varDef: SyncVariable): VariableValue {
  if (varDef.type === 'COLOR' && isColorValue(varDef.value)) {
    const { r, g, b, a } = varDef.value;
    return { r, g, b, a } satisfies RGBA;
  }
  // number, string, boolean are all valid VariableValue
  return varDef.value as VariableValue;
}

figma.showUI(__html__, { width: 320, height: 260, themeColors: true });

figma.ui.onmessage = async (msg: PluginMessage) => {
  if (msg.type === 'request-collections') {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const list = collections.map((c) => ({
      id: c.id,
      name: c.name,
      modes: c.modes.map((m) => ({ modeId: m.modeId, name: m.name })),
    }));
    figma.ui.postMessage({ type: 'collections-list', collections: list });
    return;
  }

  if (msg.type === 'sync') {
    try {
      const collectionId = await syncVariables(msg);
      figma.ui.postMessage({ type: 'sync-complete', collectionId });
      figma.notify('Variables synced!');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      figma.ui.postMessage({ type: 'sync-error', error: message });
      figma.notify('Sync failed: ' + message, { error: true });
    }
  }
};

async function syncVariables(msg: SyncMessage): Promise<string> {
  const { payload, existingCollectionId, collectionName } = msg;

  let collection: VariableCollection;
  const existingVars = new Map<string, Variable>();

  if (existingCollectionId) {
    const existing = await figma.variables.getVariableCollectionByIdAsync(existingCollectionId);
    if (!existing) throw new Error('Collection not found');
    collection = existing;

    for (const varId of collection.variableIds) {
      const v = await figma.variables.getVariableByIdAsync(varId);
      if (v) existingVars.set(v.name, v);
    }
  } else {
    const name = collectionName ?? payload.collectionName;
    collection = figma.variables.createVariableCollection(name);
  }

  // Ensure correct modes exist
  for (let i = 0; i < payload.modes.length; i++) {
    const modeDef = payload.modes[i];
    if (i < collection.modes.length) {
      collection.renameMode(collection.modes[i].modeId, modeDef.name);
    } else {
      collection.addMode(modeDef.name);
    }
  }

  // Create/update variables for each mode
  for (let i = 0; i < payload.modes.length; i++) {
    const modeDef = payload.modes[i];
    const modeId = collection.modes[i].modeId;

    for (const varDef of modeDef.variables) {
      let variable = existingVars.get(varDef.name);

      if (!variable) {
        variable = figma.variables.createVariable(varDef.name, collection, varDef.type);
        existingVars.set(varDef.name, variable);
      }

      variable.setValueForMode(modeId, toVariableValue(varDef));
    }
  }

  return collection.id;
}
