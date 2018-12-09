const netControl = require("NetControl");
const jythons = require("Jythons");

cc.Class({
    extends: cc.Component,

    properties: {
        playerPrefab: {
            default: null,
            type: cc.Prefab,
		},
		controller: {
			default: null,
			type: require("Controller"),
		},
		tokenGroup: {
			default: null,
			type: cc.Node,
		},
		failedNode: {
			default: null,
			type: cc.Node,
		},
		confirm: {
			default: null,
			type: cc.Node,
		},
		cards: {
			default: null,
			type: cc.Node,
		},
		showCards: {
			default: null,
			type: cc.Node,
		},
		existCards: {
			default: null,
			type: cc.Node,
		},
		recordsNode: {
			default: null,
			type: cc.Node,
		},
		story: {
			default: null,
			type: cc.Node,
		},
		storyLabel: {
			default: null,
			type: cc.Label,
		},
		vote: {
			default: null,
			type: cc.Node,
		},
		reject: {
			default: null,
			type: cc.Node,
		},
		approve: {
			default: null,
			type: cc.Node,
		},
		mission: {
			default: null,
			type: cc.Node,
		},
		success: {
			default: null,
			type: cc.Node,
		},
		fail: {
			default: null,
			type: cc.Node,
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

        this.STORYTIME = 2.5;
        this.PERCIVALSTORY = [
            {text: "派西維爾睜眼\n\n魔甘娜和梅林豎起大拇指", callback: this.percivalSee.bind(this)},
            {text: "派西維爾閉眼\n\n魔甘娜和梅林把手收起來"},
        ]
        this.ENDSTORY = {text: "天亮了\n\n所有人睜開眼睛", callback: this.storyEnd.bind(this)};

        this.storyNum = 0;
        this.storySequence = [
            {text: "天黑請閉眼", callback: null},
            {text: "壞人請睜眼相認", callback: this.evilSee.bind(this)},
            {text: "壞人請閉眼", callback: null},
            {text: "梅林睜眼\n\n除了莫德雷德\n\n壞人豎起大拇指", callback: this.merlinSee.bind(this)},
            {text: "梅林閉眼\n\n壞人把手收起來", callback: null},
		];
		
		this.story.active = true;
		this.existCards.active = false;
		this.recordsNode.active = false;
    },

    start () {
        if (this.controller.hasPercival) {
            this.storySequence = this.storySequence.concat(this.PERCIVALSTORY);
        }
        this.storySequence.push(this.ENDSTORY);

		this.setupBoard();
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

    setupBoard () {
		if (this.controller.tokenNeed["two_fail"] != null) {
			var token = this.tokenGroup.getChildByName(this.controller.tokenNeed["two_fail"].toString());
			token.color = new cc.Color(248, 89, 89);
		}

		var index = 0;
		for (var need of this.controller.tokenNeed["numbers"]) {
			var tokenText = this.tokenGroup.getChildByName(index.toString()).getChildByName("Text");
			tokenText.getComponent(cc.Label).string = need.toString();
			index += 1;
		}

		jythons.foreach(this.existCards._children, function (i, card) {
			card.active = false;
			if (this.controller.characters[i] != undefined) {
				card.getComponent(cc.Sprite).spriteFrame = this.controller.images[this.controller.characters[i].toLowerCase()];
				card.active = true;
			}
		}.bind(this));
        // this.board.getComponent(cc.Sprite).spriteFrame = this.controller.atlas._spriteFrames["b" + num];
    },

    spawnCards () {
		var x = -410;
		var y = 160;
        jythons.foreach(this.controller.players, function (i, player) {
            var card = cc.instantiate(this.playerPrefab);
			card.x = x;
			card.y = y;

			x += 130;
			if (x > 10) {
				x = -410;
				y -= 190;
			}

            card.name = player[0];
            var index = i + 1;

			card.on("touchstart", this.playerClicked.bind(this, card.name));
			this.cards.addChild(card);

			card.getComponent("Player").num = i + 1;
			card.getComponent("Player").name = player[1];

            if (player[0] == this.controller.userId) {
            	card.getChildByName("Num").getComponent(cc.RichText).string = `<outline color=#4286f4 width=4><color=#000000>${index}<color></outline>`;
				card.getChildByName("Name").getComponent(cc.RichText).string = `<outline color=#4286f4 width=4><color=#000000>${player[1]}<color></outline>`;
                card.getComponent("Player").changeCard(this.controller.images[this.controller.role.toLowerCase()]);
            }
            else {
	            card.getChildByName("Num").getComponent(cc.RichText).string = `<outline width=4><color=#000000>${index}<color></outline>`;
	            card.getChildByName("Name").getComponent(cc.RichText).string = `<outline width=4><color=#000000>${player[1]}<color></outline>`;
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

			if (this.failed == 0) {
				this.failedNode.active = false;
			}
			else {
				this.failedNode.active = true;
				this.failedNode.getChildByName("Text").getComponent(cc.Label).string = this.failed + "/5 次投票失敗";
			}

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

			this.getPlayerCard(data.voter).voteMark.active = true;
			// this.cards.getChildByName(data.voter).getComponent("Player")
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

			this.getPlayerCard(data.voter).foldedMissionMark.active = true;
			// this.cards.getChildByName(data.voter).getComponent("Player")
		}
		else if (data.method == "GAMERECORD") {
			// display record under cards
			var text = "";
			for (var record of data.record) {
				text += `<color=#6495ED>${record.success} 成功</color>   <color=#FF6347>${record.fail} 失敗</color>`;
				text += "\n<size=40>";
				for (var id of record.team) {
					text += this.getPlayerCard(id).num + ". ";
				}
				text += "</size>\n";
			}

			this.recordsNode.getChildByName("RichText").getComponent(cc.RichText).string = text;

			var token = this.tokenGroup.getChildByName(this.round.toString()).getChildByName("token");
			if (data.record[data.record.length - 1].good_evil == "good") {
				token.getComponent(cc.Sprite).spriteFrame = this.controller.images.good_token;
			}
			else {
				token.getComponent(cc.Sprite).spriteFrame = this.controller.images.evil_token;
			}

			this.teamates = [];
			this.round = data.round;
			this.mission.active = false;
		}
		else if (data.method == "KILLMERLIN") {
			this.assassin = true;

			jythons.foreach(data.evils_role_map, function (id, role) {
				this.getPlayerCard(id).changeCard(this.controller.images[role.toLowerCase()])
			}.bind(this));

			var token = this.tokenGroup.getChildByName(this.round.toString()).getChildByName("token");
			token.getComponent(cc.Sprite).spriteFrame = this.controller.images.good_token;

			// 顯示物梅林的文字
			this.story.active = true;
			this.storyLabel.string = "壞人刺殺梅林";
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
				this.getPlayerCard(id).changeCard(this.controller.images[role.toLowerCase()])
			}.bind(this));

			if (data.is_merlin) {
				this.storyLabel.string = "刺梅林成功 !";
			}
			else {
				this.storyLabel.string = "刺錯人了, 哈哈 !";
			}

			this.story.active = true;
		}
		else if (data.method == "END") {
			console.log(data.method);

			if (data.add_token) {
				// Add token
			}

			if (data.failed == 0) {
				this.failedNode.active = false;
			}
			else {
				this.failedNode.active = true;
				this.failedNode.getChildByName("Text").getComponent(cc.Label).string = data.failed + " 次投票失敗";
			}

			for (var id in data.role_map) {
				var role = data.role_map[id].toLowerCase();
				this.getPlayerCard(id).changeCard(this.controller.images[role]);
			}

			this.storyLabel.string = "壞人勝利！";
			this.story.active = true;
			this.schedule(function() {
				this.story.active = false;
			}.bind(this), this.STORYTIME);
		}
		else {
			console.log(data.method);
		}
    },

    // 
    // Story Part
    // 
    showStory () {
        this.schedule(function () {
            var story = this.storySequence[this.storyNum];
            this.storyLabel.string = story.text;

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
            var card = this.getPlayerCard(id);
			card.changeCard(this.controller.images.bad);
            card.parent = this.showCards;

            this.scheduleOnce(function () {
                card.parent = this.cards;
            }, this.STORYTIME - 0.25);
        }.bind(this));
    },

    percivalSee () {
        if (this.controller.role == "PERCIVAL") {
			console.log(this.controller.specialPower);	

			jythons.foreach(this.controller.specialPower, function (_, id) {
				var card = this.getPlayerCard(id);
				card.changeCard(this.controller.images.morganamerlin);
				card.parent = this.showCards;
	
				this.scheduleOnce(function () {
					card.parent = this.cards;
				}, this.STORYTIME - 0.25);
			}.bind(this));
		}
    },

    storyEnd () {
		this.storyLabel.string = "";
		this.story.active = false;
		this.existCards.active = true;
		this.recordsNode.active = true;
		netControl.send({method: "STORYFINISH"});
		
		this.scheduleOnce(function () {
			for (var card of this.existCards._children) {
				card.width = 100;
				card.height = 159;
			}
		}.bind(this), 0.1);
	},
	
	getPlayerCard(id) {
		return this.cards.getChildByName(id).getComponent("Player");
	}
});
