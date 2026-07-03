"""
入口 —— pywebview 启动
"""
import os, sys, time, threading, urllib.request
import webview
from backend.server import app

DIR = os.path.dirname(os.path.abspath(__file__))

def get_storage_dir():
    """WebView2 持久化存储目录（localStorage / Cookie 等）"""
    if getattr(sys, 'frozen', False):
        base = os.path.dirname(sys.executable)
    else:
        base = DIR
    return os.path.join(base, 'data', 'webview_profile')

def start_flask():
    app.run(host="127.0.0.1", port=19876, debug=False, use_reloader=False)

if __name__ == "__main__":
    storage_dir = get_storage_dir()
    os.makedirs(storage_dir, exist_ok=True)

    flask_thread = threading.Thread(target=start_flask, daemon=True)
    flask_thread.start()

    # 等待 Flask 就绪，避免 WebView 在服务器绑定端口前加载页面
    deadline = time.time() + 10
    while time.time() < deadline:
        try:
            urllib.request.urlopen("http://127.0.0.1:19876")
            break
        except Exception:
            time.sleep(0.1)

    webview.create_window(
        "GitHub Stash",
        "http://127.0.0.1:19876",
        width=1200,
        height=800,
        min_size=(900, 600),
    )
    webview.start(storage_path=storage_dir, private_mode=False)
