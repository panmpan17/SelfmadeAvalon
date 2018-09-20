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

        this.STORYTIME = 0.8;
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
        jythons.foreach(this.controller.players, function (_, player) {
            var card = cc.instantiate(this.playerPrefab);
            card.name = player[0];
            card.x += x;
            x += 100;

			card.on("touchstart", this.playerClicked.bind(this, card.name));
			this.cards.addChild(card);

            if (player[0] == this.controller.userId) {
                card.getComponent("Player").changeCard(this.controller.atlas._spriteFrames[this.controller.role.toLowerCase()])
            }
        }.bind(this));
	},
	
	playerClicked (playerId) {
		// if (assassin && role == "ASSASSIN") {
		// 	$.each(event.path, function(_, ele) {
		// 		try {
		// 			if (ele.classList.contains("player-card")) {
		// 				var player_id = ele.id.replace("player-", "");
	
		// 				// 刺殺梅林
		// 				socket.send(JSON.stringify({
		// 					method: Method.ASSASSIN,
		// 					user_id: player_id,
		// 				}));
		// 			}
		// 		} catch (e) {}
		// 	});a
		// 	return;
		// }

		if ((this.controller.userId != this.captain) || !this.chosing) {
			return;
		}

		if (this.teamates.includes(playerId)) {
			// tell server remove playerId
			netControl.send({method: "UNCHOSETEAMATE", user_id: playerId});
		}
		else {
			if (this.teamates.length >= this.controller.tokenNeed["numbers"][this.round]) {
				return;
			}
			//  tell server add player_id
			netControl.send({method: "CHOSETEAMATE", user_id: playerId});
		}
		return false;
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
				var playerC = player.getComponent("Player");
				playerC.hideEveryMark();
				if (player.name == this.captain) {
					playerC.captainMark.active = true;
				}
			}.bind(this));

			this.vote.active = false;
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
					player.getComponent("Player").missionMark.active = false;
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
			if (data.voter == userId) {
				this.mission.active = false;
			}

			this.cards.getChildByName(data.voter).getComponent("Player").foldedMissionMark.active = true;
		}
		else if (data.method == "GAMERECORD") {
			// display record under cards
			// record = data.record;
			// if (data.record[round].resault.good_evil == "good") {
			// 	$("#tokens")[0].appendChild(images.good_token.cloneNode());
			// }
			// else {
			// 	$("#tokens")[0].appendChild(images.evil_token.cloneNode());
			// }

			this.teamates = [];
			this.round = data.round;
			this.mission.active = false;

			jythons.foreach(this.cards.children, function(_, player) {
				player.getComponent("Player").foldedMissionMark.active = false;
			}.bind(this));
			// $(".foldedmission").hide(300);
			// $("#mission").hide(300);
		}
		else if (data.method == "KILLMERLIN") {
			console.log(1)
			assassin = true;

			$.each(data.evils_role_map, function(id, role) {
				var ele = $("#player-" + id)[0];
				ele.removeChild($("#player-" + id + " .character")[0]);

				var img = null;
				if (role != "EVIL") {
					img = images["q_" + role.toLowerCase()].cloneNode();
				}
				else if (role == "EVIL") {
					img = images["q_" + role.toLowerCase() + "_1"].cloneNode();
				}
				img.classList.add("character");
				ele.appendChild(img);
			});

			$("#tokens")[0].appendChild(images.good_token.cloneNode());

			if (role == "ASSASSIN") {
				$("#black-bg").show(300);
				$("#assassin-merlin").show(300);

				setTimeout(function() {
					$("#black-bg").hide(50);
					$("#assassin-merlin").hide(50);
				}, STORYTIME);
			}

			setTimeout(function() {
				$("#vote").hide();
				$("#mission").hide();
				$(".captain").hide();
				$(".foldedmission").hide();
				$(".vote").hide();
				$(".teamates").hide();
			}, 1000);
		}
		else if (data.method == "ASSASSIN") {
			assassin = false;

			$.each(data.role_map, function(id, role) {
				var ele = $("#player-" + id)[0];
				ele.removeChild($("#player-" + id + " .character")[0]);

				var img = null;
				if (role != "SERVANT" && role != "EVIL") {
					img = images["q_" + role.toLowerCase()].cloneNode();
				}
				else if (role == "SERVANT") {
					img = images["q_" + role.toLowerCase() + "_1"].cloneNode();
				}
				else if (role == "EVIL") {
					img = images["q_" + role.toLowerCase() + "_1"].cloneNode();
				}
				img.classList.add("character");
				ele.appendChild(img);
			});

			setTimeout(function() {
				$("#vote").hide();
				$("#mission").hide();
				$(".captain").hide();
				$(".foldedmission").hide();
				$(".vote").hide();
				$(".teamates").hide();
			}, 1000);

			if (data.is_merlin) {
				alert("刺梅林成功 !");
			}
			else {
				alert("刺錯人了, 哈哈 !")
			}
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
        this.story.active = false;
        netControl.send({method: "STORYFINISH"});
    },
});
