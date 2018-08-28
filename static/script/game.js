var game_setting = null;
var Method = null;
var needready = false;
var images = {};

var players_num = 0;
var role = null;
var special_power = null;
var hasPercival = false;

var chosing = false;
var confirming = false;

var round = 0;
var tokenNeed = null;
var captain = null;
var teamates = [];

function loadImages() {
	$.each(images, function(name, image) {
		if (!(image instanceof Object)) {
			images[name] = new Image();
			images[name].src = image;
		}
	});
}

function ready() {
	if (needready) {
		socket.send(JSON.stringify({
			method: Method.READY,
		}));
		// 
	}
}

function displayCard(players) {
	$.each(players, function(_, player) {
		var div = $("<div>")[0];
		div.classList.add("player-card");
		div.id = "player-" + player[0];
		div.onclick = clickPlayer;

		var img = images.unknown.cloneNode();
		img.classList.add("character");
		div.append(img);

		$("#cards")[0].appendChild(div);
	});
}

function displayMyself() {
	var ele = $("#player-" + user_id)[0];
	ele.removeChild($("#player-" + user_id + " .character")[0]);

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
	ele.append(img);
}

function clickPlayer(event) {
	if (!chosing) {
		return;
	}

	if (captain != user_id) {
		return;
	}

	$.each(event.path, function(_, ele) {
		try {
			if (ele.classList.contains("player-card")) {
				player_id = ele.id.replace("player-", "");

				if (teamates.includes(player_id)) {
					$("#black-bg").show();
					$("#waiting").show();

					// tell server remove player_id
					socket.send(JSON.stringify({
						method: Method.UNCHOSETEAMATE,
						user_id: player_id,
					}));
				}
				else {
					if (teamates.length >= tokenNeed["numbers"][round]) {
						return;
					}

					$("#black-bg").show();
					$("#waiting").show();

					//  tell server add player_id
					socket.send(JSON.stringify({
						method: Method.CHOSETEAMATE,
						user_id: player_id,
					}));
				}
				
				return false;
			}
		} catch(e) {}
	});
}

function confirmTeam() {
	if (captain != user_id) {
		return;
	}

	if (teamates.length == tokenNeed["numbers"][round]) {
		socket.send(JSON.stringify({method: Method.COMFIRMTEAM}));
	}
}

function approveTeam() {
	$("#black-bg").show();
	$("#waiting").show();
	socket.send(JSON.stringify({method: Method.APPROVE}));
}

function rejectTeam() {
	$("#black-bg").show();
	$("#waiting").show();
	socket.send(JSON.stringify({method: Method.REJECT}));
}

function missionSuccess() {
	$("#black-bg").show();
	$("#waiting").show();
	socket.send(JSON.stringify({method: Method.SUCCESS}));
}
function missionFail() {
	$("#black-bg").show();
	$("#waiting").show();
	socket.send(JSON.stringify({method: Method.FAIL}));
}

function startHandleMethod() {
	socket.onmessage = function (event) {
		data = JSON.parse(event.data);

		if (data.method == Method.NEEDREADY) {
			$("#ready")[0].classList.remove("disable");
			needready = true;

			// Automatically Ready
			ready();
		}
		else if (data.method == Method.CONFIRMREADY) {
			$("#ready")[0].classList.add("active");
		}
		else if (data.method == Method.START) {
			$("#prepare").hide();
			$("#game").show();

			role = data.role;
			special_power = data.special_power;
			hasPercival = data.has_percival;
			players_num = data.players.length;
			tokenNeed = data.token_need;

			$("#board")[0].append(images["b" + players_num]);

			displayCard(data.players);
			displayMyself();
			playeStory();
		}
		else if (data.method == Method.CHOSECAPTAIN) {
			captain = data.captain;
			round = data.round;
			chosing = data.chosing;
			failed = data.failed;
			confirming = false;
			teamates = [];

			// Add captain, teamate, foldedmission vote img to every players
			if ($(".captain").length == 0) {
				$.each($(".player-card"), function(_, card) {
					var captain = images.captain.cloneNode();
					captain.classList.add("captain");

					var teamate = images.mission.cloneNode();
					teamate.classList.add("teamates")

					var vote = images.vote.cloneNode();
					vote.classList.add("vote");

					var foldedmission = images.foldedmission.cloneNode();
					foldedmission.classList.add("foldedmission");

					card.append(captain);
					card.append(teamate);
					card.append(vote);
					card.append(foldedmission);
				});
			}

			$("#failed")[0].innerHTML = "";
			for (var i=0;i<data.failed;i++) {
				$("#failed")[0].append(images.evil_token.cloneNode());
			}

			$("#black-bg").hide();
			$("#waiting").hide();
			$("#vote").hide();
			$(".captain").hide();
			$(".teamates").hide();
			$(".vote").hide();
			$(".foldedmission").hide();
			$("#player-" + data.captain + " .captain").show();
		}
		else if (data.method == Method.CHOSENTEAMATE) {
			$("#black-bg").hide();
			$("#waiting").hide();
			teamates = data.teamates;

			$.each($(".player-card"), function(i, card) {
				var id = card.id.replace("player-", "")
				if (teamates.includes(id)) {
					$("#player-" + id + " .teamates").show(300);
				}
				else {
					$("#player-" + id + " .teamates").hide(300);
				}
			});

			if (teamates.length == tokenNeed["numbers"][round] && captain == user_id) {
				// 
				$("#confirm").show();
				$("#confirm")[0].style.width = $("#board > img").width() + "px";
				$("#confirm")[0].style.height = $("#board > img").height() + "px";
			}
			else {
				$("#confirm").hide();
			}
		}
		else if (data.method == Method.ASKAPPROVAL) {
			chosing = data.chosing;
			confirming = data.confirming;

			// Make sure user see right teamates
			teamates = data.teamates;

			var teamatesNode = $(".teamate");
			var top = 0;
			$.each(teamatesNode, function(i, node) {
				if (data.teamates[i] != undefined) {
					node.style.top = $("#upper").height() + $(node).height() + "px";

					var left = 0;
					$.each($(".player-card"), function(_, card) {
						if (card.id == ("player-" + data.teamates[i])) {
							node.style.left = left + ($(card).width() / 2) + "px";
							return false;
						}
						left += $(card).width();
					});
				}
				else {
					node.style.top = top + "px";
					node.style.left = 0;
					top += 80;
				}
			});

			// 
			if ($("#approve")[0].children.length == 0) {
				$("#approve")[0].append(images.approve);
			}
			if ($("#reject")[0].children.length == 0) {
				$("#reject")[0].append(images.reject);
			}

			$(".vote").hide();
			$("#vote").show();
			$("#confirm").hide();

			// Automatically vote reject
			approveTeam();
		}
		else if (data.method == Method.VOTECONFIRM) {
			$("#black-bg").hide();
			$("#waiting").hide();

			if (data.voter == user_id) {
				$("#vote").hide(300);
			}

			$("#player-" + data.voter + " .vote").show(300);
		}
		else if (data.method == Method.ASKSUCCESS) {
			if (data.teamate) {
				if ($("#success")[0].children.length == 0) {
					$("#success")[0].append(images.success);
				}
				if ($("#fail")[0].children.length == 0) {
					$("#fail")[0].append(images.fail);
				}

				$("#mission").show();

				if (role == "MERLIN" || role == "PERCIVAL" || role == "SERVANT") {
					$("#fail").hide();
				}
			}
			$("#vote").hide();
			$(".vote").hide();
		}
		else if (data.method == Method.MISSIONCONFIRM) {
			$("#black-bg").hide();
			$("#waiting").hide();

			if (data.voter == user_id) {
				$("#mission").hide(300);
			}

			$("#player-" + data.voter + " .foldedmission").show(300);
		}
		else if (data.method == Method.GAMERECORD) {
			// display record under cards
			if (data.record[round].resault.fail == 0) {
				$("#tokens")[0].append(images.good_token.cloneNode());
			}
			else {
				$("#tokens")[0].append(images.evil_token.cloneNode());
			}

			teamates = [];
			data.round = data.round;
			$(".foldedmission").hide(300);
			$("#mission").hide(300);
		}
		else if (data.method == Method.END) {
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
				ele.append(img);
			})
		}
		else {
			console.log(data)
		}
	}
}

$(document).ready(function() {
	$.ajax({
		url: "/game_setting",
		success (msg) {
			game_setting = msg;
			$.each(msg.images, function(_, image) {
				var name = image.substring(0, image.find("."));
				images[name] = "/static/images/" + image;
			});

			Method = {};
			$.each(msg.method, function(_, method) {
				Method[method] = method;
			});

			// Automatically Join
			$("#name")[0].value = random.randint(1,100);
			$("#secret")[0].value = "mlpn";
			login();
		}
	});
});