import random


class Game:
    def __init__(self, game_setting, method):
        self.game_setting = game_setting
        self.method = method

        self.started = False
        self.player_num = 0  # The number of players
        self.story_finish = 0  # The number of players that watched story
        self.captain = None  # The player that chose team

        self.users = []  # Player in the game
        self.spectating = []  # Player not in the game

        self.team = []  # Player chosen to execute mission

        self.tokens = []  # Tokens Record, 1 is good, -1 is evil
        self.token_need = []  # The number of players that tokens need
        self.approve = []  # Who aprrove the team
        self.reject = []  # Who reject the team

        self.success = []  # Who successfully execute mission
        self.fail = []  # Who failed to execute misson

        self.record = []  # Record of players choice

        self.role_map = None  # Player_id to role

        self.chosing = False  # Is captain chosing
        self.confirming = False  # Is players comfirming team

        self.round = 0
        self.failed = 0  # The number of round that reject greater than approve

    def set_tokens(self):
        self.token_need = self.game_setting["token_need"][str(len(
            self.users))]

    def get_teams(self, players):
        return [[players[i]["id"], players[i]["name"]] for i in self.users]

    def set_characters(self, connected):
        chars = self.game_setting["character_set"][str(len(self.users))]
        suf_chars = chars.copy()
        random.shuffle(suf_chars)

        self.role_map = dict(zip(self.users, suf_chars))

        response = {
            "method": self.method.START,
            "players": self.get_teams(connected),
            "token_need": self.token_need,
            "has_percival": ("PERCIVAL" in chars),
            "characters": chars}
        return response

    def has_finish_story(self):
        return len(self.users) == self.story_finish

    def chose_captain(self):
        # Clean up relative list
        self.team.clear()
        self.approve.clear()
        self.reject.clear()
        self.success.clear()
        self.fail.clear()

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

        return {
            "method": self.method.CHOSECAPTAIN,
            "chosing": self.chosing,
            "confirming": self.confirming,
            "failed": self.failed,
            "round": self.round,
            "captain": self.captain}

    def chose_teamate(self, user_id, add_or_remove):
        if (add_or_remove and len(self.team) <
                self.token_need["numbers"][self.round]):
            if user_id not in self.team:
                self.team.append(user_id)
        else:
            if user_id in self.team:
                self.team.remove(user_id)

        response = {"method": self.method.CHOSENTEAMATE,
                    "teamates": self.team}

        return response

    def confirmTeam(self):
        self.chosing = False
        self.confirming = True

        return {
            "method": self.method.ASKAPPROVAL,
            "chosing": self.chosing,
            "confirming": self.confirming,
            "teamates": self.team}

    def vote_approve(self, _id):
        if _id not in self.approve:
            self.approve.append(_id)
        if _id in self.reject:
            self.reject.remove(_id)

        return {"method": self.method.VOTECONFIRM,
                "voter": _id}

    def vote_reject(self, _id):
        if _id not in self.reject:
            self.reject.append(_id)
        if _id in self.approve:
            self.approve.remove(_id)

        return {"method": self.method.VOTECONFIRM, "voter": _id}

    def all_voted(self):
        if len(self.approve) + len(self.reject) == len(self.users):
            return len(self.approve) > len(self.reject)
        return None

    def reset_votes(self):
        self.approve.clear()
        self.reject.clear()

    def mission_success(self, _id):
        if _id not in self.success:
            self.success.append(_id)
        if _id in self.fail:
            self.fail.remove(_id)

        return {"method": self.method.MISSIONCONFIRM, "voter": _id}

    def mission_fail(self, _id):
        if _id not in self.fail:
            self.fail.append(_id)
        if _id in self.success:
            self.success.remove(_id)

        return {"method": self.method.MISSIONCONFIRM, "voter": _id}

    def all_executed(self):
        if len(self.success) + len(self.fail) == len(self.team):
            return True
        return None

    def check_mission(self):
        record = {"success": len(self.success), "fail": len(self.fail),
                  "team": self.team.copy()}

        if self.token_need["two_fail"] == self.round and len(self.fail) <= 1:
            self.tokens.append(1)
            record["good_evil"] = "good"
        elif len(self.fail) > 0:
            self.tokens.append(-1)
            record["good_evil"] = "evil"
        else:
            self.tokens.append(1)
            record["good_evil"] = "good"

        self.record.append(record)

        self.round += 1
        self.chose_captain()

        if self.tokens.count(1) == 3:
            evils_role_map = {}

            for _id, role in self.role_map.items():
                if role in ["MORDRED", "MORGANA", "ASSASSIN", "EVIL"]:
                    evils_role_map[_id] = role
            return {"method": self.method.KILLMERLIN,
                    "evils_role_map": evils_role_map}
        elif self.tokens.count(-1) == 3:
            return self.evil_win()

    def evil_win(self, add_token=True):
        return {"method": self.method.END, "tokens": self.tokens,
                "add_token": add_token, "failed": self.failed,
                "role_map": self.role_map}

    # def good_win(self):
    #     return {"method": self.method.END, "tokens": self.tokens,
    #             "failed": self.failed, "role_map": self.role_map,
    #             "win": "good"}

    def disconnect(self, _id):
        try:
            self.users.remove(_id)
        except ValueError:
            pass
