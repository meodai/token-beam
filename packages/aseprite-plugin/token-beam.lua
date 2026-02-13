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
local statusText = "Disconnected"
local syncServerUrl = "wss://token-beam.fly.dev"
local generation = 0

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

-- WebSocket message handler
function createMessageHandler(gen)
  return function(messageType, data)
    -- Ignore callbacks from stale connections
    if gen ~= generation then return end

    if messageType == WebSocketMessageType.OPEN then
      if not ws then return end
      statusText = "Connected - pairing..."
      dlg:modify{ id="status", text=statusText }

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
      local msg = json.decode(data)

      if msg.type == "pair" then
        local origin = msg.origin or "unknown"
        statusText = "Paired with " .. origin .. " - waiting for data..."
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
          statusText = "No colors found in payload"
          dlg:modify{ id="status", text=statusText }
        end

      elseif msg.type == "error" then
        local err = msg.error or "Unknown error"

        -- Non-fatal warnings — just update status, don't disconnect
        if err:sub(1, 6) == "[warn]" then
          statusText = err:sub(8)
          dlg:modify{ id="status", text=statusText }
        elseif err == "Invalid session token" then
          statusText = "Session not found"
          dlg:modify{ id="status", text=statusText }
          app.alert("Session not found — check the token or start a new session from the web app")
          if ws then ws:close() end
          ws = nil
          dlg:modify{ id="connectBtn", text="Connect" }
        else
          statusText = "Error: " .. err
          dlg:modify{ id="status", text=statusText }
        end
      end

    elseif messageType == WebSocketMessageType.CLOSE then
      -- Only update UI if this is still the active connection
      if gen ~= generation then return end
      statusText = "Disconnected"
      dlg:modify{ id="status", text="Disconnected" }
      dlg:modify{ id="connectBtn", text="Connect" }
      ws = nil
    end
  end
end

-- Connect button handler
function onConnect()
  if ws then
    -- Disconnect: bump generation so old callbacks are ignored
    generation = generation + 1
    local oldWs = ws
    ws = nil
    oldWs:close()
    statusText = "Disconnected"
    dlg:modify{ id="status", text="Disconnected" }
    dlg:modify{ id="connectBtn", text="Connect" }
    return
  end

  if tokenValue == "" then
    app.alert("Please enter a session token")
    return
  end

  -- Validate: strip beam:// prefix and check for hex chars only
  local stripped = tokenValue:gsub("^beam://", "")
  if not stripped:match("^[0-9a-fA-F]+$") then
    statusText = "Invalid token format"
    dlg:modify{ id="status", text=statusText }
    app.alert("Invalid token format — paste the token from the web app")
    return
  end

  -- Normalize token
  if not tokenValue:match("^beam://") then
    tokenValue = "beam://" .. tokenValue:upper()
  end

  -- Bump generation for the new connection
  generation = generation + 1

  -- Create WebSocket connection
  statusText = "Connecting..."
  dlg:modify{ id="status", text="Connecting..." }
  dlg:modify{ id="connectBtn", text="Connecting..." }

  ws = WebSocket{
    url = syncServerUrl,
    onreceive = createMessageHandler(generation),
    deflate = false
  }

  ws:connect()

  dlg:modify{ id="connectBtn", text="Disconnect" }
end

-- Build dialog
dlg:separator{ text="Session Token" }
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

-- Show dialog
dlg:show{ wait=false }
local bounds = dlg.bounds
dlg.bounds = Rectangle(bounds.x, bounds.y, math.max(bounds.width, 320), bounds.height)
