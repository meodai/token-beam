# Token Beam for Krita
# Syncs design tokens (colors) from any web app to Krita palettes in real-time

import json
import os
import re
import struct
import sys
import math

from PyQt5.QtCore import QUrl, Qt, QTimer, QByteArray, QObject, pyqtSignal, QSize
from PyQt5.QtGui import QFont, QIcon, QColor, QPainter, QCursor
from PyQt5.QtNetwork import QTcpSocket, QAbstractSocket, QSslSocket
from PyQt5.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QGridLayout, QScrollArea,
    QLineEdit, QPushButton, QLabel, QToolTip, QSizePolicy
)

from krita import DockWidget, DockWidgetFactory, DockWidgetFactoryBase, \
    Krita, ManagedColor


SYNC_SERVER_URL = "ws://localhost:8080"


# ---------------------------------------------------------------------------
# Minimal WebSocket client using QTcpSocket
# (Krita doesn't ship PyQt5.QtWebSockets)
# ---------------------------------------------------------------------------

class SimpleWebSocket(QObject):
    """Bare-bones RFC 6455 WebSocket client over QTcpSocket."""

    connected = pyqtSignal()
    textMessageReceived = pyqtSignal(str)
    disconnected = pyqtSignal()
    error = pyqtSignal(str)

    def __init__(self, parent=None):
        super().__init__(parent)
        self._socket = QSslSocket(self)
        self._host = ""
        self._port = 80
        self._path = "/"
        self._handshake_done = False
        self._buffer = QByteArray()
        self._closing = False
        self._using_ssl = False

        self._socket.connected.connect(self._on_tcp_connected)
        self._socket.encrypted.connect(self._on_tcp_connected)
        self._socket.readyRead.connect(self._on_data)
        self._socket.disconnected.connect(self._on_tcp_disconnected)
        self._socket.errorOccurred.connect(self._on_tcp_error)
        
        # Ignore self-signed certs for local/dev use if needed (optional)
        # self._socket.setPeerVerifyMode(QSslSocket.VerifyNone)

    def open(self, url_str):
        self._handshake_done = False
        self._buffer = QByteArray()
        self._closing = False
        self._using_ssl = False

        if url_str.startswith("wss://"):
            self._using_ssl = True
            url_str = url_str[6:]
            default_port = 443
        elif url_str.startswith("ws://"):
            url_str = url_str[5:]
            default_port = 80
        else:
            # Default to ws if no scheme
            default_port = 80

        parts = url_str.split("/", 1)
        host_port = parts[0]
        self._path = "/" + (parts[1] if len(parts) > 1 else "")

        if ":" in host_port:
            self._host, port_str = host_port.rsplit(":", 1)
            self._port = int(port_str)
        else:
            self._host = host_port
            self._port = default_port

        if self._using_ssl:
            self._socket.connectToHostEncrypted(self._host, self._port)
        else:
            self._socket.connectToHost(self._host, self._port)
# Avoid double-handshake if we get both connected and encrypted signals
        if self._handshake_done: 
             return
             
        # For SSL, we wait for encryption. For plain TCP, connected is enough.
        # However, QSslSocket emits connected() then encrypted().
        # We can just proceed on connected() for plain, but for SSL we must wait.
        if self._using_ssl and not self._socket.isEncrypted():
            return

        import base64
        key_bytes = os.urandom(16)
        self._ws_key = base64.b64encode(key_bytes).decode("ascii")
        
        # Note: headers in handshake must end with \r\n
            return
        payload = text.encode("utf-8")
        frame = self._build_frame(0x1, payload)
        self._socket.write(frame)

    def close(self):
        self._closing = True
        if self._handshake_done:
            try:
                self._socket.write(self._build_frame(0x8, b""))
            except Exception:
                pass
        self._socket.disconnectFromHost()

    def _on_tcp_connected(self):
        import base64
        key_bytes = os.urandom(16)
        self._ws_key = base64.b64encode(key_bytes).decode("ascii")
        handshake = (
            "GET {path} HTTP/1.1\r\n"
            "Host: {host}:{port}\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            "Sec-WebSocket-Key: {key}\r\n"
            "Sec-WebSocket-Version: 13\r\n"
            "\r\n"
        ).format(path=self._path, host=self._host,
                 port=self._port, key=self._ws_key)
        self._socket.write(QByteArray(handshake.encode("ascii")))

    def _on_data(self):
        self._buffer.append(self._socket.readAll())
        if not self._handshake_done:
            data = bytes(self._buffer)
            idx = data.find(b"\r\n\r\n")
            if idx == -1:
                return
            header_block = data[:idx].decode("ascii", errors="replace")
            if "101" in header_block.split("\r\n")[0]:
                self._handshake_done = True
                self._buffer = QByteArray(data[idx + 4:])
                self.connected.emit()
            else:
                self.error.emit("WebSocket handshake failed")
                self._socket.disconnectFromHost()
                return
        self._parse_frames()

    def _parse_frames(self):
        while True:
            data = bytes(self._buffer)
            if len(data) < 2:
                return
            opcode = data[0] & 0x0F
            masked = (data[1] >> 7) & 1
            payload_len = data[1] & 0x7F
            offset = 2
            if payload_len == 126:
                if len(data) < 4:
                    return
                payload_len = struct.unpack("!H", data[2:4])[0]
                offset = 4
            elif payload_len == 127:
                if len(data) < 10:
                    return
                payload_len = struct.unpack("!Q", data[2:10])[0]
                offset = 10
            if masked:
                offset += 4
            if len(data) < offset + payload_len:
                return
            payload = data[offset:offset + payload_len]
            self._buffer = QByteArray(data[offset + payload_len:])
            if opcode == 0x1:
                try:
                    self.textMessageReceived.emit(payload.decode("utf-8"))
                except Exception:
                    pass
            elif opcode == 0x8:
                self._socket.disconnectFromHost()
                return
            elif opcode == 0x9:
                self._socket.write(self._build_frame(0xA, payload))

    def _build_frame(self, opcode, payload):
        frame = bytearray()
        frame.append(0x80 | opcode)
        length = len(payload)
        if length < 126:
            frame.append(0x80 | length)
        elif length < 65536:
            frame.append(0x80 | 126)
            frame.extend(struct.pack("!H", length))
        else:
            frame.append(0x80 | 127)
            frame.extend(struct.pack("!Q", length))
        mask = os.urandom(4)
        frame.extend(mask)
        for i, b in enumerate(payload):
            frame.append(b ^ mask[i % 4])
        return QByteArray(bytes(frame))

    def _on_tcp_disconnected(self):
        self._handshake_done = False
        self.disconnected.emit()

    def _on_tcp_error(self, socket_error):
        if not self._closing:
            self.error.emit("Socket error: {}".format(socket_error))


# ---------------------------------------------------------------------------
# Color swatch widget — clickable colored square
# ---------------------------------------------------------------------------

class ColorSwatch(QWidget):
    """A single clickable color tile."""

    def __init__(self, hex_value, name, parent=None):
        super().__init__(parent)
        self._hex = hex_value
        self._name = name
        self._qcolor = QColor(hex_value)
        self.setCursor(QCursor(Qt.PointingHandCursor))
        self.setToolTip("{}\n{}".format(name, hex_value))
        self.setMinimumSize(16, 16)
        self.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)

    def paintEvent(self, event):
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing, False)
        p.fillRect(self.rect(), self._qcolor)
        p.end()

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            self._set_foreground()
        super().mousePressEvent(event)

    def _set_foreground(self):
        """Set this color as Krita's foreground color."""
        try:
            app = Krita.instance()
            view = app.activeWindow().activeView()
            mc = ManagedColor("RGBA", "U8", "sRGB-elle-V2-srgbtrc.icc")
            mc.setComponents([
                self._qcolor.redF(),
                self._qcolor.greenF(),
                self._qcolor.blueF(),
                1.0
            ])
            view.setForeGroundColor(mc)
        except Exception:
            pass

    def sizeHint(self):
        return QSize(24, 24)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def extract_colors(payload):
    """Pull color tokens out of a DTCG-style sync payload."""
    colors = []
    if not payload or "collections" not in payload:
        return colors
    for collection in payload["collections"]:
        for mode in collection.get("modes", []):
            for token in mode.get("tokens", []):
                if token.get("type") == "color":
                    colors.append({
                        "name": token["name"],
                        "value": token["value"],
                        "collection": collection.get("name", ""),
                        "mode": mode.get("name", "")
                    })
    return colors


def validate_token(raw):
    """Validate and normalise a session token. Returns None on failure."""
    stripped = raw.strip().replace("beam://", "")
    if not re.match(r"^[0-9a-fA-F]+$", stripped):
        return None
    return "beam://" + stripped.upper()


# ---------------------------------------------------------------------------
# Dock Widget
# ---------------------------------------------------------------------------

class TokenBeamDocker(DockWidget):

    def __init__(self):
        super().__init__()
        self.setWindowTitle("Token Beam")

        self._ws = None
        self._generation = 0
        self._is_paired = False
        self._session_token = None

        # --- UI ---------------------------------------------------------------
        root = QWidget()
        layout = QVBoxLayout()
        layout.setContentsMargins(8, 8, 8, 8)
        layout.setSpacing(6)

        # Title
        title = QLabel("Token Beam")
        title_font = QFont()
        title_font.setBold(True)
        title.setFont(title_font)
        layout.addWidget(title)

        # Token input row
        token_row = QHBoxLayout()
        token_row.setSpacing(4)
        self._token_input = QLineEdit()
        self._token_input.setPlaceholderText("beam://... or paste hex token")
        self._token_input.returnPressed.connect(self._on_connect_click)
        token_row.addWidget(self._token_input, 1)

        self._connect_btn = QPushButton("Connect")
        self._connect_btn.setFixedWidth(90)
        self._connect_btn.clicked.connect(self._on_connect_click)
        token_row.addWidget(self._connect_btn)
        layout.addLayout(token_row)

        # Status
        self._status_label = QLabel("Disconnected")
        self._status_label.setWordWrap(True)
        layout.addWidget(self._status_label)

        # Color grid (scrollable)
        self._color_grid_widget = QWidget()
        self._color_grid = QGridLayout()
        self._color_grid.setSpacing(2)
        self._color_grid.setContentsMargins(0, 0, 0, 0)
        self._color_grid_widget.setLayout(self._color_grid)

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setWidget(self._color_grid_widget)
        scroll.setMinimumHeight(40)
        scroll.setFrameShape(scroll.NoFrame)
        layout.addWidget(scroll, 1)

        # Save palette button (hidden until colors arrive)
        self._save_btn = QPushButton("Save as Krita Palette")
        self._save_btn.clicked.connect(self._on_save_palette)
        self._save_btn.setVisible(False)
        layout.addWidget(self._save_btn)

        self._last_colors = None

        root.setLayout(layout)
        self.setWidget(root)

    # -- required by DockWidget ------------------------------------------------
    def canvasChanged(self, canvas):
        pass

    # -- connection management -------------------------------------------------

    def _on_connect_click(self):
        if self._ws:
            self._disconnect()
            return

        raw = self._token_input.text().strip()
        if not raw:
            self._set_status("Enter a session token")
            return

        token = validate_token(raw)
        if token is None:
            self._set_status("Invalid token format")
            return

        self._session_token = token
        self._token_input.setText(token)
        self._connect(token)

    def _connect(self, token):
        self._generation += 1
        gen = self._generation

        self._set_status("Connecting...")
        self._connect_btn.setText("Cancel")

        ws = SimpleWebSocket(self)
        ws.connected.connect(lambda: self._on_open(gen))
        ws.textMessageReceived.connect(lambda msg: self._on_message(msg, gen))
        ws.disconnected.connect(lambda: self._on_close(gen))
        ws.error.connect(lambda err: self._on_error(err, gen))

        self._ws = ws
        ws.open(SYNC_SERVER_URL)

    def _disconnect(self):
        self._generation += 1
        self._is_paired = False
        old = self._ws
        self._ws = None
        self._session_token = None
        if old:
            old.close()
        self._connect_btn.setText("Connect")
        self._set_status("Disconnected")

    # -- WebSocket callbacks ---------------------------------------------------

    def _on_open(self, gen):
        if gen != self._generation or not self._ws:
            return
        self._set_status("Connected - pairing...")
        self._ws.sendTextMessage(json.dumps({
            "type": "pair",
            "clientType": "krita",
            "sessionToken": self._session_token
        }))

    def _on_message(self, raw_msg, gen):
        if gen != self._generation or not self._ws:
            return
        try:
            msg = json.loads(raw_msg)
        except json.JSONDecodeError:
            return

        msg_type = msg.get("type")

        if msg_type == "pair":
            origin = msg.get("origin", "unknown")
            self._is_paired = True
            self._set_status("Paired with {} - waiting for data...".format(origin))
            self._connect_btn.setText("Disconnect")

        elif msg_type == "sync":
            colors = extract_colors(msg.get("payload"))
            if colors:
                self._apply_colors(colors)
                self._set_status("{} colors synced".format(len(colors)))
            else:
                self._set_status("No colors found in payload")

        elif msg_type == "error":
            err = msg.get("error", "Unknown error")
            if err.startswith("[warn]"):
                self._set_status(err[7:])
            elif err == "Invalid session token":
                self._set_status("Session not found")
                self._disconnect()
            else:
                self._set_status("Error: " + err)

        elif msg_type == "ping":
            try:
                self._ws.sendTextMessage(json.dumps({"type": "pong"}))
            except Exception:
                pass

    def _on_close(self, gen):
        if gen != self._generation:
            return
        self._ws = None
        self._is_paired = False
        self._connect_btn.setText("Connect")
        self._set_status("Disconnected")

    def _on_error(self, err_msg, gen):
        if gen != self._generation:
            return
        self._set_status("Connection error: {}".format(err_msg))

    # -- color application -----------------------------------------------------

    def _apply_colors(self, colors):
        """Display synced colors in the grid."""
        self._last_colors = colors
        self._rebuild_color_grid(colors)
        self._save_btn.setVisible(True)

        try:
            app = Krita.instance()
            app.activeWindow().activeView().showFloatingMessage(
                "Token Beam: {} colors synced".format(len(colors)),
                QIcon(), 2000, 0
            )
        except Exception:
            pass

    def _on_save_palette(self):
        """Save the current synced colors as a .gpl palette file."""
        if not self._last_colors:
            return
        self._write_gpl_palette(self._last_colors)
        name = "Token Beam"
        if self._last_colors and self._last_colors[0].get("collection"):
            name = self._last_colors[0]["collection"]
        self._set_status("Saved palette '{}' — restart Krita to see it "
                         "in the Palette docker".format(name))

    def _rebuild_color_grid(self, colors):
        """Replace the color grid with new swatches."""
        # Clear existing swatches
        while self._color_grid.count():
            item = self._color_grid.takeAt(0)
            w = item.widget()
            if w:
                w.deleteLater()

        # Calculate columns based on docker width
        cols = max(4, min(len(colors), 8))

        for i, c_data in enumerate(colors):
            row = i // cols
            col = i % cols
            swatch = ColorSwatch(c_data["value"], c_data["name"], self)
            self._color_grid.addWidget(swatch, row, col)

    def _write_gpl_palette(self, colors):
        """Persist colors as a .gpl file for next Krita startup."""
        name = "Token Beam"
        if colors and colors[0].get("collection"):
            name = colors[0]["collection"]

        lines = ["GIMP Palette", "Name: {}".format(name), "Columns: 8", "#"]
        for c_data in colors:
            h = c_data["value"].lstrip("#")
            if len(h) == 3:
                h = "".join(ch * 2 for ch in h)
            r = int(h[0:2], 16)
            g = int(h[2:4], 16)
            b = int(h[4:6], 16)
            lines.append("{:>3} {:>3} {:>3}\t{}".format(r, g, b, c_data["name"]))

        palette_dir = self._get_palette_dir()
        if not palette_dir:
            return

        safe_name = re.sub(r"[^a-zA-Z0-9_\- ]", "", name).strip() or "token-beam"
        filepath = os.path.join(palette_dir, safe_name + ".gpl")

        try:
            os.makedirs(palette_dir, exist_ok=True)
            with open(filepath, "w", encoding="utf-8") as f:
                f.write("\n".join(lines) + "\n")
        except Exception:
            pass

    def _get_palette_dir(self):
        """Return the writable palettes directory for the current platform."""
        try:
            res = Krita.instance().readSetting("", "ResourceDirectory", "")
            if res:
                d = os.path.join(res, "palettes")
                if os.path.isdir(os.path.dirname(d)):
                    return d
        except Exception:
            pass

        home = os.path.expanduser("~")
        if sys.platform == "darwin":
            return os.path.join(home, "Library", "Application Support",
                                "krita", "palettes")
        elif sys.platform == "win32":
            appdata = os.environ.get("APPDATA", "")
            if appdata:
                return os.path.join(appdata, "krita", "palettes")
        xdg = os.environ.get("XDG_DATA_HOME",
                             os.path.join(home, ".local", "share"))
        return os.path.join(xdg, "krita", "palettes")

    # -- UI helpers ------------------------------------------------------------

    def _set_status(self, text):
        self._status_label.setText(text)


# ---------------------------------------------------------------------------
# Register
# ---------------------------------------------------------------------------

Krita.instance().addDockWidgetFactory(
    DockWidgetFactory(
        "tokenBeamDocker",
        DockWidgetFactoryBase.DockRight,
        TokenBeamDocker
    )
)
