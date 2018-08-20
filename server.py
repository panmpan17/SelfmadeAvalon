import asyncio
import asyncws
import json

MERLIN = "merlin"
PERCIVAL = "percival"
SERVANT = "servant"

MORDRED = "mordred"
MORGANA = "morgana"
OBERON = "oberon"
ASSASSIN = "assassin"
EVIL = "evil"

CARSET = {
    5: [MERLIN, SERVANT, SERVANT, MORDRED, ASSASSIN],
    6: [MERLIN, PERCIVAL, SERVANT, SERVANT, ASSASSIN, MORGANA],
    7: [MERLIN, PERCIVAL, SERVANT, SERVANT, MORDRED, MORDRED, ASSASSIN],
    8: [MERLIN, PERCIVAL, SERVANT, SERVANT, SERVANT, MORDRED, MORDRED, ASSASSIN],
    9: [MERLIN, PERCIVAL, SERVANT, SERVANT, SERVANT, SERVANT, MORDRED, MORDRED, ASSASSIN],
    10: [MERLIN, PERCIVAL, SERVANT, SERVANT, SERVANT, SERVANT, MORDRED, MORDRED, ASSASSIN, EVIL],
}

SECRET = "mlpn"

class METHOD:
    ERROR = "error"

    LOGIN = "login"
    READY = "ready"
    UNREADY = "unready"
    SPECTATE = "spectate"
    UNSPECTATE = "unspectate"
    CHOSETEAM = "choseteam"
    COMFIRMTEAM = "comfirmteam"
    APPROVE = "approve"
    REJECT = "reject"
    SUCCESS = "success"
    FAIL = "fail"
    LAKE = "lake"
    ASSASIN = "assasin"

    VARIFYFAIL = "varifyfail"
    # SPECTATE
    WAITING = "waiting"
    NEEDREADY = "needready"
    TOOMANY = "toomany"
    START = "start"
    ASKTEAM = "askteam"
    ASKAPPROVAL = "askapproval"
    ASSEMBLEFAIL = "assemblefail"
    ASKSUCCESS = "asksuccess"
    FAIL = "fail"
    SUCCESS = "success"
    END = "end"

class Dull:
    pass

class ErrMsg:
    DATA_PARSE_WRONG = {
        "success": False,
        "method": METHOD.ERROR,
        "reason": "Data Parse Error"}

    VARIFYFAIL = {
        "success": False,
        "close": True,
        "method": METHOD.VARIFYFAIL}


class Handler(object):
    def handle(self, data):
        if "method" not in data:
            return ErrMsg.DATA_PARSE_WRONG

        method = data["method"]
        response = self.__getattribute__(method)(data)
        return response

    def _checkdata(self, data, keys):
        dull = Dull()
        for key in keys:
            if key not in data:
                return False

            setattr(dull, key, data[key])
        return dull

    def login(self, data):
        data = self._checkdata(data, ("name", "secret"))
        if not data:
            # response can't leave blank
            return

        if data.name == "":
            # response can't leave blank
            return

        if data.secret != SECRET:
            return ErrMsg.VARIFYFAIL

        
        return {
            "success": True,
            "status": "Waiting",
            }


@asyncio.coroutine
def echo(websocket):
    while True:
        try:
            data = yield from websocket.recv()
            if data == None:
                # TODO: Notify other user, theres one user disconnect
                break

            data = json.loads(data)
        except Exception as e:
            yield from websocket.send(json.dumps(DATA_PARSE_WRONG))
            continue

        try:
            response = handler.handle(data)

            print("handle complete", response)
            yield from websocket.send(json.dumps(response))

            # 關閉連結
            if "close" in response:
                yield from websocket.close()
        except Exception as e:
            print("Handle gone wrong: ", e)

handler = Handler()
server = asyncws.start_server(echo, '127.0.0.1', 8000)
asyncio.get_event_loop().run_until_complete(server)
asyncio.get_event_loop().run_forever()
