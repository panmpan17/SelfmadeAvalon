var game_setting = null;
var Method = null;
var images = {};

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
		}
	});
});