const netControl = require("NetControl");

cc.Class({
    extends: cc.Component,

    properties: {
        controller: {
			default: null,
			type: require("Controller"),
        },
        connectedNumLabel: {
            default: null,
            type: cc.Label,
        },
        readyNumLabel: {
            default: null,
            type: cc.Label,
        },
        readyBtn: {
            default: null,
            type: cc.Toggle,
        }
    },

    // LIFE-CYCLE CALLBACKS:

    onLoad () {
        netControl._sock.onmessage = this.onPrepareMessage.bind(this);
    },

    onPrepareMessage (event) {
        var data = JSON.parse(event.data);

        if (data.method == "WAITING") {
            this.connectedNumLabel.string = "連線人數: " + data.players_num;
        }
        else if (data.method == "NEEDREADY") {
            this.readyBtn.interactable = true;
            this.controller.needready = true;
        }
        else if (data.method == "CONFIRMREADY") {
            if (data.user == this.controller.user_id) {
                this.readyBtn.color = cc.hexToColor("#6495ED");
                this.controller.onReady = true;
            }

            this.readyNumLabel.string = "準備人數: " + data.player_ready;
        }
        else if (data.method == "START") {
            this.controller.startGame(data);
        }
    },
    
    ready () {
        if (this.controller.needready && !this.controller.onReady) {
            // if (this.readyBtn.isChecked) {
            this.readyBtn.node.getChildByName("Text").getComponent(cc.Label).string = "準備成功";
            this.readyBtn.interactable = false;
            netControl.send({method: "READY"});
            // }
            // else {
            //     this.readyBtn.node.getChildByName("Text").getComponent(cc.Label).string = "準備";
            // }
        }
    }
});
