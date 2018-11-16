import flask
import sys
import argparse


class Dummy:
    pass


app = flask.Flask(__name__, static_url_path="")


@app.route("/")
def index():
    return flask.render_template("index.html")


@app.route("/test")
def test():
    return flask.render_template("test.html")


if __name__ == "__main__":
    psr = argparse.ArgumentParser(description="Start up Avalon"
                                  "HTTP server.")
    psr.add_argument("-o", default=False, action="store_true",
                     help="Wether server is using 0.0.0.0 or not.")
    vs = Dummy()
    psr.parse_args(sys.argv[1:], namespace=vs)

    if vs.o:
        app.run(host="0.0.0.0", port=8050, debug=True)
    else:
        app.run(host="localhost", port=8050, debug=True)
