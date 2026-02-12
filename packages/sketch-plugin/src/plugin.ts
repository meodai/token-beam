var BrowserWindow = require('sketch-module-web-view');
var sketch = require('sketch');
var UI = sketch.UI;

var browserWindow = null;

// Sketch looks up command handlers as global functions.
// We must attach them to globalThis so esbuild doesn't tree-shake them.

globalThis.openTokenBeam = function (context) {
  if (browserWindow) {
    browserWindow.show();
    return;
  }

  browserWindow = new BrowserWindow({
    identifier: 'com.tokenbeam.sketch.panel',
    width: 400,
    height: 600,
    show: false,
    title: '⊷ Token Beam',
    resizable: true,
    alwaysOnTop: true,
  });

  // Listen for color sync messages from the WebView
  browserWindow.webContents.on('syncColors', function (rawData) {
    try {
      var collections = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
      applySyncedColors(collections);
    } catch (err) {
      UI.message('Token Beam: bridge error — ' + String(err));
    }
  });

  // Debug: log any console messages from the webview
  browserWindow.webContents.on('console-message', function (_level, msg) {
    console.log('[webview]', msg);
  });

  browserWindow.on('closed', function () {
    browserWindow = null;
  });

  // Resolve the HTML file path from the plugin bundle.
  // context.scriptPath points to …/Contents/Sketch/plugin.js
  // We need …/Contents/Resources/ui/index.html
  var scriptPath = String(context.scriptPath);
  var sketchDir = String(
    NSString.alloc().initWithString(scriptPath).stringByDeletingLastPathComponent()
  );
  var htmlPath = sketchDir + '/../Resources/ui/index.html';

  browserWindow.loadURL('file://' + htmlPath);
  browserWindow.show();
};

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

        // Build swatch name: "Collection / Token (Mode)"
        var name = collection.name ? collection.name + ' / ' + token.name : token.name;
        if (mode.name && mode.name !== 'Value') {
          name = name + ' (' + mode.name + ')';
        }

        // Check for existing swatch with same name
        var existing = null;
        var swatchList = doc.swatches;
        for (var i = 0; i < swatchList.length; i++) {
          if (swatchList[i].name === name) {
            existing = swatchList[i];
            break;
          }
        }

        if (existing) {
          existing.color = hex;
          updatedCount++;
        } else {
          var swatch = sketch.Swatch.from({ name: name, color: hex });
          doc.swatches.push(swatch);
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

globalThis.onShutdown = function () {
  if (browserWindow) {
    browserWindow.close();
    browserWindow = null;
  }
};
