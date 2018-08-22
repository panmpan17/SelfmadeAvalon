var game_setting = null;
var Method = null;
var needready = false;
var images = {};

var role = null;
var special_power = null;
var hasPercival = false;

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
		// div.innerHTML = player[1];

		div.append(images.unknown.cloneNode());

		$("#cards")[0].appendChild(div);
	});
}

function displayMyself() {
	var ele = $("#player-" + user_id)[0];
	ele.removeChild(ele.children[0]);

	if (role != "SERVANT" && role != "EVIL") {
		ele.append(images["q_" + role.toLowerCase()].cloneNode());
	}
	else if (role == "SERVANT") {
		ele.append(images["q_" + role.toLowerCase() + "_" + random.randint(1, 5)].cloneNode());
	}
	else if (role == "EVIL") {
		ele.append(images["q_" + role.toLowerCase() + "_" + random.randint(1, 2)].cloneNode());
	}
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

			displayCard(data.players);
			displayMyself();
			playeStory();
		}
		else if (data.method == Method.CHOSECAPTAIN) {
			if ($("#mission")[0].children.length == 0) {
				$("#mission")[0].append(images.mission);
			}
			
			$("#mission")[0].style.top = "70px";

			left = 0;
			$.each($("#cards")[0].children, function(i, card) {
				left += $(card).width();
				if (card.id == ("player-" + data.captain)) {
					$("#mission")[0].style.left = left + "px";
					return false;
				}
			});
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