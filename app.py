import flask
import os
import json

app = flask.Flask(__name__)

# load game setting
game_setting = json.load(open("game_setting.json"))
game_setting["images"] = os.listdir(os.path.join(app.static_folder, 'images'))

@app.route("/")
def index():
    return flask.render_template("index.html")


@app.route("/game_setting")
def settings():
    return flask.jsonify(game_setting)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8080, debug=True)
