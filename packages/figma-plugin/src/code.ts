import type { FigmaCollectionPayload, FigmaSyncVariable, FigmaColorValue } from './adapter';

interface SyncMessage {
  type: 'sync';
  payload: FigmaCollectionPayload;
}

type PluginMessage = SyncMessage;

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

function toVariableValue(varDef: FigmaSyncVariable): VariableValue {
  if (varDef.type === 'COLOR' && isColorValue(varDef.value)) {
    const { r, g, b, a } = varDef.value;
    return { r, g, b, a } satisfies RGBA;
  }
  // number, string, boolean are all valid VariableValue
  return varDef.value as VariableValue;
}

function validatePayload(payload: unknown): payload is FigmaCollectionPayload {
  if (!payload || typeof payload !== 'object') return false;

  const p = payload as Partial<FigmaCollectionPayload>;

  if (typeof p.collectionName !== 'string' || !p.collectionName) return false;
  if (!Array.isArray(p.modes) || p.modes.length === 0) return false;

  for (const mode of p.modes) {
    if (!mode || typeof mode !== 'object') return false;
    if (typeof mode.name !== 'string' || !mode.name) return false;
    if (!Array.isArray(mode.variables)) return false;

    for (const variable of mode.variables) {
      if (!variable || typeof variable !== 'object') return false;
      if (typeof variable.name !== 'string' || !variable.name) return false;
      if (!['COLOR', 'FLOAT', 'STRING', 'BOOLEAN'].includes(variable.type)) return false;
      if (variable.value === undefined || variable.value === null) return false;
    }
  }

  return true;
}

figma.showUI(__html__, { width: 320, height: 200, themeColors: true });

figma.ui.onmessage = async (msg: PluginMessage) => {
  if (msg.type === 'sync') {
    try {
      if (!validatePayload(msg.payload)) {
        throw new Error('Invalid payload structure');
      }
      const result = await syncVariables(msg);
      figma.ui.postMessage({
        type: 'sync-complete',
        collectionId: result.id,
        collectionName: result.name,
        isNew: result.isNew,
      });
      const action = result.isNew ? 'Created' : 'Updated';
      figma.notify(`${action} collection: ${result.name}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      figma.ui.postMessage({ type: 'sync-error', error: message });
      figma.notify('Sync failed: ' + message, { error: true });
    }
  }
};

async function syncVariables(
  msg: SyncMessage,
): Promise<{ id: string; name: string; isNew: boolean }> {
  const { payload } = msg;
  const collectionName = payload.collectionName;

  // Find existing collection by name or create new one
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  let collection = collections.find((c) => c.name === collectionName);

  const existingVars = new Map<string, Variable>();
  const isNew = !collection;

  if (collection) {
    // Update existing collection
    for (const varId of collection.variableIds) {
      const v = await figma.variables.getVariableByIdAsync(varId);
      if (v) existingVars.set(v.name, v);
    }
  } else {
    // Create new collection
    collection = figma.variables.createVariableCollection(collectionName);
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

  return { id: collection.id, name: collection.name, isNew };
}
