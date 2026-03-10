-- Token Beam for Aseprite
-- Syncs design tokens (colors) to/from the active sprite's palette

-- Check Aseprite version and json support
if not json then
  app.alert("Token Beam requires Aseprite v1.3-rc5 or later (json module not found)")
  return
end

if not WebSocket then
  app.alert("Token Beam requires Aseprite v1.3+ with WebSocket support")
  return
end

local dlg = nil
local tokenValue = ""
local ws = nil
local connected = false
local statusText = "Disconnected"
local syncServerUrl = "ws://tokenbeam.dev:8080"
local generation = 0
local initialDialogBounds = Rectangle(120, 120, 280, 200)
local currentMode = "receive"  -- "receive" or "send"
local sessionToken = nil  -- token received from server in send mode
local paletteSnapshot = nil  -- last sent palette state for change detection
local watchedSprite = nil  -- sprite we're listening to for changes
local originalPalettesBySprite = {}
local suppressAutoShow = false
local liveSendPickerColor = true

local function getActiveSprite()
  return app.sprite or app.activeSprite
end

local function capturePaletteColors(sprite)
  local palette = sprite.palettes[1]
  local colors = {}
  for i = 0, #palette - 1 do
    table.insert(colors, palette:getColor(i))
  end
  return colors
end

local function restorePaletteColors(sprite, colors)
  if not sprite or not colors then return end
  local palette = sprite.palettes[1]
  app.transaction(function()
    palette:resize(#colors)
    for index, color in ipairs(colors) do
      palette:setColor(index - 1, color)
    end
  end)
  app.refresh()
end

local function getSpriteStorageKey(sprite)
  if not sprite then return nil end
  return sprite.id
end

local function getStoredOriginalPalette(sprite)
  local key = getSpriteStorageKey(sprite)
  if not key then return nil end
  return originalPalettesBySprite[key]
end

local function storeOriginalPalette(sprite)
  local key = getSpriteStorageKey(sprite)
  if not key then return end
  if originalPalettesBySprite[key] == nil then
    originalPalettesBySprite[key] = capturePaletteColors(sprite)
  end
end

local function showDialog()
  if not dlg then
    dlg = Dialog("Token Beam")

    dlg:tab{ id="receiveTab", text="Receive" }
    dlg:entry{
      id="token",
      text=tokenValue,
      onchange=function()
        tokenValue = dlg.data.token
      end
    }
    dlg:label{
      id="receiveHint",
      text="Disconnect before switching documents,",
      label=""
    }
    dlg:label{
      id="receiveHintDetail",
      text="or colors may apply to the wrong palette.",
      label=""
    }
    dlg:button{
      id="connectBtn",
      text="Connect",
      onclick=onConnect
    }
    dlg:newrow()
    dlg:button{
      id="restoreOriginalPalette",
      text="Restore Original Palette",
      visible=false,
      onclick=function()
        local spr = getActiveSprite()
        local originalPalette = getStoredOriginalPalette(spr)
        if not spr or not originalPalette then
          app.alert("No stored original palette for the active sprite.")
          return
        end

        restorePaletteColors(spr, originalPalette)
        statusText = "Original palette restored"
        dlg:modify{ id="status", text=statusText }
      end
    }
    dlg:tab{ id="sendTab", text="Send" }
    dlg:label{
      id="sessionDisplay",
      text="",
      label=""
    }
    dlg:check{
      id="liveSendPickerColor",
      text="Live Send Picker Color",
      selected=liveSendPickerColor,
      onclick=function()
        liveSendPickerColor = dlg.data.liveSendPickerColor
        if liveSendPickerColor then
          paletteSnapshot = nil
          sendPaletteWithActiveColor(app.fgColor)
        else
          forceSendPalette()
        end
      end
    }
    dlg:button{
      id="copyBtn",
      text="Copy Token",
      onclick=function()
        if not sessionToken then return end
        app.clipboard.text = sessionToken
        dlg:modify{ id="status", text="Token copied!" }
      end
    }
    dlg:endtabs{
      id="modeTabs",
      onchange=function()
        local sel = dlg.data.modeTabs
        -- Always close existing connection before switching
        disconnect()
        if sel == "receiveTab" then
          currentMode = "receive"
          resetUI()
        else
          -- Send mode: auto-connect immediately
          connectSendMode()
        end
      end
    }
    dlg:label{
      id="status",
      text=statusText,
      label=""
    }
  end

  dlg:show{
    wait=false,
    bounds=initialDialogBounds,
    onclose=function()
      disconnect()
    end
  }
end

-- Check clipboard for a beam:// token and prefill
if app.clipboard and app.clipboard.hasText then
  local clip = app.clipboard.text
  if clip and clip:match("^beam://[0-9a-fA-F]+$") then
    tokenValue = clip
  end
end

-- Convert hex color to Aseprite Color
function hexToColor(hex)
  local r, g, b
  hex = hex:gsub("#", "")

  if #hex == 3 then
    r = tonumber(hex:sub(1,1) .. hex:sub(1,1), 16)
    g = tonumber(hex:sub(2,2) .. hex:sub(2,2), 16)
    b = tonumber(hex:sub(3,3) .. hex:sub(3,3), 16)
  else
    r = tonumber(hex:sub(1,2), 16)
    g = tonumber(hex:sub(3,4), 16)
    b = tonumber(hex:sub(5,6), 16)
  end

  return Color{ r=r, g=g, b=b, a=255 }
end

-- Convert Aseprite Color to hex string
function colorToHex(color)
  return string.format("#%02x%02x%02x", color.red, color.green, color.blue)
end

-- Snapshot the current palette as a string for comparison
function snapshotPalette()
  local spr = getActiveSprite()
  if not spr then return nil end
  local palette = spr.palettes[1]
  local parts = {}
  for i = 0, #palette - 1 do
    local c = palette:getColor(i)
    table.insert(parts, colorToHex(c))
  end
  return table.concat(parts, ",")
end

-- Build DTCG payload from current sprite palette + optional active color
function buildPalettePayload(activeColor)
  local spr = getActiveSprite()
  if not spr then return nil end

  local palette = spr.palettes[1]
  local tokens = {}
  local activeColorHex = activeColor and colorToHex(activeColor) or nil
  local hasActiveColorInPalette = false

  -- Aseprite palettes are 0-indexed, so include slot 0 in the synced payload
  for i = 0, #palette - 1 do
    local c = palette:getColor(i)
    local hex = colorToHex(c)
    if activeColorHex and hex == activeColorHex then
      hasActiveColorInPalette = true
    end
    table.insert(tokens, {
      name = "color-" .. i,
      type = "color",
      value = hex
    })
  end

  -- Only add the picked color separately when it is not already in the palette
  if activeColorHex and not hasActiveColorInPalette then
    table.insert(tokens, {
      name = "active-color",
      type = "color",
      value = activeColorHex
    })
  end

  return {
    collections = {
      {
        name = "Aseprite Palette",
        modes = {
          {
            name = "Default",
            tokens = tokens
          }
        }
      }
    }
  }
end

-- Send current palette over WebSocket if it changed
function sendPalette()
  if currentMode ~= "send" then return end
  if not ws or not connected then return end

  local snap = snapshotPalette()
  if not snap then return end

  -- Skip if palette hasn't changed
  if snap == paletteSnapshot then return end
  paletteSnapshot = snap

  local payload = buildPalettePayload()
  if not payload then return end

  local syncMsg = json.encode({
    type = "sync",
    payload = payload
  })
  ws:sendText(syncMsg)

  local count = #payload.collections[1].modes[1].tokens
  statusText = "Sent " .. count .. " colors"
  dlg:modify{ id="status", text=statusText }
end

-- Force-send palette (bypass snapshot check, e.g. when a new client connects)
function forceSendPalette()
  paletteSnapshot = nil
  sendPalette()
end

-- Send palette with the currently picked color
function sendPaletteWithActiveColor(color)
  if currentMode ~= "send" then return end
  if not ws or not connected then return end
  if not liveSendPickerColor then return end

  local payload = buildPalettePayload(color)
  if not payload then return end

  local syncMsg = json.encode({
    type = "sync",
    payload = payload
  })
  ws:sendText(syncMsg)

  local count = #payload.collections[1].modes[1].tokens
  statusText = "Sent " .. count .. " colors"
  dlg:modify{ id="status", text=statusText }
end

-- Sprite change handler for auto-sending
function onSpriteChange()
  sendPalette()
end

-- Stop watching the current sprite
function unwatchSprite()
  if watchedSprite then
    pcall(function()
      watchedSprite.events:off(onSpriteChange)
    end)
    watchedSprite = nil
  end
end

-- Start watching the active sprite for changes
function watchSprite()
  unwatchSprite()
  local spr = app.activeSprite
  if not spr then return end
  watchedSprite = spr
  spr.events:on('change', onSpriteChange)
end

-- Extract colors from token payload
function extractColors(payload)
  local colors = {}

  if not payload.collections then
    return colors
  end

  for _, collection in ipairs(payload.collections) do
    for _, m in ipairs(collection.modes) do
      for _, token in ipairs(m.tokens) do
        if token.type == "color" then
          table.insert(colors, {
            name = token.name,
            value = token.value,
            collection = collection.name,
            mode = m.name
          })
        end
      end
    end
  end

  return colors
end

-- Apply colors to palette
function applyColorsToPalette(colors, spr)
  spr = spr or getActiveSprite()
  if not spr then
    app.alert("No active sprite. Please open or create a sprite first.")
    return
  end

  local palette = spr.palettes[1]

  app.transaction(function()
    -- Resize palette to fit the full synced color set, including slot 0
    palette:resize(#colors)

    -- Apply colors to their 0-indexed palette slots
    for index, colorData in ipairs(colors) do
      local color = hexToColor(colorData.value)
      palette:setColor(index - 1, color)
    end
  end)

  app.refresh()
  return #colors
end

-- Safely close and discard the current WebSocket
function closeWebSocket()
  if ws then
    local oldWs = ws
    ws = nil
    pcall(function() oldWs:close() end)
  end
end

-- Reset UI to initial disconnected state
function resetUI(status)
  connected = false
  closeWebSocket()
  unwatchSprite()
  paletteSnapshot = nil
  sessionToken = nil
  statusText = status or "Disconnected"
  dlg:modify{ id="status", text=statusText }
  dlg:modify{ id="connectBtn", text="Connect" }
  dlg:modify{ id="restoreOriginalPalette", visible=false }
  dlg:modify{ id="sessionDisplay", text="" }
end

-- WebSocket message handler
-- Aseprite's IXWebSocket passes 3 args: (messageType, data, errorReason)
function createMessageHandler(gen)
  return function(messageType, data, errorReason)
    -- Ignore callbacks from stale connections
    if gen ~= generation then return end

    if messageType == WebSocketMessageType.OPEN then
      if not ws then return end
      -- Capture the mode at connection time so late callbacks can't cross modes
      local connMode = currentMode
      connected = true
      statusText = "Connected - pairing..."
      dlg:modify{ id="status", text=statusText }
      if connMode == "receive" then
        dlg:modify{ id="connectBtn", text="Disconnect" }
        dlg:modify{ id="restoreOriginalPalette", visible=true }
      end

      if connMode == "receive" then
        -- Target client: join existing session
        local pairMsg = json.encode({
          type = "pair",
          clientType = "aseprite",
          sessionToken = tokenValue
        })
        ws:sendText(pairMsg)
      elseif connMode == "send" then
        -- Send mode: create a new session as "web" client
        local pairMsg = json.encode({
          type = "pair",
          clientType = "web",
          origin = "Aseprite"
        })
        ws:sendText(pairMsg)
      end

    elseif messageType == WebSocketMessageType.TEXT then
      if not ws then return end
      -- Parse message
      local ok, msg = pcall(json.decode, data)
      if not ok or not msg then
        statusText = "Error: bad server message"
        dlg:modify{ id="status", text=statusText }
        return
      end

      if msg.type == "pair" then
        if currentMode == "send" and msg.sessionToken then
          -- We got our session token from the server
          sessionToken = msg.sessionToken
          statusText = "Waiting for client..."
          dlg:modify{ id="status", text=statusText }
          dlg:modify{ id="sessionDisplay", text=sessionToken }
          -- Start watching for palette changes
          watchSprite()
        elseif currentMode == "send" and msg.clientType and msg.clientType ~= "web" then
          -- A target client connected — send palette immediately
          local origin = msg.origin or msg.clientType
          statusText = origin .. " connected"
          dlg:modify{ id="status", text=statusText }
          forceSendPalette()
        else
          local origin = msg.origin or "unknown"
          statusText = "Paired with " .. origin
          dlg:modify{ id="status", text=statusText }
        end

      elseif msg.type == "sync" then
        -- Only apply incoming colors in receive mode; ignore in send mode
        if currentMode ~= "receive" then return end

        statusText = "Receiving colors..."
        dlg:modify{ id="status", text=statusText }

        local spr = getActiveSprite()
        if not spr then
          resetUI("No active sprite")
          return
        end

        storeOriginalPalette(spr)

        local colors = extractColors(msg.payload)

        if #colors > 0 then
          local count = applyColorsToPalette(colors, spr)
          statusText = "Applied " .. count .. " colors"
          dlg:modify{ id="status", text=statusText }
        else
          statusText = "No colors found"
          dlg:modify{ id="status", text=statusText }
        end

      elseif msg.type == "error" then
        local err = msg.error or "Unknown error"

        if err:sub(1, 6) == "[warn]" then
          statusText = err:sub(8)
          dlg:modify{ id="status", text=statusText }
        elseif err == "Invalid session token" then
          app.alert("Session not found")
          resetUI("Session not found")
        else
          statusText = "Error: " .. err
          dlg:modify{ id="status", text=statusText }
        end

      elseif msg.type == "peer-disconnected" then
        local who = msg.clientType or "Peer"
        statusText = who .. " disconnected"
        dlg:modify{ id="status", text=statusText }
      end

    elseif messageType == WebSocketMessageType.ERROR then
      local reason = ""
      if errorReason and errorReason ~= "" then
        reason = errorReason
      elseif data and data ~= "" then
        reason = data
      else
        reason = "Connection error"
      end
      resetUI("Disconnected: " .. reason)

    elseif messageType == WebSocketMessageType.CLOSE then
      if gen ~= generation then return end
      local reason = "Disconnected"
      if errorReason and errorReason ~= "" then
        reason = "Disconnected: " .. errorReason
      end
      resetUI(reason)
    end
  end
end

-- Disconnect fully before any new connection or mode switch
function disconnect()
  generation = generation + 1
  connected = false
  sessionToken = nil
  paletteSnapshot = nil
  unwatchSprite()
  closeWebSocket()
end

-- Open a new WebSocket connection
function openConnection()
  generation = generation + 1

  statusText = "Connecting..."
  dlg:modify{ id="status", text=statusText }

  ws = WebSocket{
    url = syncServerUrl,
    onreceive = createMessageHandler(generation),
    deflate = false
  }

  ws:connect()
end

-- Connect button handler (receive mode only)
function onConnect()
          dlg:modify{ id="restoreOriginalPalette", visible=false }
  if ws then
    disconnect()
    resetUI()
    return
  end

  if tokenValue == "" then
    app.alert("Enter a session token")
    return
  end

  local stripped = tokenValue:gsub("^beam://", "")
  if not stripped:match("^[0-9a-fA-F]+$") then
    statusText = "Invalid token"
    dlg:modify{ id="status", text=statusText }
    app.alert("Invalid token format")
    return
  end

  if not tokenValue:match("^beam://") then
    tokenValue = "beam://" .. tokenValue:upper()
  end

  if currentMode == "receive" then
    local spr = getActiveSprite()
    if not spr then
      app.alert("No active sprite. Please open or create a sprite first.")
      return
    end

    storeOriginalPalette(spr)
  end

  dlg:modify{ id="connectBtn", text="Connecting..." }
  openConnection()
end

-- Auto-connect for send mode
function connectSendMode()
  disconnect()
  currentMode = "send"
  dlg:modify{ id="sessionDisplay", text="Connecting..." }
  dlg:modify{ id="status", text="Connecting..." }
  openConnection()
end

-- Also watch for active sprite switching
app.events:on('sitechange', function()
  if currentMode == "send" and connected then
    watchSprite()
    forceSendPalette()
  end
end)

-- Send palette + picked color whenever the user changes fg/bg color
app.events:on('fgcolorchange', function()
  sendPaletteWithActiveColor(app.fgColor)
end)

app.events:on('bgcolorchange', function()
  sendPaletteWithActiveColor(app.bgColor)
end)

---@diagnostic disable-next-line: lowercase-global
function init(plugin)
  suppressAutoShow = true
  plugin:newMenuSeparator{ group = "palette_generation" }
  plugin:newCommand{
    id = "tokenBeamPaletteSync",
    title = "Sync Palette with Token Beam",
    group = "palette_generation",
    onclick = showDialog,
    onenabled = function()
      return app.activeSprite ~= nil
    end
  }
end

local autoShowTimer
autoShowTimer = Timer{
  interval = 0.01,
  ontick = function()
    autoShowTimer:stop()
    if not suppressAutoShow then
      showDialog()
    end
  end
}

autoShowTimer:start()
