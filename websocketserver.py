from protocolws import WebsocketServer
from game import Game

import json
import sys
import argparse

PLAYERLIMIT = 10
REQUIRE_TO_START = 5
SECRET = "mime"

def randomcode(num=6):
    return "".join(random.sample(string.ascii_letters, num))


class Method:
    def __init__(self, method_json):
        for method in method_json:
            self.__setattr__(method, method)


# load game setting
game_setting = json.load(open("game_setting.json"))
method = Method(game_setting["method"])

class ErrMsg:
    VARIFY_FAIL = {"close": True, "method": method.VARIFYFAIL}

class Server(WebsocketServer):
    def __init__(self):
        super().__init__()

        self.game = Game(game_setting, method)
        self.afk = set()
        self.ready = set()

    # Override WebsocketServer.disconnect
    def disconnect(_id, ws):
        if self.game.started:
            with (yield from self.lock):
                self.game.disconnect(_id)

                response = {"method": method.DISCONNECTTIMER, "user": _id,
                    "name": self.connected[_id]["name"], "timer": 60}

                for p in self.connected.values():
                    if p["id"] not in self.afk:
                        yield from self.send(p["ws"], response)
            return

        super().disconnect(_id, ws)
        player_ready = len([1 for _id in self.game.team if _id in self.ready])

        response = {"method": method.DISCONNECT, "user": _id,
            "players_num": len(self.connected), "player_ready": player_ready}

        for p in self.connected.values():
            yield from self.send(p["ws"], response)

    def start_game(self):
        self.game.started = True

        self.game.set_tokens()
        response = self.game.set_characters(self.connected)

        for p in self.game.users:
            role = self.game.role_map[p]
            response["role"] = role

            if role in game_setting["special_power"]:
                response["special_power"] = []
                for k, v in self.game.role_map.items():
                    if v in game_setting["special_power"][role]:
                        response["special_power"].append(k)

            yield from self.send(self.connected[p]["ws"], response)

    def approve_reject(self, response, websocket):
        resault = self.game.all_voted()

        # Check is everyone voted
        if resault is not None:
            if resault:
                # Execute Mission
                with (yield from self.lock):
                    response = {"method": method.ASKSUCCESS}
                    for p in self.game.users:
                        if p in self.game.team:
                            response["teamate"] = True
                            yield from self.send(self.connected[p]["ws"],
                                                 response)
                            continue

                        response["teamate"] = False
                        yield from self.send(self.connected[p]["ws"], response)
                return

            # Chose new captain
            self.game.vote_failed()

            if self.game.failed >= 5:
                # Game over evils win
                response = self.game.evil_win(add_token=False)

                with (yield from self.lock):
                    for p in self.game.users:
                        yield from self.send(self.connected[p]["ws"], response)
                return

            self.game.chose_captain()

            response = self.game.notify_captain()
            with (yield from self.lock):
                for p in self.game.users:
                    yield from self.send(self.connected[p]["ws"], response)

            self.game.reset_votes()
            return

        with (yield from self.lock):
            for p in self.game.users:
                yield from self.send(self.connected[p]["ws"], response)

    def success_fail(self, response, websocket):
        resault = self.game.all_executed()

        if resault is not None:
            resault = self.game.next_round()
            if resault is not None:
                with (yield from self.lock):
                    for p in self.game.users:
                        yield from self.send(self.connected[p]["ws"],
                                             resault)
                return

            with (yield from self.lock):
                response = {"method": method.GAMERECORD,
                            "record": self.game.record,
                            "round": self.game.round}

                for p in self.game.users:
                    yield from self.send(self.connected[p]["ws"], response)

                response = self.game.notify_captain()
                for p in self.connected:
                    yield from self.send(self.connected[p]["ws"], response)
            return

        with (yield from self.lock):
            for p in self.game.users:
                yield from self.send(self.connected[p]["ws"], response)

    def LOGIN(self, _id, ws, data):
        if not self._checkdata(data, ("name", "secret", )):
            return
        if data["name"] == "":
            return

        if data["secret"] != SECRET:
            yield from self.send(ws, ErrMsg.VARIFY_FAIL)
            return True

        with (yield from self.lock):
            response = {"success": True, "id": _id, "name": data["name"],
                        "players_num": len(self.connected)}
            self.connected[_id]["name"] = data["name"]

            # Become Specate if too many player or game started
            if len(self.game.users) >= PLAYERLIMIT or self.game.started:
                response["method"] = method.SPECTATE
                self.game.spectating.append(_id)
            else:
                response["method"] = method.WAITING
                self.game.users.append(_id)

            # Send Login success
            for p in self.connected.values():
                yield from self.send(p["ws"], response)

            # Send other players NEEDREADY if number is enough
            if (len(self.game.users) >= REQUIRE_TO_START and
                    response["method"] == method.WAITING):

                if len(self.game.users) == REQUIRE_TO_START:
                    for _id in self.game.users:
                        yield from self.send(self.connected[_id]["ws"],
                                             {"method": method.NEEDREADY})
                else:
                    yield from websocket.send(json.dumps({
                        "method": method.NEEDREADY}))

    def READY(self, _id, ws, data):
        with (yield from self.lock):
            self.ready.add(_id)

            player_ready = len([1 for _id in self.game.users if _id in self.ready])

            for p in self.connected.values():
                yield from self.send(p["ws"], {"method": method.CONFIRMREADY,
                                               "user": _id,
                                               "player_ready": player_ready})

            if len(self.game.users) == player_ready:
                yield from self.start_game()

    def STORYFINISH(self, _id, ws, data):
        self.game.story_finish += 1

        if self.game.has_finish_story():
            self.game.chose_captain()

            response = self.game.notify_captain()
            with (yield from self.lock):
                for p in self.game.users:
                    yield from self.send(self.connected[p]["ws"], response)

    def CHOSETEAMATE(self, _id, ws, data):
        if _id != self.game.captain:
            return
        if not self._checkdata(data, ("user_id", )):
            return

        response = self.game.chose_teamate(data["user_id"], True)

        with (yield from self.lock):
            for p in self.game.users:
                yield from self.send(self.connected[p]["ws"], response)

    def UNCHOSETEAMATE(self, _id, ws, data):
        if _id != self.game.captain:
            return
        if not self._checkdata(data, ("user_id", )):
            return

        response = self.game.chose_teamate(data["user_id"], False)

        with (yield from self.lock):
            for p in self.game.users:
                yield from self.send(self.connected[p]["ws"], response)

    def COMFIRMTEAM(self, _id, ws, data):
        if _id != self.game.captain:
            return

        response = self.game.confirmTeam()
        with (yield from self.lock):
            for p in self.game.users:
                yield from self.send(self.connected[p]["ws"], response)

    def APPROVE(self, _id, ws, data):
        yield from self.approve_reject(self.game.vote_approve(_id), ws)

    def REJECT(self, _id, ws, data):
        yield from self.approve_reject(self.game.vote_reject(_id), ws)

    def SUCCESS(self, _id, ws, data):
        yield from self.success_fail(self.game.mission_success(_id), ws)

    def FAIL(self, _id, ws, data):
        yield from self.success_fail(self.game.mission_fail(_id), ws)

    def ASSASSIN(self, _id, ws, data):
        if self.game.role_map[_id] != "ASSASSIN":
            return
        if not self._checkdata(data, ("user_id", )):
            return

        if self.game.role_map[data["user_id"]] == "MERLIN":
            response = self.game.evil_win(add_token=False)
            with (yield from self.lock):
                for p in self.game.users:
                    yield from self.send(self.connected[p]["ws"], response)
            return

        response = self.game.good_win()
        with (yield from self.lock):
            for p in self.game.users:
                yield from self.send(self.connected[p]["ws"], response)


if __name__ == "__main__":
    class Dummy:
        pass

    psr = argparse.ArgumentParser(description="Start up Avalon"
                                  "websocket server.")
    psr.add_argument("-o", default=False, action="store_true",
                     help="Wether server is using 0.0.0.0 or not.")
    vs = Dummy()
    psr.parse_args(sys.argv[1:], namespace=vs)

    server = Server()
    if vs.o:
        server.set_up("0.0.0.0", 8000)
    else:
        server.set_up("localhost", 8000)
    server.run_forever()
