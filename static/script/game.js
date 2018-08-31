var game_setting = null;
var Method = null;
var needready = false;
var images = {};

var player_ready = 0;
var players_num = 0;
var role = null;
var special_power = null;
var hasPercival = false;

var assassin = false;
var chosing = false;
var confirming = false;
var record = null;

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
	$.each(players, function(i, player) {
		var div = $("<div>")[0];
		div.classList.add("player-card");
		div.id = "player-" + player[0];
		div.addEventListener('click', clickPlayer);

		var num = $("<div>")[0];
		num.innerHTML = i + 1;
		num.classList.add("number");

		var img = images.unknown.cloneNode();
		img.classList.add("character");
		
		var name = $("<div>")[0];
		name.innerHTML = player[1];
		name.classList.add("name");

		div.appendChild(num);
		div.appendChild(img);
		div.appendChild(name);

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
	ele.insertBefore(img, $("#player-" + user_id + " .name")[0]);
}

function clickPlayer(event) {
	if (assassin && role == "ASSASSIN") {
		$.each(event.path, function(_, ele) {
			try {
				if (ele.classList.contains("player-card")) {
					var player_id = ele.id.replace("player-", "");

					// 刺殺梅林
					socket.send(JSON.stringify({
						method: Method.ASSASSIN,
						user_id: player_id,
					}));
				}
			} catch (e) {}
		});
		return;
	}

	if (!chosing || (captain != user_id)) {
		return;
	}

	$.each(event.path, function(_, ele) {
		try {
			if (ele.classList.contains("player-card")) {
				var player_id = ele.id.replace("player-", "");

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
		} catch(e) {
			console.log(e)
		}
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

		if (data.method == Method.WAITING) {
			players_num = data.players_num;
			$("#waiting-number")[0].innerHTML = players_num;
		}
		else if (data.method == Method.NEEDREADY) {
			$("#ready")[0].classList.remove("disable");
			needready = true;

			// Automatically Ready
			// ready();
		}
		else if (data.method == Method.CONFIRMREADY) {
			if (data.user == user_id) {
				$("#ready")[0].classList.add("active");
			}

			player_ready = data.player_ready;
			$("#ready-number")[0].innerHTML = player_ready;
		}
		else if (data.method == Method.START) {
			needready = false;
			$("#prepare").hide();
			$("#game").show();

			role = data.role;
			special_power = data.special_power;
			hasPercival = data.has_percival;
			players_num = data.players.length;
			tokenNeed = data.token_need;

			$("#board")[0].appendChild(images["b" + players_num]);

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

					card.appendChild(captain);
					card.appendChild(teamate);
					card.appendChild(vote);
					card.appendChild(foldedmission);
				});
			}

			$("#failed")[0].innerHTML = "";
			for (var i=0;i<data.failed;i++) {
				$("#failed")[0].appendChild(images.evil_token.cloneNode());
			}

			setTimeout(function() {
				$("#black-bg").hide();
				$("#waiting").hide();
				$("#vote").hide();
				$(".captain").hide();
				$(".teamates").hide();
				$(".vote").hide();
				$(".foldedmission").hide();
				$("#player-" + data.captain + " .captain").show();
			}, 1000);
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

			$.each($(".player-card"), function(i, card) {
				var id = card.id.replace("player-", "")
				if (teamates.includes(id)) {
					$("#player-" + id + " .teamates").show(300);
					$("#player-" + id)[0].style.zIndex = 15;
				}
				else {
					$("#player-" + id + " .teamates").hide(300);
					$("#player-" + id)[0].style.zIndex = 9;
				}
			});

			// 
			if ($("#approve")[0].children.length == 0) {
				$("#approve")[0].appendChild(images.approve);
			}
			if ($("#reject")[0].children.length == 0) {
				$("#reject")[0].appendChild(images.reject);
			}

			$(".vote").hide();
			$("#vote").show();
			$("#confirm").hide();

			// Automatically vote reject
			// approveTeam();
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
					$("#success")[0].appendChild(images.success);
				}
				if ($("#fail")[0].children.length == 0) {
					$("#fail")[0].appendChild(images.fail);
				}

				$("#mission").show();

				if (role == "MERLIN" || role == "PERCIVAL" || role == "SERVANT") {
					$("#fail").hide();
				}
			}

			$("#vote").hide();
			$(".vote").hide();
			$("#black-bg").hide();
			$("#waiting").hide();
		}
		else if (data.method == Method.MISSIONCONFIRM) {
			if (data.voter == user_id) {
				$("#black-bg").hide();
				$("#waiting").hide();
				$("#mission").hide(300);
			}

			$("#player-" + data.voter + " .foldedmission").show(300);
		}
		else if (data.method == Method.GAMERECORD) {
			$.each($(".player-card"), function(i, card) {
				card.style.zIndex = 9;
			});

			// display record under cards
			record = data.record;
			if (data.record[round].resault.good_evil == "good") {
				$("#tokens")[0].appendChild(images.good_token.cloneNode());
			}
			else {
				$("#tokens")[0].appendChild(images.evil_token.cloneNode());
			}

			teamates = [];
			data.round = data.round;
			$(".foldedmission").hide(300);
			$("#mission").hide(300);
		}
		else if (data.method == Method.KILLMERLIN) {
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
				ele.appendChild(img);
			});

			if (data.add_token == 1) {
				$("#tokens")[0].appendChild(images.evil_token.cloneNode());
			}

			setTimeout(function() {
				$("#vote").hide();
				$("#mission").hide();
				$(".captain").hide();
				$(".foldedmission").hide();
				$(".vote").hide();
				$(".teamates").hide();
			}, 1000);
			
			if (data.win == "good") {
				alert("好人獲勝");
			}
			else {
				alert("壞人獲勝");
			}
		}
		else if (data.method == Method.DISCONNECT) {
			players_num = data.players_num;
			player_ready = data.player_ready;
			$("#waiting-number")[0].innerHTML = players_num;
			$("#ready-number")[0].innerHTML = player_ready;
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
			$("#secret")[0].value = "mime";
			login();
		}
	});
});