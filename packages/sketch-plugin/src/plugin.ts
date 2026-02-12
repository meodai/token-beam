/* global NSMakeRect, NSURL, NSURLRequest, NSWindowStyleMaskTitled, NSWindowStyleMaskClosable, NSPanel, WKWebView, WKWebViewConfiguration, WKUserContentController, coscript, NSBackingStoreBuffered, NSFloatingWindowLevel */

var webviewWindow = null;
var webView = null;
var currentContext = null;

function notify(message) {
  try {
    var sketch = require('sketch');
    var doc = sketch.getSelectedDocument();
    if (doc) {
      sketch.UI.message(message);
      return;
    }
  } catch (_e) {}
  // Fallback to context-based notification
  if (currentContext && currentContext.document && currentContext.document.showMessage) {
    currentContext.document.showMessage(message);
  }
}

function openTokenBeam(context) {
  currentContext = context;
  try {
    if (webviewWindow && webView) {
      webviewWindow.makeKeyAndOrderFront(null);
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

    webviewWindow.setTitle('⊷ Token Beam');
    webviewWindow.center();
    webviewWindow.setLevel(NSFloatingWindowLevel);

    // Create WebView with message bridge
    var config = WKWebViewConfiguration.alloc().init();
    var userController = WKUserContentController.alloc().init();

    if (typeof coscript !== 'undefined' && coscript && coscript.createClass) {
      // Keep the coscript fiber alive so WebSocket stays connected
      coscript.setShouldKeepAround(true);

      var handlerDef = {
        'userContentController:didReceiveScriptMessage:': function (_controller, message) {
          try {
            var body = message.body();
            if (body && body.type === 'syncColors') {
              applySyncedColors(body.data);
            }
          } catch (err) {
            notify('Token Beam: bridge error — ' + String(err));
          }
        },
      };

      var HandlerClass = coscript.createClass(
        'TokenBeamBridgeHandler_' + Date.now(),
        handlerDef,
      );
      var handler = HandlerClass.alloc().init();
      userController.addScriptMessageHandler_name(handler, 'sketchBridge');
    } else {
      notify('Token Beam: coscript bridge unavailable');
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
  } catch (error) {
    notify('Token Beam error: ' + (error && error.message ? error.message : String(error)));
  }
}

/**
 * Apply synced color tokens as Sketch swatches using the JS API.
 * This is the simple, reliable path — no MSColor/MSSwatch native objects needed.
 */
function applySyncedColors(collections) {
  var sketch;
  try {
    sketch = require('sketch');
  } catch (_e) {
    notify('Token Beam: Sketch JS API not available');
    return;
  }

  var doc = sketch.getSelectedDocument();
  if (!doc) {
    notify('Token Beam: No document open');
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

        // Build swatch name: "collection / token" or just "token" if one collection
        var name = collection.name ? collection.name + ' / ' + token.name : token.name;
        if (mode.name && mode.name !== 'Value') {
          name = name + ' (' + mode.name + ')';
        }

        // Check if swatch already exists
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
          doc.swatches.push({ name: name, color: hex });
        }

        colorCount++;
      });
    });
  });

  if (colorCount === 0) {
    notify('Token Beam: No color tokens received');
    return;
  }

  var msg = '⊷ Synced ' + colorCount + ' color' + (colorCount !== 1 ? 's' : '');
  if (updatedCount > 0) {
    msg += ' (' + updatedCount + ' updated)';
  }
  notify(msg);
}

function onShutdown() {
  currentContext = null;
  if (webviewWindow) {
    webviewWindow.close();
    webviewWindow = null;
    webView = null;
  }
}
