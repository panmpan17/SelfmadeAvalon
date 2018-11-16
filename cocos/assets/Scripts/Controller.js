const jythons = require("Jythons");

cc.Class({
    extends: cc.Component,

    properties: {
        images: {
            default: null,
            type: require("TextureMatch"),
        },
        loginSystemNode: {
            default: null,
            type: cc.Node,
        },
        prepareSystemNode: {
            default: null,
            type: cc.Node,
        },
        gameSystemNode: {
            default: null,
            type: cc.Node,
        },
        connectNumLabel: {
            default: null,
            type: cc.Label,
        }
    },

    // LIFE-CYCLE CALLBACKS:

    onLoad () {
        this.varify = false;
        this.userId = null;
        this.needready = false;
        this.onReady = false;

        this.role = null;
        this.specialPower = [];
        this.players = [];
        this.hasPercival = false;
        this.players_num = 0;
        this.tokenNeed = null;
    },

    start () {
        this.loginSystem = this.loginSystemNode.getComponent("LoginSystem");
        this.prepareSystem = this.prepareSystemNode.getComponent("PrepareSystem");
        this.gameSystem = this.gameSystemNode.getComponent("GameSystem");
    },

    // update (dt) {},

    toPreparePage (data) {
        this.varify = true;
        this.userId = data.id;

        this.loginSystem.node.active = false;
        this.prepareSystem.node.active = true;

        this.connectNumLabel.string = "連線人數: " + data.players_num;
    },

    startGame (data) {
        this.needready = false;
        this.onReady = false;

        this.role = data.role;
        this.specialPower = data.special_power;
        this.players = data.players;
        this.hasPercival = data.has_percival;
        this.tokenNeed = data.token_need;
        this.players_num = data.players.length;
        this.characters = data.characters;

        this.prepareSystem.node.active = false;
        this.gameSystem.node.active = true;
    }
});
