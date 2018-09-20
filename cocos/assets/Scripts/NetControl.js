module.exports = {
    ip: "ws://" + window.location.hostname + ":8000",
    _socket: {},
    connect: function () {
        this._sock = new WebSocket(this.ip);
    },

    send: function (msg) {
        this._sock.send(JSON.stringify(msg));
    },
}