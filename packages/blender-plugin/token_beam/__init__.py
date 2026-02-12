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
from urllib.parse import urlparse

import bpy

SYNC_SERVER_URL = "ws://localhost:8080"


try:
    import websocket
except Exception:
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
}


def _hex_to_rgba(hex_value):
    value = hex_value.strip().lstrip("#")
    if len(value) == 3:
        value = "".join([ch * 2 for ch in value])
    if len(value) == 6:
        value += "FF"
    if len(value) != 8:
        raise ValueError("Invalid hex color")

    red = int(value[0:2], 16) / 255.0
    green = int(value[2:4], 16) / 255.0
    blue = int(value[4:6], 16) / 255.0
    alpha = int(value[6:8], 16) / 255.0
    return (red, green, blue, alpha)


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
                except Exception:
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


class TokenBeamState(bpy.types.PropertyGroup):
    pass


TokenBeamState.__annotations__ = {
    "session_token": bpy.props.StringProperty(name="Token", default=""),
    "status": bpy.props.StringProperty(name="Status", default="Disconnected"),
    "is_connected": bpy.props.BoolProperty(name="Connected", default=False),
    "client_id": bpy.props.StringProperty(name="Client ID", default=""),
}


class TokenBeamRuntime:
    ws_app = None
    ws_thread = None
    event_queue = queue.Queue()
    timer_running = False


class TOKENBEAM_OT_connect(bpy.types.Operator):
    bl_idname = "token_beam.connect"
    bl_label = "Connect"

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

        endpoint = _build_endpoint(SYNC_SERVER_URL, normalized)

        def on_open(ws):
            TokenBeamRuntime.event_queue.put(("status", "Connected"))
            TokenBeamRuntime.event_queue.put(("connected", True))

        def on_message(ws, message):
            try:
                data = json.loads(message)
            except Exception:
                return

            if data.get("type") == "registered":
                TokenBeamRuntime.event_queue.put(("client_id", data.get("clientId", "")))
                return

            payload = data.get("payload")
            if isinstance(payload, dict):
                TokenBeamRuntime.event_queue.put(("colors", _extract_colors(payload)))

        def on_error(ws, error):
            TokenBeamRuntime.event_queue.put(("status", f"Error: {error}"))

        def on_close(ws, close_status_code, close_message):
            TokenBeamRuntime.event_queue.put(("connected", False))
            TokenBeamRuntime.event_queue.put(("status", "Disconnected"))
            TokenBeamRuntime.event_queue.put(("client_id", ""))
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
        state.client_id = ""
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
        if state.client_id:
            layout.label(text=f"Client: {state.client_id}")

        layout.separator()
        layout.label(text="Synced colors")
        layout.operator("token_beam.clear_colors", text="Clear Colors")

        box = layout.box()
        if len(scene.token_beam_colors) == 0:
            box.label(text="No colors synced")
        else:
            for item in scene.token_beam_colors:
                row = box.row(align=True)
                swatch = row.row(align=True)
                swatch.prop(item, "value", text="")
                row.label(text=item.token_name)


class TOKENBEAM_OT_clear_colors(bpy.types.Operator):
    bl_idname = "token_beam.clear_colors"
    bl_label = "Clear Colors"

    def execute(self, context):
        context.scene.token_beam_colors.clear()
        return {"FINISHED"}


def _build_endpoint(base_url, token):
    parsed = urlparse(base_url)
    scheme = parsed.scheme if parsed.scheme in ("ws", "wss") else "ws"
    netloc = parsed.netloc or parsed.path
    return f"{scheme}://{netloc}/?token={token}"


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
        elif kind == "client_id":
            state.client_id = str(value)
        elif kind == "colors":
            scene.token_beam_colors.clear()
            for color in value:
                item = scene.token_beam_colors.add()
                item.token_name = color["name"]
                item.value = color["value"]
                item.collection = color["collection"]
                item.mode = color["mode"]

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
