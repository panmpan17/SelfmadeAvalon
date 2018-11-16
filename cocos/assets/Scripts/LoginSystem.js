const netControl = require("NetControl");

cc.Class({
    extends: cc.Component,

    properties: {
		controller: {
			default: null,
			type: require("Controller"),
        },
        nameInput: {
            default: null,
            type: cc.EditBox,
        },
        secretInput: {
            default: null,
            type: cc.EditBox,
        },
        waitingNode: {
            default: null,
            type: cc.Node,
        },
        hostInput: {
            default: null,
            type: cc.EditBox,
        },
        portInput: {
            default: null,
            type: cc.EditBox,
        },
    },

    // LIFE-CYCLE CALLBACKS:

    onLoad () {
        this.hostInput.string = window.location.hostname;
    },

    login () {
        this.name = this.nameInput.string;
        this.secret = this.secretInput.string;

        if (this.name == "" || this.secret == "") {
            return;
        }

        netControl.ip = "ws://" + this.hostInput.string + ":" + this.portInput.string;
        netControl.connect();
        netControl._sock.onopen = this.onLoginOpen.bind(this);
        netControl._sock.onmessage = this.onLoginMessage.bind(this);
        netControl._sock.onclose = function(e) {
            alert("沒有連線");
        }
    },

    onLoginOpen: function () {
        this.waitingNode.active = true;
        netControl.send({
            method: "LOGIN",
            name: this.name,
            secret: this.secret,
        });
    },
    onLoginMessage: function (event) {
        var data = JSON.parse(event.data);

        if (data.method == "VARIFYFAIL") {
            alert("failed");
            this.waitingNode.active = false;
            return;
        }
		else if (data.method == "WAITING") {
            this.waitingNode.active = false;
            this.controller.toPreparePage(data);
		}
    },
});
