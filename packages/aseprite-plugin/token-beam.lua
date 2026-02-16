-- Token Beam for Aseprite
-- Syncs design tokens (colors) to the active sprite's palette

-- Check Aseprite version and json support
if not json then
  app.alert("Token Beam requires Aseprite v1.3-rc5 or later (json module not found)")
  return
end

if not WebSocket then
  app.alert("Token Beam requires Aseprite v1.3+ with WebSocket support")
  return
end

local dlg = Dialog("Token Beam")
local tokenValue = ""
local ws = nil
local connected = false
local statusText = "Disconnected"
local syncServerUrl = "ws://tokenbeam.dev:8080"
local generation = 0
local initialDialogBounds = Rectangle(120, 120, 420, 180)

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

-- Extract colors from token payload
function extractColors(payload)
  local colors = {}

  if not payload.collections then
    return colors
  end

  for _, collection in ipairs(payload.collections) do
    for _, mode in ipairs(collection.modes) do
      for _, token in ipairs(mode.tokens) do
        if token.type == "color" then
          table.insert(colors, {
            name = token.name,
            value = token.value,
            collection = collection.name,
            mode = mode.name
          })
        end
      end
    end
  end

  return colors
end

-- Apply colors to palette
function applyColorsToPalette(colors)
  local spr = app.activeSprite
  if not spr then
    app.alert("No active sprite. Please open or create a sprite first.")
    return
  end

  local palette = spr.palettes[1]

  app.transaction(function()
    -- Resize palette to fit all colors plus one for transparency
    palette:resize(#colors + 1)

    -- Apply colors (index 0 is usually transparent)
    for i, colorData in ipairs(colors) do
      local color = hexToColor(colorData.value)
      palette:setColor(i, color)
    end
  end)

  app.refresh()
  return #colors
end

-- Reset UI to initial disconnected state
function resetUI(status)
  connected = false
  ws = nil
  statusText = status or "Disconnected"
  dlg:modify{ id="connectBtn", text="Connect" }
  dlg:modify{ id="status", text=statusText }
end

-- WebSocket message handler
-- Aseprite's IXWebSocket passes 3 args: (messageType, data, errorReason)
function createMessageHandler(gen)
  return function(messageType, data, errorReason)
    -- Ignore callbacks from stale connections
    if gen ~= generation then return end

    if messageType == WebSocketMessageType.OPEN then
      if not ws then return end
      connected = true
      statusText = "Connected - pairing..."
      dlg:modify{ id="status", text=statusText }
      dlg:modify{ id="connectBtn", text="Disconnect" }

      -- Send pair message with token
      local pairMsg = json.encode({
        type = "pair",
        clientType = "aseprite",
        sessionToken = tokenValue
      })
      ws:sendText(pairMsg)

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
        local origin = msg.origin or "unknown"
        statusText = "Paired with " .. origin
        dlg:modify{ id="status", text=statusText }

      elseif msg.type == "sync" then
        statusText = "Receiving colors..."
        dlg:modify{ id="status", text=statusText }

        local colors = extractColors(msg.payload)

        if #colors > 0 then
          local count = applyColorsToPalette(colors)
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
          statusText = "Session not found"
          dlg:modify{ id="status", text=statusText }
          app.alert("Session not found")
          if ws then ws:close() end
          resetUI()
        else
          statusText = "Error: " .. err
          dlg:modify{ id="status", text=statusText }
        end
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

-- Connect button handler
function onConnect()
  if ws then
    generation = generation + 1
    local oldWs = ws
    resetUI()
    oldWs:close()
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

  generation = generation + 1

  statusText = "Connecting..."
  dlg:modify{ id="status", text=statusText }
  dlg:modify{ id="connectBtn", text="Connecting..." }

  ws = WebSocket{
    url = syncServerUrl,
    onreceive = createMessageHandler(generation),
    deflate = false
  }

  ws:connect()
end

-- Build dialog
dlg:separator{ text="Token" }
dlg:entry{
  id="token",
  text=tokenValue,
  onchange=function()
    tokenValue = dlg.data.token
  end
}
dlg:button{
  id="connectBtn",
  text="Connect",
  onclick=onConnect
}
dlg:separator{}
dlg:label{
  id="status",
  text=statusText,
  label=""
}
dlg:button{ text="Close" }

dlg:show{ wait=false, bounds=initialDialogBounds }
