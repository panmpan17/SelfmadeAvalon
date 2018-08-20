var socket;
var varify = false;

function login () {
	name = $("#name")[0].value;
	secret = $("#secret")[0].value;

	if (name == "" || secret == "") {
		alert("留什麼空啦 !");
		return;
	}

	socket = new WebSocket("ws://localhost:8000");


	socket.onmessage = function (event) {
		data = JSON.parse(event.data);

		if (data.success == false) {
			if (data.method == "varifyfail") {
				alert("密語錯誤");
				return
			}
			console.log(data);
		}
		else {
			varify = true;
			console.log(data);
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
		if (varify) {
			console.log("伺服器關閉");
		}
	}
}