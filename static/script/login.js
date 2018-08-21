var socket = null;
var varify = false;

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

	socket = new WebSocket("ws://localhost:8000");
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
				return
			}
			console.log(data);
		}
		else {
			varify = true;

			$("#black-bg").hide(300);
			$("#waiting").hide(300);
			$("#login").hide(300);

			$("#game").show(300);
			startHandleMethod();
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
			console.log("伺服器關閉");
		}

		if (event.code == 1006) {
			// connection refuse
			$("#black-bg").hide(300);
			$("#waiting").hide(300);
			return;
		}
		console.log(event.code)		
	}
}