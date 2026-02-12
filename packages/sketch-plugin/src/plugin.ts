var BrowserWindow = require('sketch-module-web-view');
var sketch = require('sketch');
var UI = sketch.UI;

var browserWindow = null;

function resolveUiHtmlPath(context) {
  try {
    if (context && context.plugin && context.plugin.urlForResourceNamed) {
      var resourceUrl = context.plugin.urlForResourceNamed('ui/index.html');
      if (resourceUrl && resourceUrl.path) {
        return String(resourceUrl.path());
      }
    }
  } catch (_err) {}

  try {
    if (context && context.plugin && context.plugin.url) {
      var pluginRoot = String(context.plugin.url().path());
      return pluginRoot + '/Contents/Resources/ui/index.html';
    }
  } catch (_err) {}

  try {
    if (context && context.scriptURL && context.scriptURL.path) {
      var scriptPath = String(context.scriptURL.path());
      var sketchDir = scriptPath.replace(/\/[^/]+$/, '');
      return sketchDir + '/../Resources/ui/index.html';
    }
  } catch (_err) {}

  if (context && context.scriptPath) {
    var sketchDirFromScriptPath = String(context.scriptPath).replace(/\/[^/]+$/, '');
    return sketchDirFromScriptPath + '/../Resources/ui/index.html';
  }

  throw new Error('Could not resolve plugin UI resource path');
}

function openTokenBeam(context) {
  if (browserWindow) {
    browserWindow.show();
    return;
  }

  browserWindow = new BrowserWindow({
    identifier: 'com.tokenbeam.sketch.panel',
    width: 400,
    height: 600,
    show: true,
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

  try {
    var htmlPath = resolveUiHtmlPath(context);
    browserWindow.loadURL('file://' + htmlPath);
  } catch (err) {
    UI.message('Token Beam: Failed to open window');
    console.error('Token Beam: UI load error', err);
    if (browserWindow) {
      browserWindow.close();
      browserWindow = null;
    }
  }
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

module.exports = {
  openTokenBeam: openTokenBeam,
  onShutdown: onShutdown,
};
