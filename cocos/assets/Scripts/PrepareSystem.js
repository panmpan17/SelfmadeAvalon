const netControl = require("NetControl");

cc.Class({
    extends: cc.Component,

    properties: {},

    // LIFE-CYCLE CALLBACKS:

    onLoad () {
        this.connectedNum = this.node.getChildByName("ReadyNum").getChildByName("ConnectedText");
        this.readyNum = this.node.getChildByName("ReadyNum").getChildByName("ReadyText");
        this.readyBtn = this.node.getChildByName("ReadyBtn");

        netControl._sock.onmessage = this.onPrepareMessage.bind(this);
        this.readyBtn.on("touchstart", this.ready, this);
    },

    start () {

    },

    // update (dt) {},

    onPrepareMessage (event) {
        var data = JSON.parse(event.data);

        if (data.method == "WAITING") {
            this.connectedNum.getComponent(cc.Label).string = "連線人數: " + data.players_num;
        }
        else if (data.method == "NEEDREADY") {
            this.readyBtn.color = cc.hexToColor("#FF6347");
            this.controller.needready = true;

            // automatically ready
            this.ready();
        }
        else if (data.method == "CONFIRMREADY") {
            if (data.user == this.controller.user_id) {
                this.readyBtn.color = cc.hexToColor("#6495ED");
                this.controller.onReady = true;
            }

            this.readyNum.getComponent(cc.Label).string = "準備人數: " + data.player_ready;
        }
        else if (data.method == "START") {
            this.controller.startGame(data);
        }
    },
    
    ready () {
        if (this.controller.needready && !this.controller.onReady) {
            netControl.send({method: "READY"});
        }
    }
});
