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

SYNC_SERVER_URL = "ws://localhost:8080"


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
            TokenBeamRuntime.event_queue.put(("status", f"Error: {error}"))

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

        layout.prop(state, "session_token", text="Token")

        row = layout.row(align=True)
        row.operator("token_beam.connect", text="Connect")
        row.operator("token_beam.disconnect", text="Disconnect")

        layout.label(text=f"Status: {state.status}")

        layout.separator()
        layout.label(text="Synced colors")
        layout.operator("token_beam.clear_colors", text="Clear Colors")

        box = layout.box()
        if len(scene.token_beam_colors) == 0:
            box.label(text="No colors synced")
        else:
            for index, item in enumerate(scene.token_beam_colors):
                row = box.row(align=True)
                swatch = row.row(align=True)
                swatch.ui_units_x = 2
                swatch.prop(item, "value", text="")
                label = item.token_name
                if item.collection:
                    label = f"{item.collection} / {label}"
                row.label(text=label)
                apply_op = row.operator("token_beam.apply_color", text="Apply")
                apply_op.color_index = index


class TOKENBEAM_OT_clear_colors(bpy.types.Operator):
    bl_idname = "token_beam.clear_colors"
    bl_label = "Clear Colors"
    bl_description = "Remove all synced colors from the list"

    def execute(self, context):
        context.scene.token_beam_colors.clear()
        return {"FINISHED"}


class TOKENBEAM_OT_apply_color(bpy.types.Operator):
    bl_idname = "token_beam.apply_color"
    bl_label = "Apply Color"
    bl_description = "Apply this color as a material on the active mesh"

    color_index: bpy.props.IntProperty(default=-1)

    def execute(self, context):
        scene = context.scene
        if self.color_index < 0 or self.color_index >= len(scene.token_beam_colors):
            return {"CANCELLED"}

        active_obj = context.active_object
        if active_obj is None:
            self.report({"WARNING"}, "No active object")
            return {"CANCELLED"}

        if active_obj.type != "MESH":
            self.report({"WARNING"}, "Active object must be a mesh")
            return {"CANCELLED"}

        color_item = scene.token_beam_colors[self.color_index]

        material_name = color_item.material_name or _ensure_token_material(
            color_item.token_name, color_item.value, color_item.collection, color_item.mode
        )
        material = bpy.data.materials.get(material_name)
        if material is None:
            self.report({"WARNING"}, "Token material not found")
            return {"CANCELLED"}

        active_obj.active_material = material
        self.report({"INFO"}, f"Applied {color_item.token_name} ({material_name})")
        return {"FINISHED"}


def _drain_events():
    scene = bpy.context.scene if bpy.context else None
    if scene is None:
        return 0.5

    state = scene.token_beam_state
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
    TOKENBEAM_OT_clear_colors,
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
