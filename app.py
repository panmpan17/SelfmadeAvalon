import flask
import os

app = flask.Flask(__name__)
IMAGES = os.listdir(os.path.join(app.static_folder, 'images'))


@app.route("/")
def index():
    return flask.render_template("index.html")


@app.route("/images")
def images():
    return flask.jsonify(images=IMAGES)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8080, debug=True)
