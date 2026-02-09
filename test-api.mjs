import { createCollection, figmaCollectionAdapter } from './packages/lib/dist/token-sync.js';

// Test the createCollection and adapter
const testColors = {
  'color/primary': '#ff0000',
  'color/secondary': '#00ff00',
  'spacing/base': 8,
  'text/label': 'Hello',
};

const tokenPayload = createCollection('Test Collection', testColors);
console.log('Token Payload:', JSON.stringify(tokenPayload, null, 2));

const figmaPayload = figmaCollectionAdapter.transform(tokenPayload);
console.log('\nFigma Adapted Payload:', JSON.stringify(figmaPayload, null, 2));

// Verify structure
console.log('\n✓ Verification:');
console.log('  - TokenPayload has collections array:', Array.isArray(tokenPayload.collections));
console.log('  - First collection name:', tokenPayload.collections[0].name);
console.log('  - First mode has tokens:', Array.isArray(tokenPayload.collections[0].modes[0].tokens));
console.log('  - FigmaPayload is array:', Array.isArray(figmaPayload));
console.log('  - First item has collectionName:', figmaPayload[0].collectionName);
console.log('  - First mode has variables:', Array.isArray(figmaPayload[0].modes[0].variables));
console.log('  - First variable type is uppercase:', figmaPayload[0].modes[0].variables[0].type);
