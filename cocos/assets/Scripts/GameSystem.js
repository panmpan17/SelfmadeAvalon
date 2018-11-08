const netControl = require("NetControl");
const jythons = require("Jythons");

cc.Class({
    extends: cc.Component,

    properties: {
        playerPrefab: {
            default: null,
            type: cc.Prefab,
		},
    },

    // LIFE-CYCLE CALLBACKS:

    onLoad () {
        this.captain = null;
        this.round = 0;
        this.failed = 0;
        this.chosing = false;
		this.confirming = false;
		this.assassin = false;
        this.teamates = [];
        
		this.board = this.node.getChildByName("Board");
		this.failedGroup = this.board.getChildByName("Failed");
		this.confirm = this.board.getChildByName("Confirm");

        this.cards = this.node.getChildByName("Cards");
		this.showCards = this.node.getChildByName("ShowCards");

        this.story = this.node.getChildByName("Story");
		this.storytext = this.story.getChildByName("Text").getComponent(cc.Label);

		this.vote = this.node.getChildByName("Vote");
		this.reject = this.vote.getChildByName("Reject");
		this.approve = this.vote.getChildByName("Approve");

		this.mission = this.node.getChildByName("Mission");
		this.success = this.mission.getChildByName("Success");
		this.fail = this.mission.getChildByName("Fail");

		this.tokenGroup = this.board.getChildByName("Token");

        this.STORYTIME = 4;
        this.PERCIVALSTORY = [
            {text: "派西維爾睜眼\n魔甘娜和梅林豎起大拇指", callback: this.percivalSee.bind(this)},
            {text: "派西維爾閉眼\n魔甘娜和梅林把手收起來"},
        ]
        this.ENDSTORY = {text: "天亮了\n所有人睜開眼睛", callback: this.storyEn.bind(this)};

        this.storyNum = 0;
        this.storySequence = [
            {text: "天黑請閉眼", callback: null},
            {text: "壞人請睜眼相認", callback: this.evilSee.bind(this)},
            {text: "壞人請閉眼", callback: null},
            {text: "梅林睜眼\n除了莫德雷德\n壞人豎起大拇指", callback: this.merlinSee.bind(this)},
            {text: "梅林閉眼\n壞人把手收起來", callback: null},
        ];
    },

    start () {
        if (this.controller.hasPercival) {
            this.storySequence = this.storySequence.concat(this.PERCIVALSTORY);
        }
        this.storySequence.push(this.ENDSTORY);

        this.spawnCards();
		this.showStory();
		netControl._sock.onmessage = this.onPrepareMessage.bind(this);

		this.confirm.on("touchstart", function () {
			if (this.captain != this.controller.userId) {return;}

			if (this.teamates.length == this.controller.tokenNeed["numbers"][this.round]) {
				netControl.send({method: "COMFIRMTEAM"});
			}
		}.bind(this));

		this.reject.on("touchstart", function () {
			netControl.send({method: "REJECT"});
		}.bind(this));
		this.approve.on("touchstart", function () {
			netControl.send({method: "APPROVE"});
		}.bind(this));

		this.success.on("touchstart", function () {
			netControl.send({method: "SUCCESS"});
		}.bind(this));
		this.fail.on("touchstart", function () {
			netControl.send({method: "FAIL"});
		}.bind(this));
    },

    // update (dt) {},

    changeBoard (num) {
        this.board.getComponent(cc.Sprite).spriteFrame = this.controller.atlas._spriteFrames["b" + num];
    },

    spawnCards () {
        var x = 0;
        jythons.foreach(this.controller.players, function (i, player) {
        	console.log(player);
            var card = cc.instantiate(this.playerPrefab);
            card.x += x;
            x += 100;
            card.name = player[0];
            var index = i + 1;

			card.on("touchstart", this.playerClicked.bind(this, card.name));
			this.cards.addChild(card);

            if (player[0] == this.controller.userId) {
            	card.getChildByName("Num").getComponent(cc.RichText).string = `<outline color=#288cba width=4><color=#000000>${index}<color></outline>`
	            card.getChildByName("Name").getComponent(cc.RichText).string = `<outline color=#288cba width=4><color=#000000>${player[1]}<color></outline>`
                card.getComponent("Player").changeCard(this.controller.atlas._spriteFrames[this.controller.role.toLowerCase()])
            }
            else {
	            card.getChildByName("Num").getComponent(cc.RichText).string = `<outline width=4><color=#000000>${index}<color></outline>`
	            card.getChildByName("Name").getComponent(cc.RichText).string = `<outline width=4><color=#000000>${player[1]}<color></outline>`
	        }
        }.bind(this));
	},
	
	playerClicked (playerId) {
		if (this.assassin && this.controller.role == "ASSASSIN") {
			// 刺殺梅林
			netControl.send({method: "ASSASSIN", user_id: playerId});
			return;
		}
		if ((this.controller.userId != this.captain) || !this.chosing) {return;}

		if (this.teamates.includes(playerId)) {
			// tell server remove playerId
			netControl.send({method: "UNCHOSETEAMATE", user_id: playerId});
		}
		else if (this.teamates.length < this.controller.tokenNeed["numbers"][this.round]) {
			//  tell server add playerId
			netControl.send({method: "CHOSETEAMATE", user_id: playerId});
		}
		return;
	},

    onPrepareMessage (event) {
        var data = JSON.parse(event.data);

        if (data.method == "CHOSECAPTAIN") {
			this.captain = data.captain;
			this.round = data.round;
			this.chosing = data.chosing;
			this.failed = data.failed;
			this.confirming = false;
            this.teamates = [];

            jythons.reapeat(function (i) {
                var failed_token = this.failedGroup.getChildByName(i.toString());
                if (this.failed > i) {failed_token.active = true;}
                else {failed_token.active = false;}
            }.bind(this), 5);

			jythons.foreach(this.cards.children, function(_, player) {
				player.opacity = 255;

				var playerC = player.getComponent("Player");
				playerC.hideEveryMark();
				if (player.name == this.captain) {
					playerC.captainMark.active = true;
				}
			}.bind(this));

			this.vote.active = false;
			this.mission.active = false;
		}
		else if (data.method == "CHOSENTEAMATE") {
			this.teamates = data.teamates;

			jythons.foreach(this.cards.children, function(_, player) {
				if (this.teamates.includes(player.name)) {
					player.getComponent("Player").missionMark.active = true;
				}
				else {
					player.getComponent("Player").missionMark.active = false;
				}
			}.bind(this));

			if (this.teamates.length == this.controller.tokenNeed["numbers"][this.round] && this.captain == this.controller.userId) {
				this.confirm.active = true;
			}
			else {
				this.confirm.active = false;
			}
		}
		else if (data.method == "ASKAPPROVAL") {
			this.chosing = data.chosing;
			this.confirming = data.confirming;

			// Make sure user see right teamates
			this.teamates = data.teamates;

			jythons.foreach(this.cards.children, function(_, player) {
				if (this.teamates.includes(player.name)) {
					player.getComponent("Player").missionMark.active = true;
				}
				else {
					player.getComponent("Player").missionMark.active = false
					player.opacity = 100;
				}
			}.bind(this));

			this.vote.active = true;
			this.confirm.active = false;

			// Automatically vote reject
			// approveTeam();
		}
		else if (data.method == "VOTECONFIRM") {
			if (data.voter == this.controller.userId) {
				this.vote.active  = false;
			}

			this.cards.getChildByName(data.voter).getComponent("Player").voteMark.active = true;
		}
		else if (data.method == "ASKSUCCESS") {
			if (data.teamate) {
				this.mission.active = true;

				if (this.controller.role == "MERLIN" || this.controller.role == "PERCIVAL" || this.controller.role == "SERVANT") {
					this.fail.active = false;
				}
				else {
					this.fail.active = true;
				}
			}

			this.vote.active = false;
			jythons.foreach(this.cards.children, function(_, player) {
				player.getComponent("Player").voteMark.active = false;
			}.bind(this));
		}
		else if (data.method == "MISSIONCONFIRM") {
			if (data.voter == this.controller.userId) {
				this.mission.active = false;
			}

			this.cards.getChildByName(data.voter).getComponent("Player").foldedMissionMark.active = true;
		}
		else if (data.method == "GAMERECORD") {
			// display record under cards
			// record = data.record
			var token = this.tokenGroup.getChildByName(this.round.toString());
			token.active = true;
			if (data.record[this.round].resault.good_evil == "good") {
				token.getComponent(cc.Sprite).spriteFrame = this.controller.atlas._spriteFrames.good_token;
			}
			else {
				token.getComponent(cc.Sprite).spriteFrame = this.controller.atlas._spriteFrames.evil_token;
			}

			this.teamates = [];
			this.round = data.round;
			this.mission.active = false;
		}
		else if (data.method == "KILLMERLIN") {
			this.assassin = true;

			jythons.foreach(data.evils_role_map, function (id, role) {
				var card = this.cards.getChildByName(id)
				card.getComponent("Player").changeCard(this.controller.atlas._spriteFrames[role.toLowerCase()])
			}.bind(this));

			var token = this.tokenGroup.getChildByName(this.round.toString());
			token.active = true;
			token.getComponent(cc.Sprite).spriteFrame = this.controller.atlas._spriteFrames.good_token;

			// 顯示物梅林的文字
			this.story.active = true;
			this.storytext.string = "壞人刺殺梅林";
			this.schedule(function() {
				this.story.active = false;
			}.bind(this), this.STORYTIME);

			this.mission.active = false;
			jythons.foreach(this.cards.children, function(_, player) {
				player.getComponent("Player").hideEveryMark();
				player.opacity = 255;
			}.bind(this));
		}
		else if (data.method == "ASSASSIN") {
			this.assassin = false;

			jythons.foreach(data.role_map, function (id, role) {
				var card = this.cards.getChildByName(id)
				card.getComponent("Player").changeCard(this.controller.atlas._spriteFrames[role.toLowerCase()])
			}.bind(this));

			if (data.is_merlin) {
				this.storytext.string = "刺梅林成功 !";
			}
			else {
				this.storytext.string = "刺錯人了, 哈哈 !";
			}

			this.story.active = true;
			this.schedule(function() {
				this.story.active = false;
			}.bind(this), this.STORYTIME);
		}
    },

    // 
    // Story Part
    // 
    showStory () {
        this.schedule(function () {
            var story = this.storySequence[this.storyNum];
            this.storytext.string = story.text;

            if (story.callback != null) {
                story.callback();
            }
            this.storyNum += 1;
        }, this.STORYTIME, this.storySequence.length - 1, 0);
    },

    isEvil(role) {
        if (role == "MORDRED" || role == "MORGANA" || role == "ASSASSIN" || role == "EVIL") {
            return true;
        }
        return false;
    },
    evilSee () {
        if (this.isEvil(this.controller.role)) {this.seeEvil();}
    },
    merlinSee () {
        if (this.controller.role == "MERLIN") {this.seeEvil();}
    },
    seeEvil () {
        jythons.foreach(this.controller.specialPower, function (_, id) {
            var card = this.cards.getChildByName(id);
            card.getComponent("Player").changeCard(this.controller.atlas._spriteFrames.bad);
            card.parent = this.showCards;

            this.scheduleOnce(function () {
                card.parent = this.cards;
            }, this.STORYTIME - 0.25);
        }.bind(this));
    },

    percivalSee () {
        // console.log(this.storyNum);
    },

    storyEn () {
		this.storytext.string = "";
        this.story.active = false;
        netControl.send({method: "STORYFINISH"});
    },
});
