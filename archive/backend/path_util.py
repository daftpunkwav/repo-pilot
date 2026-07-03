"""
路径工具 —— PyInstaller 兼容
"""
import sys, os

# 项目根目录 = backend/ 的父目录
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def get_base_dir():
    """可写文件目录：dev=项目根目录, PyInstaller=exe所在目录"""
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return _PROJECT_ROOT

def get_resource_dir():
    """只读资源目录：dev=项目根目录, PyInstaller=sys._MEIPASS"""
    if getattr(sys, 'frozen', False):
        return sys._MEIPASS
    return _PROJECT_ROOT
