from datetime import datetime
from pprint import pprint

import sys
import argparse
import logging
import json
import asyncio
import asyncws
import random
import string

PLAYERLIMIT = 10
REQUIRE_TO_START = 5


class Method:
    def __init__(self, method_json):
        for method in method_json:
            self.__setattr__(method, method)


# load game setting
game_setting = json.load(open("game_setting.json"))
method = Method(game_setting["method"])

SECRET = "mime"


class Dummy:
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

        self.success = []
        self.fail = []

        self.record = {0: {"votes": []}}

        self.role_map = None

        self.chosing = False
        self.confirming = False

        self.round = 0
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

        return json.dumps({"method": method.VOTECONFIRM, "voter": _id})

    def all_voted(self):
        if len(self.approve) + len(self.reject) == len(self.users):
            return len(self.approve) > len(self.reject)
        return None

    def vote_failed(self):
        self.failed += 1

    def reset_votes(self):
        self.record[self.round]["votes"].append(
            {"approve": self.approve.copy(), "reject": self.reject.copy()})

        self.approve.clear()
        self.reject.clear()

    def mission_success(self, _id):
        if _id not in self.success:
            self.success.append(_id)
        if _id in self.fail:
            self.fail.remove(_id)

        return json.dumps({"method": method.MISSIONCONFIRM, "voter": _id})

    def mission_fail(self, _id):
        if _id not in self.fail:
            self.fail.append(_id)
        if _id in self.success:
            self.success.remove(_id)

        return json.dumps({"method": method.MISSIONCONFIRM, "voter": _id})

    def all_executed(self):
        if len(self.success) + len(self.fail) == len(self.team):
            return True
        return None

    def next_round(self):
        self.record[self.round]["resault"] = {
            "success": len(self.success), "fail": len(self.fail),
            "team": self.team.copy()}

        if self.token_need["two_fail"] == self.round and len(self.fail) <= 1:
            self.tokens.append(1)
            self.record[self.round]["resault"]["good_evil"] = "good"
        if len(self.fail) > 0:
            self.tokens.append(-1)
            self.record[self.round]["resault"]["good_evil"] = "evil"
        else:
            self.tokens.append(1)
            self.record[self.round]["resault"]["good_evil"] = "good"

        self.team.clear()
        self.approve.clear()
        self.reject.clear()
        self.success.clear()
        self.fail.clear()
        self.round += 1
        self.chose_captain()

        self.record[self.round] = {"votes": []}

        if self.tokens.count(1) == 3:
            evils_role_map = {}

            for _id, role in self.role_map.items():
                if role in ["MORDRED", "MORGANA", "ASSASSIN", "EVIL"]:
                    evils_role_map[_id] = role
            return json.dumps({"method": method.KILLMERLIN,
                               "evils_role_map": evils_role_map})
        elif self.tokens.count(-1) == 3:
            return self.evil_win()

    def evil_win(self, add_token=True):
        return json.dumps({"method": method.END, "tokens": self.tokens,
                           "add_token": add_token, "failed": self.failed,
                           "role_map": self.role_map, "win": "evil"})

    def good_win(self):
        return json.dumps({"method": method.END, "tokens": self.tokens,
                           "failed": self.failed, "role_map": self.role_map,
                           "win": "good"})

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
        dull = Dummy()
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

            player_ready = len(
                [1 for _id in self.waiting if self.players[_id]["ready"]])

            response = {"method": method.DISCONNECT, "user": user_id,
                "players_num": len(self.players), "player_ready": player_ready}
            for player in self.players.values():
                yield from player["socket"].send(json.dumps(response))

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
                    logging.exception("Oops, seem like handler has gone wrong")
                    yield from websocket.send(json.dumps(
                        ErrMsg.DATA_PARSE_WRONG))
                    continue

                # shutdown connection if close in response
                if response == "close":
                    yield from websocket.close()
                    return

            except Exception as e:
                logging.exception("Oops, seem like handler has gone wrong")

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

        with (yield from self.lock):
            response = {"success": True, "id": user_id, "name": data.name,
                        "players_num": len(self.players)}
            self.players[user_id]["name"] = data.name

            # Become Specate if too many player or game started
            if len(self.waiting) >= PLAYERLIMIT or self.started:
                response["method"] = method.SPECTATE
                self.spectating.append(user_id)
            else:
                response["method"] = method.WAITING
                self.waiting.append(user_id)

            # Send Login success
            for player in self.players.values():
                yield from player["socket"].send(json.dumps(response))

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
        with (yield from self.lock):
            self.players[user_id]["ready"] = True

            player_ready = len(
                [1 for _id in self.waiting if self.players[_id]["ready"]])

            for player in self.players.values():
                yield from player["socket"].send(json.dumps({
                    "method": method.CONFIRMREADY, "user": user_id,
                    "player_ready": player_ready}))

            if len(self.waiting) == player_ready:
                yield from self.start_game()

    def start_game(self):
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
        yield from self.approve_reject(self.game.vote_approve(
            user_id), websocket)

    def REJECT(self, data, user_id, websocket):
        yield from self.approve_reject(self.game.vote_reject(
            user_id), websocket)

    def approve_reject(self, response, websocket):
        resault = self.game.all_voted()

        # Check is everyone voted
        if resault is not None:
            if resault:
                # Execute Mission
                with (yield from self.lock):
                    response = {"method": method.ASKSUCCESS, "teamate": False}
                    for player in self.game.users:
                        if player in self.game.team:
                            response["teamate"] = True
                            yield from self.players[player]["socket"].send(
                                json.dumps(response))
                            continue

                        response["teamate"] = False
                        yield from self.players[player]["socket"].send(
                            json.dumps(response))
                return

            # Chose new captain
            self.game.vote_failed()

            if self.game.failed >= 5:
                # Game over evils win
                response = self.game.evil_win(add_token=False)

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

    def SUCCESS(self, data, user_id, websocket):
        yield from self.success_fail(self.game.mission_success(user_id),
                                     websocket)

    def FAIL(self, data, user_id, websocket):
        yield from self.success_fail(self.game.mission_fail(user_id),
                                     websocket)

    def success_fail(self, response, websocket):
        resault = self.game.all_executed()

        if resault is not None:
            resault = self.game.next_round()
            if resault is not None:
                with (yield from self.lock):
                    for player in self.game.users:
                        yield from self.players[player]["socket"].send(resault)
                return

            with (yield from self.lock):
                response = json.dumps({"method": method.GAMERECORD,
                                       "record": self.game.record,
                                       "round": self.game.round})

                for player in self.game.users:
                    yield from self.players[player]["socket"].send(response)

                response = self.game.notify_captain()
                for player in self.players:
                    yield from self.players[player]["socket"].send(response)
            return

        with (yield from self.lock):
            for player in self.game.users:
                yield from self.players[player]["socket"].send(response)

    def ASSASSIN(self, data, user_id, websocket):
        if self.game.role_map[user_id] != "ASSASSIN":
            return

        data = self._checkdata(data, ("user_id", ))
        if self.game.role_map[data.user_id] == "MERLIN":
            response = self.game.evil_win(add_token=False)
            with (yield from self.lock):
                for player in self.game.users:
                    yield from self.players[player]["socket"].send(response)
            return

        response = self.game.good_win()
        with (yield from self.lock):
            for player in self.game.users:
                yield from self.players[player]["socket"].send(response)


if __name__ == "__main__":
    psr = argparse.ArgumentParser(description="Start up Avalon"
                                  "websocket server.")
    psr.add_argument("-o", default=False, action="store_true",
                     help="Wether server is using 0.0.0.0 or not.")
    vs = Dummy()
    psr.parse_args(sys.argv[1:], namespace=vs)

    server = SocketServer()
    if vs.o:
        server.run("0.0.0.0", 8000)
    else:
        server.run("localhost", 8000)
