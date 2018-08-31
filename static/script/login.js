var socket = null;
var varify = false;
var user_id = null;
var name = "";

function login () {
	name = $("#name")[0].value;
	secret = $("#secret")[0].value;

	if (name == "" || secret == "") {
		alert("留什麼空啦 !");
		return;
	}

	if (socket != null) {
		return;
	}

	socket = new WebSocket("ws://" + window.location.hostname + ":8000");
	$("#black-bg").show(300);
	$("#waiting").show(300);

	socket.onmessage = function (event) {
		data = JSON.parse(event.data);

		if (data.success == false) {

			if (data.method == Method.VARIFYFAIL) {
				$("#waiting").hide(300);
				$("#wrongsecret").show(300);

				setTimeout(function() {
					$("#black-bg").hide(300);
					$("#wrongsecret").hide(300);
				}, 5000);
				return;
			}
			console.log(data);
		}
		else {
			if (name == data.name) {
				players_num = data.players_num;
				$("#waiting-number")[0].innerHTML = players_num;

				varify = true;
				user_id = data.id;
				// window.history.pushState({}, "賣瓦隆 - " + user_id, "?user_id=" + user_id)

				$("#black-bg").hide(300);
				$("#waiting").hide(300);
				$("#login").hide(300);

				$("#prepare").show(300);
				startHandleMethod();
				loadImages();
			}
		}
	}

	socket.onopen = function (event) {
		socket.send(JSON.stringify({
			method: Method.LOGIN,
			name: name,
			secret: secret,
		}));
	}

	socket.onclose = function (event) {
		socket = null;

		if (varify) {
			$("#black-bg").show(300);
			$("#socketclose").show(300);

			$("#tokens")[0].innerHTML = "";
			$("#failed")[0].innerHTML = "";
			$("#cards")[0].innerHTML = "";
			$("#story #text")[0].innerHTML = "";

			$("#game").hide();
			$("#prepare").hide();
			$("#login").show();

			setTimeout(function() {
				$("#black-bg").hide(300);
				$("#socketclose").hide(300);
			}, 5000);
			return;
		}

		if (event.code == 1006) {
			// connection refuse
			$("#black-bg").hide(300);
			$("#waiting").hide(300);
			return;
		}
		console.log(event.code);
	}
}