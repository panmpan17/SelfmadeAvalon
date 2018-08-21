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

        self.started = False

    def _checkdata(self, data, keys):
        dull = Dull()
        for key in keys:
            if key not in data:
                return False

            setattr(dull, key, data[key])
        return dull

    def run(self, ip, port):
        self.server = asyncws.start_server(self.handle_client, ip, port)
        asyncio.get_event_loop().run_until_complete(self.server)
        asyncio.get_event_loop().run_forever()

    def disconnect(self, user_id):
        yield from self.lock.acquire()

        if user_id in self.waiting:
            self.waiting.remove(user_id)
        if user_id in self.playing:
            self.playing.remove(user_id)
        if user_id in self.spectating:
            self.spectating.remove(user_id)

        self.players.pop(user_id)
        print(self.players)

        self.lock.release()

    @asyncio.coroutine
    def handle_client(self, websocket):
        user_id = "".join(random.sample(string.ascii_letters, 10))
        self.players[user_id] = websocket
        print(self.players)

        while True:
            try:
                data = yield from websocket.recv()

                # player disconnect
                if data == None:
                    yield from self.disconnect()
                    return

                data = json.loads(data)
            except Exception as e:
                yield from websocket.send(json.dumps(ErrMsg.DATA_PARSE_WRONG))
                continue

            try:
                if "method" not in data:
                    yield from websocket.send(json.dumps(ErrMsg.DATA_PARSE_WRONG))
                    continue

                try:
                    response = yield from self.__getattribute__(data["method"])(data, user_id)
                except AttributeError:
                    yield from websocket.send(json.dumps(ErrMsg.DATA_PARSE_WRONG))
                    continue

                print("handle complete", data, response)
                yield from websocket.send(json.dumps(response))

                if "askready" in response:
                    yield from self.lock.acquire()

                    if len(self.waiting) == REQUIRE_TO_START:
                        for _id in self.waiting:
                            yield from self.players[_id].send(json.dumps({
                                "method": method.NEEDREADY,
                            }))
                    else:
                        yield from websocket.send(json.dumps({
                            "method": method.NEEDREADY,
                        }))

                    self.lock.release()

                # shutdown connection if close in response
                if "close" in response:
                    yield from websocket.close()
                    return

            except Exception as e:
                print("Handle gone wrong: ", e)

    def LOGIN(self, data, user_id):
        data = self._checkdata(data, ("name", "secret"))
        if not data:
            # response can't leave blank
            return

        if data.name == "":
            # response can't leave blank
            return

        if data.secret != SECRET:
            return ErrMsg.VARIFYFAIL

        response = {"success": True}

        yield from self.lock.acquire()

        if len(self.waiting) >= PLAYERLIMIT or self.started:
            response["method"] = method.SPECTATE
            self.spectating.append(user_id)
        else:
            response["method"] = method.WAITING
            self.waiting.append(user_id)

        if len(self.waiting) >= REQUIRE_TO_START and response["method"] == method.WAITING:
            response["askready"] = True

        self.lock.release()
        return response


if __name__ == "__main__":
    server = SocketServer()
    server.run("127.0.0.1", 8000)
