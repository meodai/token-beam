/* global NSThread, NSMakeRect, NSURL, NSURLRequest, NSWindowStyleMaskTitled, NSWindowStyleMaskClosable, NSPanel, WKWebView, WKWebViewConfiguration, WKUserContentController, coscript */

var webviewWindow = null;
var webView = null;
var currentContext = null;
var bridgeEnabled = false;

function notify(message) {
  if (currentContext && currentContext.document && currentContext.document.showMessage) {
    currentContext.document.showMessage(message);
  }
}

function openTokenBeam(context) {
  currentContext = context;
  try {
    notify('Token Beam: command triggered');

    if (webviewWindow && webView) {
      webviewWindow.makeKeyAndOrderFront(null);
      notify('Token Beam: window focused');
      return;
    }

    // Create window
    var frame = NSMakeRect(0, 0, 400, 300);
    var styleMask = NSWindowStyleMaskTitled | NSWindowStyleMaskClosable;

    webviewWindow = NSPanel.alloc().initWithContentRect_styleMask_backing_defer(
      frame,
      styleMask,
      NSBackingStoreBuffered,
      false,
    );

    webviewWindow.setTitle('Token Beam');
    webviewWindow.center();
    webviewWindow.setLevel(NSFloatingWindowLevel);

    // Create WebView
    var config = WKWebViewConfiguration.alloc().init();
    var userController = WKUserContentController.alloc().init();

    // Bridge to handle messages from WebView
    bridgeEnabled = false;
    if (typeof coscript !== 'undefined' && coscript && coscript.createClass) {
      var scriptHandler = {
        'userContentController:didReceiveScriptMessage:': function (controller, message) {
          var body = message.body();
          if (body.type === 'syncColors') {
            applySyncedColors(body.data, currentContext);
          }
        },
      };

      var uniqueHandler = coscript.createClass('UniqueSyncHandler' + Date.now(), scriptHandler);
      var handler = uniqueHandler.alloc().init();
      userController.addScriptMessageHandler_name(handler, 'sketchBridge');
      bridgeEnabled = true;
    } else {
      notify('Token Beam: coscript bridge unavailable in this Sketch runtime');
    }

    config.setUserContentController(userController);

    webView = WKWebView.alloc().initWithFrame_configuration(frame, config);

    // Load HTML
    var pluginFolder = currentContext.scriptPath.stringByDeletingLastPathComponent();
    var uiPath = pluginFolder.stringByAppendingPathComponent('../Resources/ui/index.html');
    var url = NSURL.fileURLWithPath(uiPath);
    var request = NSURLRequest.requestWithURL(url);
    webView.loadRequest(request);

    webviewWindow.setContentView(webView);
    webviewWindow.makeKeyAndOrderFront(null);
    if (bridgeEnabled) {
      notify('Token Beam: window opened');
    } else {
      notify('Token Beam: window opened (bridge disabled)');
    }
  } catch (error) {
    var message = error && error.message ? error.message : String(error);
    notify('Token Beam error: ' + message);
  }
}

function applySyncedColors(collections, context) {
  var document = context.document;

  if (!document) {
    NSApplication.sharedApplication().displayDialog_withTitle('No document open', 'Token Beam');
    return;
  }

  var colorCount = 0;
  var variableCount = 0;
  var fallbackCount = 0;
  var skippedCount = 0;
  var swatches = document.documentData().sharedSwatches();

  function normalizeHexForSketch(value) {
    if (!value || typeof value !== 'string') return null;
    var raw = value.trim().replace('#', '');
    if (!/^[0-9a-fA-F]{3,8}$/.test(raw)) return null;

    if (raw.length === 3) {
      return (
        '#' +
        raw[0] +
        raw[0] +
        raw[1] +
        raw[1] +
        raw[2] +
        raw[2]
      ).toLowerCase();
    }
    if (raw.length === 4) {
      return (
        '#' +
        raw[0] +
        raw[0] +
        raw[1] +
        raw[1] +
        raw[2] +
        raw[2] +
        raw[3] +
        raw[3]
      ).toLowerCase();
    }
    return ('#' + raw).toLowerCase();
  }

  function addOrUpdateViaSketchAPI(name, hexValue) {
    try {
      if (typeof require === 'undefined') return false;
      var sketch = require('sketch');
      if (!sketch || !sketch.getSelectedDocument) return false;

      var doc = sketch.getSelectedDocument();
      if (!doc || !doc.swatches) return false;

      var existing = null;
      for (var i = 0; i < doc.swatches.length; i++) {
        if (doc.swatches[i].name === name) {
          existing = doc.swatches[i];
          break;
        }
      }

      if (existing) {
        existing.color = hexValue;
      } else {
        doc.swatches.push({ name: name, color: hexValue });
      }

      return true;
    } catch (_e) {
      return false;
    }
  }

  function addColorAsVariable(name, color) {
    if (!swatches || !color) return false;

    var swatch = null;

    if (typeof MSSwatch !== 'undefined' && MSSwatch) {
      if (MSSwatch.swatchWithName_color) {
        swatch = MSSwatch.swatchWithName_color(name, color);
      } else if (MSSwatch.alloc && MSSwatch.alloc().initWithName_color) {
        swatch = MSSwatch.alloc().initWithName_color(name, color);
      } else if (MSSwatch.alloc && MSSwatch.alloc().init) {
        swatch = MSSwatch.alloc().init();
        if (swatch.setName) swatch.setName(name);
        if (swatch.setColor) swatch.setColor(color);
      }
    }

    if (swatch) {
      if (swatches.addSharedObject) {
        swatches.addSharedObject(swatch);
        return true;
      }
      if (swatches.addSwatch) {
        swatches.addSwatch(swatch);
        return true;
      }
      if (swatches.addObject) {
        swatches.addObject(swatch);
        return true;
      }
    }

    return false;
  }

  function addColorAsLegacyStyle(name, color) {
    if (!swatches || !color) return false;
    if (typeof MSSharedStyle === 'undefined' || !MSSharedStyle) return false;

    var shared = MSSharedStyle.alloc().init();
    if (shared.setName) shared.setName(name);
    if (shared.setValue) shared.setValue(color);

    if (swatches.addSharedObject) {
      swatches.addSharedObject(shared);
      return true;
    }
    if (swatches.addObject) {
      swatches.addObject(shared);
      return true;
    }

    return false;
  }

  collections.forEach(function (collection) {
    collection.modes.forEach(function (mode) {
      mode.tokens.forEach(function (token) {
        if (token.type === 'color') {
          // Parse hex color
          var hex = token.value.replace('#', '');
          var r, g, b;

          if (hex.length === 3) {
            r = parseInt(hex[0] + hex[0], 16) / 255.0;
            g = parseInt(hex[1] + hex[1], 16) / 255.0;
            b = parseInt(hex[2] + hex[2], 16) / 255.0;
          } else {
            r = parseInt(hex.substr(0, 2), 16) / 255.0;
            g = parseInt(hex.substr(2, 2), 16) / 255.0;
            b = parseInt(hex.substr(4, 2), 16) / 255.0;
          }

          var color = MSColor.colorWithRed_green_blue_alpha(r, g, b, 1.0);
          var normalizedHex = normalizeHexForSketch(token.value);

          var addedAsVariable = false;
          if (normalizedHex) {
            addedAsVariable = addOrUpdateViaSketchAPI(token.name, normalizedHex);
          }

          if (!addedAsVariable) {
            addedAsVariable = addColorAsVariable(token.name, color);
          }

          if (addedAsVariable) {
            variableCount++;
          } else {
            var addedFallback = addColorAsLegacyStyle(token.name, color);
            if (addedFallback) {
              fallbackCount++;
            } else {
              skippedCount++;
            }

            if (!addedAsVariable && !addedFallback) {
              return;
            }
          }

          colorCount++;
        }
      });
    });
  });

  if (skippedCount > 0) {
    document.showMessage(
      '⚠️ Synced ' +
        colorCount +
        ' color' +
        (colorCount !== 1 ? 's' : '') +
        ' (' +
        variableCount +
        ' variables, ' +
        fallbackCount +
        ' fallback, ' +
        skippedCount +
        ' skipped)',
    );
    return;
  }

  document.showMessage(
    '✅ Synced ' +
      colorCount +
      ' color' +
      (colorCount !== 1 ? 's' : '') +
      ' (' +
      variableCount +
      ' variables' +
      (fallbackCount > 0 ? ', ' + fallbackCount + ' fallback' : '') +
      ')',
  );
}

function onShutdown() {
  currentContext = null;
  if (webviewWindow) {
    webviewWindow.close();
  }
}
