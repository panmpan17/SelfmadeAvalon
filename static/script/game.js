var game_setting = null;
var Method = null;
var needready = false;
var images = {};

var role = null;

var STORY = {
	basic: [
		"天黑請閉眼",
		"壞人請睜眼相認",
		"壞人請閉眼",
		"梅林睜眼, 除了莫德雷德, 壞人豎起大拇指",
		"梅林閉眼, 壞人把手收起來",
		
	],
	PERCIVAL: [
	"派西維爾睜眼, 魔甘娜和梅林豎起大拇指",
	"派西維爾閉眼, 魔甘娜和梅林把手收起來",
	],
	END: "天亮了, 所有人睜開眼睛",
}

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
		div.class = "player-card"
		div.id = "player-" + player[0];
		div.innerHTML = player[1];

		div.append(images.unknown.cloneNode());

		$("#cards")[0].appendChild(div);
	});
}

function displayMyself() {
	$("#player-" + user_id)[0].removeChild($("#player-" + user_id)[0].children[0]);
	$("#player-" + user_id)[0].append(images[role.toLowerCase()].cloneNode());
}

function specialPower(special_power) {
	$.each(special_power, function(_, _id) {
		$("#player-" + _id)[0].removeChild($("#player-" + _id)[0].children[0]);

		if (role == "MERLIN") {
			$("#player-" + _id)[0].append(images.bad.cloneNode());
		}
	})
}

function startHandleMethod() {
	socket.onmessage = function (event) {
		data = JSON.parse(event.data);

		console.log(data)
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
			displayCard(data.players);
			displayMyself();

			if (data.special_power != undefined) {
				specialPower(data.special_power);
			}
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