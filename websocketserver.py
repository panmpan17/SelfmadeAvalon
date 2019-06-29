from threading import Thread
from datetime import datetime
from time import sleep

from game import Game

import json
import sys
import argparse

sys.path.append("../ProtocolWebscocket")
from protocolws import WebsocketServer

PLAYERLIMIT = 10
REQUIRE_TO_START = 5
AFK_TIMEOUT = 5
SECRET = "mime"


class Method:
    def __init__(self, method_json):
        for method in method_json:
            self.__setattr__(method, method)


# load game setting
game_setting = json.load(open("game_setting.json"))
method = Method(game_setting["method"])


class ErrMsg:
    VARIFY_FAIL = {"close": True, "method": method.VARIFYFAIL}
    REJOIN_FAIL = {"close": True, "method": method.REJOINFAIL}


class Server(WebsocketServer):
    def __init__(self):
        super().__init__()

        self.game = Game(game_setting, method)
        self.afk = {}
        self.ready = set()

    # Override WebsocketServer.disconnect
    def disconnect(self, _id, ws):
        self.game.disconnect(_id)

        if self.game.started:
            with (yield from self.lock):
                self.afk[_id] = datetime.now()

                print(_id, "disconnect start timer.")
                response = {"method": method.DISCONNECTTIMER, "user": _id,
                            "name": self.connected[_id]["name"],
                            "timer": AFK_TIMEOUT,
                            "timestamp": int(self.afk[_id].timestamp())}

                # Start timer.
                Thread(target=self.afk_timeout,
                       args=(AFK_TIMEOUT, _id)).start()

                for p in self.connected.values():
                    if p["id"] not in self.afk:
                        yield from self.send(p["ws"], response)

            return

        # Remove user in other varible
        yield from super().disconnect(_id, ws)
        if _id in self.ready:
            self.ready.remove(_id)

        # Recount total players, and send message back
        response = {"method": method.READYDISCON,
                    "players_num": len(self.connected),
                    "player_ready": len(self.ready)}

        for p in self.connected.values():
            yield from self.send(p["ws"], response)

    def afk_timeout(self, timeout, _id):
        sleep(timeout)
        if _id not in self.afk:
            print("Player is here.")
            return

        self.stop_game()

    def start_game(self):
        self.game.start()
        response = self.game.get_start_msg()
        response["players"] = self.game.get_teams(self.connected)

        for p in self.game.users:
            role = self.game.role_map[p]
            response["role"] = role

            # Give special character information
            if role in game_setting["special_power"]:
                response["special_power"] = []
                for k, v in self.game.role_map.items():
                    if v in game_setting["special_power"][role]:
                        response["special_power"].append(k)

            yield from self.send(self.connected[p]["ws"], response)

    def stop_game(self):
        print("stop game, tell everyone the rolemap.")
        pass

    def approve_reject(self, response):
        resault = self.game.all_voted()

        # Check is everyone voted
        if resault is not None:
            if resault:
                self.game.execute_mission()

                # Send execute mission msg
                with (yield from self.lock):
                    response = {"method": method.ASKSUCCESS}

                    for p in self.game.users:
                        if self.game.in_team(p):
                            response["teamate"] = True
                            yield from self.send(self.connected[p]["ws"],
                                                 response)
                            continue

                        response["teamate"] = False
                        yield from self.send(self.connected[p]["ws"], response)
                return

            self.game.failed += 1
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

    def success_fail(self, response):
        resault = self.game.all_executed()

        if resault is not None:
            resault = self.game.check_mission()
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
                for p in self.connected.values():
                    yield from self.send(p["ws"], response)
            return

        with (yield from self.lock):
            for p in self.game.users:
                yield from self.send(self.connected[p]["ws"], response)

    def LOGIN(self, _id, ws, data):
        if not self.check_data(data, ("name", "secret", )):
            return True
        if data["name"] == "":
            return True

        if data["secret"] != SECRET:
            yield from self.send(ws, ErrMsg.VARIFY_FAIL)
            return True

        response = {"id": _id, "name": data["name"]}
        with (yield from self.lock):
            response["players_num"] = len(self.connected)
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
                    yield from self.send(ws, {"method": method.NEEDREADY})

    def REJOIN(self, _id, ws, data):
        if not self.check_data(data, ("code", )):
            return True
        if data["code"] not in self.afk:
            yield from self.send(ws, ErrMsg.REJOIN_FAIL)
            return

        old_id = data["code"]
        response = {"method": method.REJOIN, "old_id": old_id,
                    "new_id": _id}
        with (yield from self.lock):
            if old_id in self.game.users:
                self.game.users.remove(old_id)

            self.connected[_id]["name"] = self.connected[old_id]["name"]
            self.connected.pop(old_id)
            self.afk.remove(old_id)
            response["name"] = self.connected[_id]["name"]

            for p in self.connected.values():
                yield from self.send(p["ws"], response)

    def READY(self, _id, ws, data):
        with (yield from self.lock):
            self.ready.add(_id)

            # player_ready = len(
            # [1 for _id in self.game.users if _id in self.ready])

            for p in self.connected.values():
                yield from self.send(p["ws"],
                                     {"method": method.CONFIRMREADY,
                                      "user": _id,
                                      "player_ready": len(self.ready)})

            if len(self.game.users) == len(self.ready):
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
        if not self.check_data(data, ("user_id", )):
            return

        response = self.game.chose_teamate(data["user_id"], True)

        with (yield from self.lock):
            for p in self.game.users:
                yield from self.send(self.connected[p]["ws"], response)

    def UNCHOSETEAMATE(self, _id, ws, data):
        if _id != self.game.captain:
            return
        if not self.check_data(data, ("user_id", )):
            return

        response = self.game.chose_teamate(data["user_id"], False)

        with (yield from self.lock):
            for p in self.game.users:
                yield from self.send(self.connected[p]["ws"], response)

    def COMFIRMTEAM(self, _id, ws, data):
        if _id != self.game.captain:
            return

        response = self.game.confirm_team()
        with (yield from self.lock):
            for p in self.game.users:
                yield from self.send(self.connected[p]["ws"], response)

    def APPROVE(self, _id, ws, data):
        yield from self.approve_reject(self.game.vote_approve(_id))

    def REJECT(self, _id, ws, data):
        yield from self.approve_reject(self.game.vote_reject(_id))

    def SUCCESS(self, _id, ws, data):
        yield from self.success_fail(self.game.mission_success(_id))

    def FAIL(self, _id, ws, data):
        yield from self.success_fail(self.game.mission_fail(_id))

    def ASSASSIN(self, _id, ws, data):
        if self.game.role_map[_id] != "ASSASSIN":
            return
        if not self.check_data(data, ("user_id", )):
            return

        response = {"method": method.ASSASSIN, "role_map": self.game.role_map,
                    "is_merlin": (
                        self.game.role_map[data["user_id"]] == "MERLIN")}

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
