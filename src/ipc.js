const net = require('net');
const EventEmitter = require('events');

const OP = {
  HANDSHAKE: 0,
  FRAME: 1,
  CLOSE: 2,
  PING: 3,
  PONG: 4
};

class DiscordIPC extends EventEmitter {
  constructor(clientId) {
    super();
    this.clientId = clientId;
    this.socket = null;
    this.connected = false;
    this.buffer = Buffer.alloc(0);
    this.reconnectTimer = null;
    this.shouldReconnect = true;
  }

  // Packs opcode + length + payload into Discord IPC frame
  encode(opcode, payload) {
    const json = JSON.stringify(payload);
    const len = Buffer.byteLength(json, 'utf8');
    const packet = Buffer.alloc(8 + len);
    packet.writeUInt32LE(opcode, 0);
    packet.writeUInt32LE(len, 4);
    packet.write(json, 8, len, 'utf8');
    return packet;
  }

  connect() {
    this.shouldReconnect = true;
    this._probe(0);
  }

  _probe(id) {
    if (!this.shouldReconnect) return;

    if (id > 9) {
      // Discord not running or pipe busy, retry cycle in 5s
      this.reconnectTimer = setTimeout(() => this._probe(0), 5000);
      return;
    }

    const pipe = `\\\\.\\pipe\\discord-ipc-${id}`;
    const sock = net.createConnection(pipe, () => {
      this.socket = sock;
      this.connected = true;
      this.buffer = Buffer.alloc(0);
      this.emit('connected', pipe);
      this._handshake();
    });

    sock.on('data', chunk => this._onData(chunk));

    sock.on('error', () => {
      if (!this.connected) {
        sock.destroy();
        this._probe(id + 1);
      }
    });

    sock.on('close', () => {
      const wasUp = this.connected;
      this.connected = false;
      this.socket = null;
      if (wasUp) this.emit('disconnected');

      if (this.shouldReconnect) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => this._probe(0), 5000);
      }
    });
  }

  _handshake() {
    if (!this.socket || this.socket.destroyed) return;
    this.socket.write(this.encode(OP.HANDSHAKE, { v: 1, client_id: this.clientId }));
  }

  _onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    while (this.buffer.length >= 8) {
      const opcode = this.buffer.readUInt32LE(0);
      const len = this.buffer.readUInt32LE(4);

      if (this.buffer.length < 8 + len) break;

      const body = this.buffer.slice(8, 8 + len);
      this.buffer = this.buffer.slice(8 + len);

      try {
        const data = JSON.parse(body.toString('utf8'));
        this._dispatch(opcode, data);
      } catch (e) {
        this.emit('error', e);
      }
    }
  }

  _dispatch(opcode, data) {
    if (opcode === OP.PING) {
      if (this.socket && !this.socket.destroyed) {
        this.socket.write(this.encode(OP.PONG, data));
      }
      return;
    }

    if (opcode === OP.FRAME) {
      if (data.evt === 'READY') {
        this.emit('ready', data.data);
      } else if (data.cmd === 'SET_ACTIVITY') {
        this.emit('activity_set', data.data);
      }
    }
  }

  setActivity(activity) {
    if (!this.connected || !this.socket || this.socket.destroyed) return false;

    const payload = {
      cmd: 'SET_ACTIVITY',
      args: {
        pid: process.pid,
        activity: activity || null
      },
      nonce: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    };

    this.socket.write(this.encode(OP.FRAME, payload));
    return true;
  }

  disconnect() {
    this.shouldReconnect = false;
    clearTimeout(this.reconnectTimer);
    if (this.socket && !this.socket.destroyed) {
      this.setActivity(null);
      this.socket.end();
      this.socket.destroy();
    }
    this.connected = false;
  }
}

module.exports = { DiscordIPC };
