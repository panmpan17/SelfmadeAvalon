from datetime import datetime

import json
import asyncio
import asyncws
import random
import string

PLAYERLIMIT = 2
REQUIRE_TO_START = 2


class Method:
    def __init__(self, method_json):
        for method in method_json:
            self.__setattr__(method, method)


# load game setting
game_setting = json.load(open("game_setting.json"))
method = Method(game_setting["method"])

SECRET = "mlpn"


class Dull:
    pass


class ErrMsg:
    DATA_PARSE_WRONG = {
        "success": False,
        "method": method.ERROR,
        "reason": "Data Parse Error"}

    VARIFYFAIL = {
        "success": False,
        "close": True,
        "method": method.VARIFYFAIL}


class SocketServer:

    def __init__(self):
        self.server = None
        self.lock = asyncio.Lock()

        self.players = {}
        self.waiting = []
        self.spectating = []
        self.playing = []

        self.readying = False
        self.started = False

    def _checkdata(self, data, keys):
        dull = Dull()
        for key in keys:
            if key not in data:
                return False

            setattr(dull, key, data[key])
        return dull

    def request_log(self, data):
        string = datetime.now().strftime("%m/%d %H:%M")
        string += f" {data['method']}"
        print(string)

    def run(self, ip, port):
        self.server = asyncws.start_server(self.handle_client, ip, port)
        asyncio.get_event_loop().run_until_complete(self.server)

        try:
            asyncio.get_event_loop().run_forever()
        except KeyboardInterrupt:
            pass

    def disconnect(self, user_id):
        with (yield from self.lock):
            if user_id in self.waiting:
                self.waiting.remove(user_id)
            if user_id in self.playing:
                self.playing.remove(user_id)
            if user_id in self.spectating:
                self.spectating.remove(user_id)

            self.players.pop(user_id)

            # Todo: notify other
            # if waiting number not enugh and is readying cancel ready
            # for player in self.players:
            #

    @asyncio.coroutine
    def handle_client(self, websocket):
        user_id = "".join(random.sample(string.ascii_letters, 10))
        self.players[user_id] = {"id": user_id, "socket": websocket, "ready": False}

        while True:
            try:
                data = yield from websocket.recv()

                # player disconnect
                if data is None:
                    yield from self.disconnect(user_id)
                    return

                data = json.loads(data)
                self.request_log(data)
            except Exception as e:
                self.request_log({"method": method.ERROR})
                yield from websocket.send(json.dumps(ErrMsg.DATA_PARSE_WRONG))
                continue

            try:
                if "method" not in data:
                    yield from websocket.send(json.dumps(
                        ErrMsg.DATA_PARSE_WRONG))
                    continue

                try:
                    response = yield from self.__getattribute__(
                        data["method"])(data, user_id, websocket)
                except AttributeError as e:
                    print(e)
                    yield from websocket.send(json.dumps(
                        ErrMsg.DATA_PARSE_WRONG))
                    continue

                # # shutdown connection if close in response
                if response == "close":
                    yield from websocket.close()
                    return

            except Exception as e:
                print("Handle gone wrong: ", e)

    def LOGIN(self, data, user_id, websocket):
        data = self._checkdata(data, ("name", "secret"))
        if not data:
            # response can't leave blank
            return

        if data.name == "":
            # response can't leave blank
            return

        if data.secret != SECRET:
            yield from websocket.send(json.dumps(ErrMsg.VARIFYFAIL))
            return "close"

        response = {"success": True, }

        with (yield from self.lock):
            self.players[user_id]["name"] = data.name

            # Become Specate if too many player or game started
            if len(self.waiting) >= PLAYERLIMIT or self.started:
                response["method"] = method.SPECTATE
                self.spectating.append(user_id)
            else:
                response["method"] = method.WAITING
                self.waiting.append(user_id)

            # Send Login success
            yield from websocket.send(json.dumps(response))

            # Send other players NEEDREADY if number is enough
            if (len(self.waiting) >= REQUIRE_TO_START and
                    response["method"] == method.WAITING):

                if len(self.waiting) == REQUIRE_TO_START:
                    self.readying = True

                    for _id in self.waiting:
                        yield from self.players[_id]["socket"].send(
                            json.dumps({"method": method.NEEDREADY}))
                else:
                    yield from websocket.send(json.dumps({
                        "method": method.NEEDREADY,
                        }))

    def READY(self, data, user_id, websocket):
        # response = {"method": method.CONFIRMREADY, "success": True}
        yield from websocket.send(json.dumps({"method": method.CONFIRMREADY,
                                              "success": True}))

        with (yield from self.lock):
            self.players[user_id]["ready"] = True

            if all([self.players[_id]["ready"] for _id in self.waiting]):
                characters = self.get_characters(len(self.waiting))
                random.shuffle(characters)

                self.playing.extend(self.waiting)
                self.waiting.clear()

                players_info = [[self.players[i]["id"], self.players[i]["name"]] for i in self.playing]

                role_map = dict(zip(self.playing, characters))
                for player in self.playing:
                    role = role_map[player]
                    self.players[player]["role"] = role

                    response = {"method": method.START, "role": role, "players": players_info}
                    if role in game_setting["special_power"]:
                        response["special_power"] = [k for k, v in role_map.items() if v in game_setting["special_power"][role]]

                    yield from self.players[player]["socket"].send(
                        json.dumps(response))

    def get_characters(self, num):
        return game_setting["character_set"][str(num)].copy()


if __name__ == "__main__":
    server = SocketServer()
    server.run("127.0.0.1", 8000)
