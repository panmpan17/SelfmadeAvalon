module.exports = {
    random: new (function() {
        var self = this;

        // 在兩個數間隨機挑選
        this.randint = function(start_num, end_num) {
            return parseInt(Math.random() * (end_num - start_num + 1) + start_num);
        }

        this.random = function() {
            return Math.random();
        }

        // 打亂列表
        this.shuffle = function(list) {
            var j, x, i;
            for (i = list.length - 1; i > 0; i--) {
                j = Math.floor(Math.random() * (i + 1));
                x = list[i];
                list[i] = list[j];
                list[j] = x;
            }
        }

        // 從列表中選擇單個元素
        this.choice = function(list) {
            return list[self.randint(0, list.length - 1)];
        }

        // 從列表中選擇多個元素
        this.sample = function(list, num) {
            if (num > list.length) {
                throw "Sample larger than population";
            }

            var picks = [];

            for (i=0;i<num;i++) {
                pick = self.choice(list);

                while (picks.indexOf(pick) >= 0) {
                    pick = self.choice(list);
                }

                picks.push(pick);
            }

            return picks;
        }
    })(),
    foreach: function (iterate_object, iterate_function) {
        keys = Object.keys(iterate_object);
        for (i=0;i<keys.length;i++) {
            iterate_function(keys[i], iterate_object[keys[i]]);
        }
    },
}