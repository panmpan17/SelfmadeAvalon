var STORYTIME = 500;
var STORY = {
	BASIC: [
		{text: "天黑請閉眼", callback: null},
		{text: "壞人請睜眼相認", callback: evilSee},
		{text: "壞人請閉眼", callback: null},
		{text: "梅林睜眼, 除了莫德雷德, 壞人豎起大拇指", callback: merlinSee},
		{text: "梅林閉眼, 壞人把手收起來", callback: null},
	],
	PERCIVAL: [
	{text: "派西維爾睜眼, 魔甘娜和梅林豎起大拇指", callback: percivalSee},
	{text: "派西維爾閉眼, 魔甘娜和梅林把手收起來"},
	],
	END: {text:"天亮了, 所有人睜開眼睛", callback: storyEnd},
}

function isEvil(role) {
	if (role == "MORDRED" || role == "MORGANA" || role == "ASSASSIN" || role == "EVIL") {
		return true;
	}
	return false;
}

function evilSee() {
	if (isEvil(role)) {
		$.each(special_power, function(_, _id) {
			var img = images.bad.cloneNode();
						img.classList.add("character");
						img.classList.add("character");

			$("#player-" + _id)[0].removeChild($("#player-" + _id)[0].children[0]);
			$("#player-" + _id)[0].append(img);
			$("#player-" + _id)[0].style.zIndex = 15;

			setTimeout(function () {
				$("#player-" + _id)[0].style.zIndex = 9;
			}, STORYTIME);
		});
	}
}
function merlinSee() {
	if (role == "MERLIN") {
		$.each(special_power, function(_, _id) {
			var img = images.bad.cloneNode();
						img.classList.add("character");

			$("#player-" + _id)[0].removeChild($("#player-" + _id)[0].children[0]);
			$("#player-" + _id)[0].append(img);
			$("#player-" + _id)[0].style.zIndex = 15;

			setTimeout(function () {
				$("#player-" + _id)[0].style.zIndex = 9;
			}, STORYTIME - 250);
		});
	}
}

function percivalSee() {
	if (role == "PERCIVAL") {
		$.each(special_power, function(_, _id) {
			var img = images.q_morganamerlin.cloneNode();
						img.classList.add("character");

			$("#player-" + _id)[0].removeChild($("#player-" + _id)[0].children[0]);
			$("#player-" + _id)[0].append(img);
			$("#player-" + _id)[0].style.zIndex = 15;

			setTimeout(function () {
				$("#player-" + _id)[0].style.zIndex = 9;
			}, STORYTIME - 250);
		});
	}
}

function storyEnd() {
	$("#story").hide(300);

	socket.send(JSON.stringify({
		method: Method.STORYFINISH,
	}));
}

function playeStory() {
	$("#story").show(300);

	timewait = 500;
	$.each(STORY.BASIC, function(_, story) {
		setTimeout(function() {
			$("#story #text")[0].innerHTML = story.text;

			if (story.callback != null) {
				story.callback();
			}
		}, timewait);
		timewait += STORYTIME;
	});

	if (hasPercival) {
		$.each(STORY.PERCIVAL, function(_, story) {
			setTimeout(function() {
				$("#story #text")[0].innerHTML = story.text;

				if (story.callback != null) {
					story.callback();
				}
			}, timewait);
			timewait += STORYTIME;
		});
		timewait += STORYTIME;
	}

	setTimeout(function() {
		$("#story #text")[0].innerHTML = STORY.END.text;

		if (STORY.END.callback != null) {
			STORY.END.callback();
		}
	}, timewait);
	timewait += STORYTIME;
}