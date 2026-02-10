-- Token Sync for Aseprite
-- Syncs design tokens (colors) to the active sprite's palette

-- Check Aseprite version and json support
if not json then
  app.alert("Token Sync requires Aseprite v1.3-rc5 or later (json module not found)")
  return
end

if not WebSocket then
  app.alert("Token Sync requires Aseprite v1.3+ with WebSocket support")
  return
end

local dlg = Dialog("Token Sync")
local tokenValue = ""
local ws = nil
local statusText = "Disconnected"
local syncServerUrl = "ws://localhost:8080"

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
function handleWebSocketMessage(messageType, data)
  if messageType == WebSocketMessageType.OPEN then
    statusText = "Connected - pairing..."
    dlg:modify{ id="status", text=statusText }
    
    -- Send pair message with token (use 'figma' as clientType since we join existing sessions)
    local pairMsg = json.encode({
      type = "pair",
      clientType = "figma",
      sessionToken = tokenValue
    })
    ws:sendText(pairMsg)
    
  elseif messageType == WebSocketMessageType.TEXT then
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
      statusText = "Error: " .. (msg.error or "Unknown error")
      dlg:modify{ id="status", text=statusText }
    end
    
  elseif messageType == WebSocketMessageType.CLOSE then
    statusText = "Disconnected"
    dlg:modify{ 
      id="status", 
      text=statusText,
      id="connectBtn",
      text="Connect"
    }
    ws = nil
  end
end

-- Connect button handler
function onConnect()
  if ws then
    -- Disconnect
    ws:close()
    ws = nil
    statusText = "Disconnected"
    dlg:modify{ 
      id="status", 
      text=statusText,
      id="connectBtn",
      text="Connect"
    }
    return
  end
  
  if tokenValue == "" then
    app.alert("Please enter a session token")
    return
  end
  
  -- Normalize token
  if not tokenValue:match("^dts://") then
    tokenValue = "dts://" .. tokenValue:upper()
  end
  
  -- Create WebSocket connection
  statusText = "Connecting..."
  dlg:modify{ 
    id="status", 
    text=statusText,
    id="connectBtn",
    text="Connecting..."
  }
  
  ws = WebSocket{
    url = syncServerUrl,
    onreceive = handleWebSocketMessage,
    deflate = false
  }
  
  ws:connect()
  
  dlg:modify{ 
    id="connectBtn",
    text="Disconnect"
  }
end

-- Build dialog
dlg:label{ 
  id="title",
  text="Token Sync",
  label=""
}
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
dlg:separator{}
dlg:label{
  text="Server: " .. syncServerUrl,
  label=""
}
dlg:button{ text="Close" }

-- Show dialog
dlg:show{ wait=false }
