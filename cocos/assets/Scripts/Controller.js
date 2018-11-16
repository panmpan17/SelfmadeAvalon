const jythons = require("Jythons");

cc.Class({
    extends: cc.Component,

    properties: {
        // atlas: {
        //     default: null,
        //     type: cc.SpriteAtlas,
        // },

        images: {
            default: null,
            type: require("TextureMatch"),
        }
    },

    // LIFE-CYCLE CALLBACKS:

    onLoad () {
        this.loginSystem = this.node.getChildByName("LoginSystem").getComponent("LoginSystem");
        this.prepareSystem = this.node.getChildByName("PrepareSystem").getComponent("PrepareSystem");
        this.gameSystem = this.node.getChildByName("GameSystem").getComponent("GameSystem");

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
        this.loginSystem.controller = this;
        this.prepareSystem.controller = this;
        this.gameSystem.controller = this;
    },

    // update (dt) {},

    toPreparePage (data) {
        this.varify = true;
        this.userId = data.id;

        this.loginSystem.node.active = false;
        this.prepareSystem.node.active = true;

        this.prepareSystem.connectedNum.getComponent(cc.Label).string = "連線人數: " + data.players_num;
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
