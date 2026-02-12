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
  var swatches = document.documentData().sharedSwatches();

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
          var swatch = MSSharedStyle.alloc().init();
          swatch.setName(token.name);
          swatch.setValue(color);

          swatches.addSharedObject(swatch);
          colorCount++;
        }
      });
    });
  });

  document.showMessage('✅ Synced ' + colorCount + ' color' + (colorCount !== 1 ? 's' : ''));
}

function onShutdown() {
  currentContext = null;
  if (webviewWindow) {
    webviewWindow.close();
  }
}
