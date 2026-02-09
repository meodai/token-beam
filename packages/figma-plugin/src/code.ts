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
}

interface RequestCollectionsMessage {
  type: 'request-collections';
}

type PluginMessage = SyncMessage | RequestCollectionsMessage;

figma.showUI(__html__, { width: 420, height: 520, themeColors: true });

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
      await syncVariables(msg);
      figma.ui.postMessage({ type: 'sync-complete' });
      figma.notify('Variables synced!');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      figma.ui.postMessage({ type: 'sync-error', error: message });
      figma.notify('Sync failed: ' + message, { error: true });
    }
  }
};

async function syncVariables(msg: SyncMessage) {
  const { payload, existingCollectionId } = msg;

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
    collection = figma.variables.createVariableCollection(payload.collectionName);
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
        variable = figma.variables.createVariable(
          varDef.name,
          collection,
          varDef.type,
        );
        existingVars.set(varDef.name, variable);
      }

      variable.setValueForMode(modeId, varDef.value as VariableValue);
    }
  }
}
