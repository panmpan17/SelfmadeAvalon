cc.Class({
    extends: cc.Component,

    properties: {},

    // LIFE-CYCLE CALLBACKS:

    onLoad () {
        this.card = this.node.getChildByName("Card");
        this.captainMark = this.node.getChildByName("Captain");
        this.missionMark = this.node.getChildByName("Mission");
        this.voteMark = this.node.getChildByName("Vote");
        this.foldedMissionMark = this.node.getChildByName("Foldedmission");
    },

    start () {

    },

    // update (dt) {},
});
