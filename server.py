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

lock = asyncio.Lock()
waiting = []
spectating = []
playing = []
players = {}
started = False

SECRET = "mlpn"

# MERLIN = "merlin"
# PERCIVAL = "percival"
# SERVANT = "servant"

# MORDRED = "mordred"
# MORGANA = "morgana"
# OBERON = "oberon"
# ASSASSIN = "assassin"
# EVIL = "evil"


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


class Handler(object):

    def handle(self, data, user_id):
        if "method" not in data:
            return ErrMsg.DATA_PARSE_WRONG

        method = data["method"]
        response = yield from self.__getattribute__(method)(data, user_id)
        return response

    def _checkdata(self, data, keys):
        dull = Dull()
        for key in keys:
            if key not in data:
                return False

            setattr(dull, key, data[key])
        return dull

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

        response = {
            "success": True,
            "status": "Waiting",
        }

        yield from lock.acquire()

        if len(waiting) >= PLAYERLIMIT or started:
            response["method"] = method.SPECTATE
            spectating.append(user_id)
        else:
            response["method"] = method.WAITING
            waiting.append(user_id)

        if len(waiting) >= REQUIRE_TO_START and response["method"] == method.WAITING:
            response["askready"] = True

        lock.release()
        return response


@asyncio.coroutine
def handle_client(websocket):
    user_id = "".join(random.sample(string.ascii_letters, 10))
    players[user_id] = websocket
    print(players)

    while True:
        try:
            data = yield from websocket.recv()
            if data == None:
                yield from lock.acquire()

                if user_id in waiting:
                    waiting.remove(user_id)
                if user_id in playing:
                    playing.remove(user_id)
                if user_id in spectating:
                    spectating.remove(user_id)

                players.pop(user_id)
                print(players)

                lock.release()
                # TODO: Notify other user, theres one user disconnect
                break

            data = json.loads(data)
        except Exception as e:
            yield from websocket.send(json.dumps(ErrMsg.DATA_PARSE_WRONG))
            continue

        try:
            response = yield from handler.handle(data, user_id)
            print("handle complete", data, response)

            yield from websocket.send(json.dumps(response))

            print(waiting, playing, spectating)

            if "askready" in response:
                yield from lock.acquire()

                if len(waiting) == REQUIRE_TO_START:
                    for _id in waiting:
                        yield from players[_id].send(json.dumps({
                            "method": method.NEEDREADY,
                        }))
                else:
                    yield from websocket.send(json.dumps({
                        "method": method.NEEDREADY,
                    }))

                lock.release()

            # shutdown connection if close in response
            if "close" in response:
                yield from websocket.close()
                return

        except Exception as e:
            print("Handle gone wrong: ", e)

if __name__ == "__main__":
    handler = Handler()
    server = asyncws.start_server(handle_client, '127.0.0.1', 8000)
    asyncio.get_event_loop().run_until_complete(server)
    asyncio.get_event_loop().run_forever()
