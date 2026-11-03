"""frame-qc.py 核心函数的可导入包装（文件名带连字符不能直接 import）。"""
import importlib.util
import os

_p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frame-qc.py")
_spec = importlib.util.spec_from_file_location("frame_qc_impl", _p)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

check_skel = _mod.check_skel
check_green = _mod.check_green
skel_mask = _mod.skel_mask
green_mask = _mod.green_mask
ghost_ratio = _mod.ghost_ratio
load_palette_greens = _mod.load_palette_greens
TH = _mod.TH
