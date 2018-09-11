cc.Class({
    extends: cc.Component,

    properties: {},

    // LIFE-CYCLE CALLBACKS:

    onLoad () {
        this.board = this.node.getChildByName("Board");
        this.loginSystem = this.node.getChildByName("LoginSystem");

        this.varify = false;
        this.user_id = null;
        this.palyer_num = 0;
    },

    start () {
        this.loginSystem.getComponent("LoginSystem").game = this;
    },

    // update (dt) {},

    toPreparePage (data) {
        this.players_num = data.players_num;
        // $("#waiting-number")[0].innerHTML = players_num;

        this.varify = true;
        this.user_id = data.id;

        this.loginSystem.active = false;
        // 	startHandleMethod();
    }
});
