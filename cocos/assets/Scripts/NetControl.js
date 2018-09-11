module.exports = {
    ip: "ws://localhost:8000",
    _socket: {},
    connect: function () {
        this._sock = new WebSocket(this.ip);
            // this._sock.onopen = this.onOpen.bind(this);
            // this._sock.onclose = this.onClose.bind(this);
            // this._sock.onmessage = this.onMessage.bind(this);
    },

    onClose: function (err) {},

    send: function (msg) {
        this._sock.send(JSON.stringify(msg));
    },
}