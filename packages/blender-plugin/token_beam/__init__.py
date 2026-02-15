bl_info = {
    "name": "Token Beam",
    "author": "Token Beam",
    "version": (0, 1, 0),
    "blender": (3, 0, 0),
    "location": "View3D > Sidebar > Token Beam",
    "description": "Sync design token colors via WebSocket",
    "category": "3D View",
}

import json
import re
import threading
import queue

import bpy

SYNC_SERVER_URL = "wss://token-beam.fly.dev"


try:
    import websocket
except ImportError:
    websocket = None


class TokenBeamColor(bpy.types.PropertyGroup):
    pass


TokenBeamColor.__annotations__ = {
    "token_name": bpy.props.StringProperty(name="Name"),
    "value": bpy.props.FloatVectorProperty(
        name="Color", size=4, min=0.0, max=1.0, subtype="COLOR"
    ),
    "collection": bpy.props.StringProperty(name="Collection"),
    "mode": bpy.props.StringProperty(name="Mode"),
    "material_name": bpy.props.StringProperty(name="Material", default=""),
}


def _srgb_to_linear(channel):
    if channel <= 0.04045:
        return channel / 12.92
    return ((channel + 0.055) / 1.055) ** 2.4


def _linear_to_srgb(channel):
    if channel <= 0.0031308:
        return channel * 12.92
    return 1.055 * (channel ** (1.0 / 2.4)) - 0.055


def _hex_to_rgba(hex_value):
    value = hex_value.strip().lstrip("#")
    if len(value) == 3:
        value = "".join([ch * 2 for ch in value])
    if len(value) == 6:
        value += "FF"
    if len(value) != 8:
        raise ValueError("Invalid hex color")

    red_srgb = int(value[0:2], 16) / 255.0
    green_srgb = int(value[2:4], 16) / 255.0
    blue_srgb = int(value[4:6], 16) / 255.0
    alpha = int(value[6:8], 16) / 255.0
    return (
        _srgb_to_linear(red_srgb),
        _srgb_to_linear(green_srgb),
        _srgb_to_linear(blue_srgb),
        alpha,
    )


def _normalize_token(raw):
    stripped = raw.strip().replace("beam://", "")
    if not re.match(r"^[0-9a-fA-F]+$", stripped):
        return None
    return f"beam://{stripped.upper()}"


def _extract_colors(payload):
    colors = []
    collections = payload.get("collections", [])
    for collection in collections:
        for mode in collection.get("modes", []):
            for token in mode.get("tokens", []):
                if token.get("type") != "color":
                    continue
                try:
                    rgba = _hex_to_rgba(str(token.get("value", "")))
                except (ValueError, IndexError):
                    print(f"[Token Beam] Skipping invalid color: {token.get('name', '?')} = {token.get('value', '?')}")
                    continue

                colors.append(
                    {
                        "name": token.get("name", "unnamed"),
                        "value": rgba,
                        "collection": collection.get("name", ""),
                        "mode": mode.get("name", ""),
                    }
                )
    return colors


def _token_material_name(token_name, collection="", mode=""):
    parts = []
    if collection:
        parts.append(collection)
    parts.append(token_name)
    if mode and mode != "Value":
        parts.append(mode)
    combined = "_".join(parts)
    safe_name = re.sub(r"[^a-zA-Z0-9_]+", "_", combined).strip("_")
    if not safe_name:
        safe_name = "unnamed"
    return f"TB_{safe_name}"


def _ensure_token_material(token_name, rgba, collection="", mode=""):
    material_name = _token_material_name(token_name, collection, mode)
    material = bpy.data.materials.get(material_name)
    if material is None:
        material = bpy.data.materials.new(name=material_name)

    material.use_nodes = True

    principled = None
    if material.node_tree:
        for node in material.node_tree.nodes:
            if node.type == "BSDF_PRINCIPLED":
                principled = node
                break

    if principled is not None:
        principled.inputs["Base Color"].default_value = rgba

    material.diffuse_color = rgba
    return material_name


PALETTE_NAME = "Token Beam"


def _sync_palette(colors):
    """Sync colors to a native Blender palette (linear RGB, RGB only)."""
    palette = bpy.data.palettes.get(PALETTE_NAME)
    if palette is None:
        palette = bpy.data.palettes.new(PALETTE_NAME)

    # Clear existing palette colors
    while len(palette.colors) > 0:
        palette.colors.remove(palette.colors[0])

    for color in colors:
        entry = palette.colors.new()
        rgba = color["value"]
        entry.color = (
            rgba[0],
            rgba[1],
            rgba[2],
        )

    # Auto-assign palette to all paint settings so it shows in our panel
    # and in the brush color picker without manual selection
    try:
        ts = bpy.context.tool_settings
        for attr in ("image_paint", "vertex_paint", "gpencil_paint"):
            ps = getattr(ts, attr, None)
            if ps is not None and ps.palette != palette:
                ps.palette = palette
    except Exception:
        pass


class TokenBeamState(bpy.types.PropertyGroup):
    pass


TokenBeamState.__annotations__ = {
    "session_token": bpy.props.StringProperty(name="Token", default=""),
    "status": bpy.props.StringProperty(name="Status", default="Disconnected"),
    "is_connected": bpy.props.BoolProperty(name="Connected", default=False),
}


class TokenBeamRuntime:
    ws_app = None
    ws_thread = None
    event_queue = queue.Queue()
    timer_running = False


def _runtime_is_connected():
    ws_app = TokenBeamRuntime.ws_app
    ws_thread = TokenBeamRuntime.ws_thread
    return ws_app is not None and ws_thread is not None and ws_thread.is_alive()


class TOKENBEAM_OT_connect(bpy.types.Operator):
    bl_idname = "token_beam.connect"
    bl_label = "Connect"
    bl_description = "Connect to Token Beam sync server"

    def execute(self, context):
        state = context.scene.token_beam_state

        if websocket is None:
            state.status = "Missing dependency: websocket-client"
            return {"CANCELLED"}

        normalized = _normalize_token(state.session_token)
        if not normalized:
            state.status = "Invalid token format"
            return {"CANCELLED"}

        if TokenBeamRuntime.ws_app is not None:
            state.status = "Already connected"
            return {"FINISHED"}

        endpoint = SYNC_SERVER_URL

        def on_open(ws):
            TokenBeamRuntime.event_queue.put(("status", "Connected - pairing..."))
            try:
                ws.send(
                    json.dumps(
                        {
                            "type": "pair",
                            "clientType": "blender",
                            "sessionToken": normalized,
                        }
                    )
                )
            except Exception as error:
                TokenBeamRuntime.event_queue.put(("status", f"Error: {error}"))

        def on_message(ws, message):
            try:
                data = json.loads(message)
            except Exception:
                return

            msg_type = data.get("type")

            if msg_type == "pair":
                TokenBeamRuntime.event_queue.put(("connected", True))
                origin = data.get("origin", "unknown")
                TokenBeamRuntime.event_queue.put(
                    ("status", f"Paired with {origin} - waiting for data...")
                )
                return

            if msg_type == "sync":
                payload = data.get("payload")
                if not isinstance(payload, dict):
                    TokenBeamRuntime.event_queue.put(("status", "No payload in sync message"))
                    return
                colors = _extract_colors(payload)
                TokenBeamRuntime.event_queue.put(("colors", colors))
                if colors:
                    TokenBeamRuntime.event_queue.put(
                        ("status", f"{len(colors)} colors synced")
                    )
                else:
                    TokenBeamRuntime.event_queue.put(("status", "No colors found in payload"))
                return

            if msg_type == "error":
                error_text = data.get("error", "Unknown error")
                if isinstance(error_text, str) and error_text.startswith("[warn]"):
                    TokenBeamRuntime.event_queue.put(("status", error_text[7:].strip()))
                elif error_text == "Invalid session token":
                    TokenBeamRuntime.event_queue.put(("status", "Session not found"))
                else:
                    TokenBeamRuntime.event_queue.put(("status", f"Error: {error_text}"))
                return

            if msg_type == "ping":
                try:
                    ws.send(json.dumps({"type": "pong"}))
                except Exception:
                    pass

        def on_error(ws, error):
            TokenBeamRuntime.event_queue.put(("connected", False))
            TokenBeamRuntime.event_queue.put(("status", f"Error: {error}"))
            TokenBeamRuntime.ws_app = None
            TokenBeamRuntime.ws_thread = None

        def on_close(ws, close_status_code, close_message):
            TokenBeamRuntime.event_queue.put(("connected", False))
            TokenBeamRuntime.event_queue.put(("status", "Disconnected"))
            TokenBeamRuntime.ws_app = None
            TokenBeamRuntime.ws_thread = None

        ws_app = websocket.WebSocketApp(
            endpoint,
            on_open=on_open,
            on_message=on_message,
            on_error=on_error,
            on_close=on_close,
        )

        ws_thread = threading.Thread(target=ws_app.run_forever, daemon=True)
        TokenBeamRuntime.ws_app = ws_app
        TokenBeamRuntime.ws_thread = ws_thread
        ws_thread.start()

        _ensure_timer(context)
        state.status = "Connecting..."
        return {"FINISHED"}


class TOKENBEAM_OT_disconnect(bpy.types.Operator):
    bl_idname = "token_beam.disconnect"
    bl_label = "Disconnect"
    bl_description = "Disconnect from Token Beam sync server"

    def execute(self, context):
        state = context.scene.token_beam_state
        if TokenBeamRuntime.ws_app is not None:
            try:
                TokenBeamRuntime.ws_app.close()
            except Exception:
                pass

        TokenBeamRuntime.ws_app = None
        TokenBeamRuntime.ws_thread = None
        state.is_connected = False
        state.status = "Disconnected"
        return {"FINISHED"}


class TOKENBEAM_PT_panel(bpy.types.Panel):
    bl_label = "Token Beam"
    bl_idname = "TOKENBEAM_PT_panel"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "Token Beam"

    def draw(self, context):
        layout = self.layout
        scene = context.scene
        state = scene.token_beam_state
        runtime_connected = _runtime_is_connected() and state.is_connected

        layout.prop(state, "session_token", text="Token")

        if runtime_connected:
            layout.operator("token_beam.disconnect", text="Disconnect", icon="CANCEL")
        else:
            layout.operator("token_beam.connect", text="Connect", icon="LINKED")

        layout.label(text=f"Status: {state.status}")

        layout.separator()

        # Always show the synced color list first
        num_colors = len(scene.token_beam_colors)
        if num_colors > 0:
            layout.label(text=f"Synced colors ({num_colors})")
        else:
            layout.label(text="Synced colors")

        box = layout.box()
        if num_colors == 0:
            box.label(text="No colors synced")
        else:
            for index, item in enumerate(scene.token_beam_colors):
                row = box.row(align=True)
                swatch = row.row(align=True)
                swatch.ui_units_x = 2
                swatch.prop(item, "value", text="")
                row.label(text=item.token_name)
                apply_op = row.operator("token_beam.apply_color", text="", icon="FORWARD")
                apply_op.color_index = index

        # Show native Blender palette grid if available (paint modes only)
        try:
            palette = bpy.data.palettes.get(PALETTE_NAME)
            if palette and len(palette.colors) > 0:
                ts = context.tool_settings
                paint_settings = None
                for attr in ("image_paint", "vertex_paint", "gpencil_paint"):
                    ps = getattr(ts, attr, None)
                    if ps is not None and ps.palette == palette:
                        paint_settings = ps
                        break
                if paint_settings is not None:
                    layout.separator()
                    layout.label(text=f"Palette: {PALETTE_NAME}")
                    layout.template_palette(paint_settings, "palette", color=True)
        except Exception:
            pass


class TOKENBEAM_OT_apply_color(bpy.types.Operator):
    bl_idname = "token_beam.apply_color"
    bl_label = "Apply Color"
    bl_description = "Apply this color as a material on the active mesh"

    color_index: bpy.props.IntProperty(default=-1)

    @classmethod
    def poll(cls, context):
        obj = context.active_object
        return obj is not None and obj.type == "MESH"

    def execute(self, context):
        scene = context.scene
        if self.color_index < 0 or self.color_index >= len(scene.token_beam_colors):
            return {"CANCELLED"}

        color_item = scene.token_beam_colors[self.color_index]

        material_name = color_item.material_name or _ensure_token_material(
            color_item.token_name, color_item.value, color_item.collection, color_item.mode
        )
        material = bpy.data.materials.get(material_name)
        if material is None:
            self.report({"WARNING"}, "Token material not found")
            return {"CANCELLED"}

        context.active_object.active_material = material
        self.report({"INFO"}, f"Applied {color_item.token_name}")
        return {"FINISHED"}


def _drain_events():
    scene = bpy.context.scene if bpy.context else None
    if scene is None:
        return 0.5

    state = scene.token_beam_state
    if state.is_connected and not _runtime_is_connected():
        state.is_connected = False
        state.status = "Disconnected"
        TokenBeamRuntime.ws_app = None
        TokenBeamRuntime.ws_thread = None

    while True:
        try:
            kind, value = TokenBeamRuntime.event_queue.get_nowait()
        except queue.Empty:
            break

        if kind == "status":
            state.status = value
        elif kind == "connected":
            state.is_connected = bool(value)
        elif kind == "colors":
            scene.token_beam_colors.clear()
            for color in value:
                material_name = _ensure_token_material(
                    color["name"], color["value"], color.get("collection", ""), color.get("mode", "")
                )
                item = scene.token_beam_colors.add()
                item.token_name = color["name"]
                item.value = color["value"]
                item.collection = color["collection"]
                item.mode = color["mode"]
                item.material_name = material_name
            _sync_palette(value)

    return 0.5


def _ensure_timer(_context):
    if TokenBeamRuntime.timer_running:
        return
    bpy.app.timers.register(_drain_events, persistent=True)
    TokenBeamRuntime.timer_running = True


classes = (
    TokenBeamColor,
    TokenBeamState,
    TOKENBEAM_OT_connect,
    TOKENBEAM_OT_disconnect,
    TOKENBEAM_OT_apply_color,
    TOKENBEAM_PT_panel,
)


def register():
    for cls in classes:
        bpy.utils.register_class(cls)

    bpy.types.Scene.token_beam_state = bpy.props.PointerProperty(type=TokenBeamState)
    bpy.types.Scene.token_beam_colors = bpy.props.CollectionProperty(type=TokenBeamColor)


def unregister():
    if TokenBeamRuntime.ws_app is not None:
        try:
            TokenBeamRuntime.ws_app.close()
        except Exception:
            pass

    if hasattr(bpy.types.Scene, "token_beam_state"):
        del bpy.types.Scene.token_beam_state
    if hasattr(bpy.types.Scene, "token_beam_colors"):
        del bpy.types.Scene.token_beam_colors

    for cls in reversed(classes):
        bpy.utils.unregister_class(cls)
