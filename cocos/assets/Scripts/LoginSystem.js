const netControl = require("NetControl");

cc.Class({
    extends: cc.Component,

    properties: {},

    // LIFE-CYCLE CALLBACKS:

    onLoad () {
        this.nameNode = this.node.getChildByName("NameInput");
        this.secretNode = this.node.getChildByName("SecretInput");
        this.loginBtn = this.node.getChildByName("LoginBtn");
        this.waitingNode = this.node.getChildByName("Waiting");
    },

    start () {
        this.loginBtn.on("touchstart", this.login, this);
        // automatically login
        this.login();
    },

    // update (dt) {},

    login () {
        this.name = this.nameNode.getComponent(cc.EditBox).string;
        this.secret = this.secretNode.getComponent(cc.EditBox).string;

        if (this.name == "" || this.secret == "") {
            return;
        }

        netControl.connect();
        netControl._sock.onopen = this.onLoginOpen.bind(this);
        netControl._sock.onmessage = this.onLoginMessage.bind(this);
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
