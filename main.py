"""
入口 —— pywebview 启动
"""
import os, sys, threading
import webview
from backend.server import app

DIR = os.path.dirname(os.path.abspath(__file__))

def start_flask():
    app.run(host="127.0.0.1", port=19876, debug=False, use_reloader=False)

if __name__ == "__main__":
    flask_thread = threading.Thread(target=start_flask, daemon=True)
    flask_thread.start()

    webview.create_window(
        "GitHub Stash",
        "http://127.0.0.1:19876",
        width=1200,
        height=800,
        min_size=(900, 600),
    )
    webview.start()
