STORY = {
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

images = {};

$(document).ready(function() {
	$.ajax({
		url: "/images",
		success (msg) {
			$.each(msg["images"], function (_, image) {
				images[image] = new Image();
				images[image].src = "/static/images/" + image;
			});
		}
	});
});