from datetime import datetime

import json
import asyncio
import asyncws
import random
import string

PLAYERLIMIT = 10
REQUIRE_TO_START = 7


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


class Game:
    def __init__(self):
        self.captain = None
        self.readying = False
        self.story_finish = 0
        self.player_num = 0

        self.users = []
        self.team = []
        self.tokens = []
        self.token_need = []
        self.approve = []
        self.reject = []
        self.role_map = None

        self.chosing = False
        self.confirming = False

        self.round = 0
        self.good = 0
        self.evil = 0
        self.failed = 0

    def set_teams(self, players):
        self.users.extend(players)
        self.token_need = game_setting["token_need"][str(len(self.users))]

    def get_teams(self, players):
        return [[players[i]["id"], players[i]["name"]] for i in self.users]

    def set_characters(self, players):
        characters = game_setting["character_set"][
            str(len(self.users))].copy()
        random.shuffle(characters)

        self.role_map = dict(zip(self.users, characters))

        response = {
            "method": method.START,
            "players": self.get_teams(players),
            "token_need": self.token_need,
            "has_percival": ("PERCIVAL" in characters)}
        return response

    def has_finish_story(self):
        return len(self.users) == self.story_finish

    def chose_captain(self):
        if self.captain is None:
            self.captain = random.choice(self.users)
        else:
            cap_index = self.users.index(self.captain) + 1
            if cap_index == len(self.users):
                cap_index = 0

            self.captain = self.users[cap_index]

        return self.captain

    def notify_captain(self):
        self.chosing = True
        self.confirming = False

        return json.dumps({
            "method": method.CHOSECAPTAIN,
            "chosing": self.chosing,
            "confirming": self.confirming,
            "failed": self.failed,
            "round": self.round,
            "captain": self.captain})

    def chose_teamate(self, user_id, add_or_remove):
        if (add_or_remove and len(self.team) <
                self.token_need["numbers"][self.round]):
            if user_id not in self.team:
                self.team.append(user_id)
        else:
            if user_id in self.team:
                self.team.remove(user_id)

        response = json.dumps({"method": method.CHOSENTEAMATE,
                               "teamates": self.team})

        return response

    def confirmTeam(self):
        self.chosing = False
        self.confirming = True

        return json.dumps({
            "method": method.ASKAPPROVAL,
            "chosing": self.chosing,
            "confirming": self.confirming,
            "teamates": self.team})

    def vote_approve(self, _id):
        if _id not in self.approve:
            self.approve.append(_id)
        if _id in self.reject:
            self.reject.remove(_id)

        return json.dumps({
            "method": method.VOTECONFIRM,
            "voter": _id})

    def vote_reject(self, _id):
        if _id not in self.reject:
            self.reject.append(_id)
        if _id in self.approve:
            self.approve.remove(_id)

        return json.dumps({
            "method": method.VOTECONFIRM,
            "voter": _id})

    def all_voted(self):
        if len(self.approve) + len(self.reject) == len(self.users):
            return len(self.approve) > len(self.reject)
        return None

    def vote_failed(self):
        self.failed += 1

    def reset_votes(self):
        self.approve.clear()
        self.reject.clear()
        self.team.clear()

    def evil_win(self):
        return json.dumps({
            "method": method.END,
            "tokens": self.tokens,
            "failed": self.failed,
            "role_map": self.role_map})

    def disconnect(self, _id):
        try:
            self.users.remove(_id)
        except Exception:
            pass


class SocketServer:
    def __init__(self):
        self.server = None
        self.lock = asyncio.Lock()

        self.started = False

        self.players = {}
        self.waiting = []
        self.spectating = []

        self.captain = None
        self.game = Game()

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
            if user_id in self.spectating:
                self.spectating.remove(user_id)

            self.game.disconnect(user_id)
            self.players.pop(user_id)

            # Todo: notify other
            # if waiting number not enugh and is readying cancel ready
            # for player in self.players:
            #

    @asyncio.coroutine
    def handle_client(self, websocket):
        user_id = "".join(random.sample(string.ascii_letters, 10))
        self.players[user_id] = {"id": user_id, "socket": websocket,
                                 "ready": False}

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

        response = {"success": True, "id": user_id}

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
                    for _id in self.waiting:
                        yield from self.players[_id]["socket"].send(
                            json.dumps({"method": method.NEEDREADY}))
                else:
                    yield from websocket.send(json.dumps({
                        "method": method.NEEDREADY}))

    def READY(self, data, user_id, websocket):
        # response = {"method": method.CONFIRMREADY, "success": True}
        yield from websocket.send(json.dumps({"method": method.CONFIRMREADY,
                                              "success": True}))

        with (yield from self.lock):
            self.players[user_id]["ready"] = True

            if all([self.players[_id]["ready"] for _id in self.waiting]):
                self.game = Game()

                self.game.set_teams(self.waiting)
                self.waiting.clear()

                response = self.game.set_characters(self.players)

                for player in self.game.users:
                    role = self.game.role_map[player]
                    self.players[player]["role"] = role

                    response["role"] = role
                    if role in game_setting["special_power"]:
                        response["special_power"] = []
                        for k, v in self.game.role_map.items():
                            if v in game_setting["special_power"][role]:
                                response["special_power"].append(k)

                    yield from self.players[player]["socket"].send(
                        json.dumps(response))

    def STORYFINISH(self, data, user_id, websocket):
        self.game.story_finish += 1

        if self.game.has_finish_story():
            self.game.chose_captain()

            response = self.game.notify_captain()
            with (yield from self.lock):
                for player in self.game.users:
                    yield from self.players[player]["socket"].send(response)

    def CHOSETEAMATE(self, data, user_id, websocket):
        if user_id != self.game.captain:
            return

        data = self._checkdata(data, ("user_id", ))
        response = self.game.chose_teamate(data.user_id, True)

        with (yield from self.lock):
            for player in self.game.users:
                yield from self.players[player]["socket"].send(response)

    def UNCHOSETEAMATE(self, data, user_id, websocket):
        if user_id != self.game.captain:
            return

        data = self._checkdata(data, ("user_id", ))
        response = self.game.chose_teamate(data.user_id, False)

        with (yield from self.lock):
            for player in self.game.users:
                yield from self.players[player]["socket"].send(response)

    def COMFIRMTEAM(self, data, user_id, websocket):
        if user_id != self.game.captain:
            return

        response = self.game.confirmTeam()
        with (yield from self.lock):
            for player in self.game.users:
                yield from self.players[player]["socket"].send(response)

    def APPROVE(self, data, user_id, websocket):
        response = self.game.vote_approve(user_id)

        yield from self.approve_reject(response, websocket)

    def REJECT(self, data, user_id, websocket):
        response = self.game.vote_reject(user_id)

        yield from self.approve_reject(response, websocket)

    def approve_reject(self, response, websocket):
        resault = self.game.all_voted()

        # Check is everyone voted
        if resault is not None:
            yield from websocket.send(response)

            if resault:
                # Execute Mission
                return

            # Chose new captain
            self.game.vote_failed()

            if self.game.failed >= 5:
                # Game over evils win
                response = self.game.evil_win()

                with (yield from self.lock):
                    for player in self.game.users:
                        yield from self.players[player]["socket"].send(
                            response)

                return

            self.game.chose_captain()

            response = self.game.notify_captain()
            with (yield from self.lock):
                for player in self.game.users:
                    yield from self.players[player]["socket"].send(response)

            self.game.reset_votes()
            return

        with (yield from self.lock):
            for player in self.game.users:
                yield from self.players[player]["socket"].send(response)


if __name__ == "__main__":
    server = SocketServer()
    server.run("127.0.0.1", 8000)
