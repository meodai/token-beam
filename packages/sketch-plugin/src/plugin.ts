var BrowserWindow = require('sketch-module-web-view');
var sketch = require('sketch');
var UI = sketch.UI;

var browserWindow = null;

function openTokenBeam() {
  if (browserWindow) {
    browserWindow.show();
    return;
  }

  browserWindow = new BrowserWindow({
    identifier: 'com.tokenbeam.sketch.panel',
    width: 400,
    height: 300,
    show: false,
    title: '⊷ Token Beam',
    resizable: false,
    alwaysOnTop: true,
  });

  // Listen for color sync messages from the WebView
  browserWindow.webContents.on('syncColors', function (rawData) {
    try {
      var collections = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
      applySyncedColors(collections);
    } catch (err) {
      UI.message('Token Beam: Failed to parse colors — ' + String(err));
    }
  });

  browserWindow.on('closed', function () {
    browserWindow = null;
  });

  // Load the UI — resolve relative to this script's location inside the .sketchplugin bundle
  var path = require('path');
  var htmlPath = path.resolve(__dirname, '../Resources/ui/index.html');
  browserWindow.loadURL('file://' + htmlPath);
  browserWindow.show();
}

function applySyncedColors(collections) {
  var doc = sketch.getSelectedDocument();
  if (!doc) {
    UI.message('Token Beam: No document open');
    return;
  }

  var colorCount = 0;
  var updatedCount = 0;

  collections.forEach(function (collection) {
    collection.modes.forEach(function (mode) {
      mode.tokens.forEach(function (token) {
        if (token.type !== 'color') return;

        var hex = token.value;
        if (!hex || typeof hex !== 'string') return;

        // Ensure # prefix
        if (hex.charAt(0) !== '#') hex = '#' + hex;

        // Sketch expects #rrggbbaa — append ff alpha if needed
        if (hex.length === 7) hex = hex + 'ff';

        // Build swatch name
        var name = collection.name ? collection.name + ' / ' + token.name : token.name;
        if (mode.name && mode.name !== 'Value') {
          name = name + ' (' + mode.name + ')';
        }

        // Check for existing swatch
        var existing = null;
        for (var i = 0; i < doc.swatches.length; i++) {
          if (doc.swatches[i].name === name) {
            existing = doc.swatches[i];
            break;
          }
        }

        if (existing) {
          existing.color = hex;
          updatedCount++;
        } else {
          doc.swatches.append({ name: name, color: hex });
        }

        colorCount++;
      });
    });
  });

  if (colorCount === 0) {
    UI.message('Token Beam: No color tokens received');
    return;
  }

  var msg = '⊷ Synced ' + colorCount + ' color' + (colorCount !== 1 ? 's' : '');
  if (updatedCount > 0) {
    msg += ' (' + updatedCount + ' updated)';
  }
  UI.message(msg);
}

function onShutdown() {
  if (browserWindow) {
    browserWindow.close();
    browserWindow = null;
  }
}
