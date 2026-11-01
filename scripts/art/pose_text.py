#!/usr/bin/env python3
"""从 pose 关键点生成每帧的姿势文字描述（喂给 Qwen-Image-Edit 的提示词）。
角色朝画面右。关键点：0鼻 1颈 2右肩 3右肘 4右手腕 5左肩 6左肘 7左手腕
8右髋 9右膝 10右踝 11左髋 12左膝 13左踝 14-17 眼耳。"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent


def dist(a, b):
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5


def arm_desc(s, e, w, neck, head):
    """一只手臂的姿势。s 肩 e 肘 w 腕。用肘部共线性判伸直（弯臂直线距离短，不能直接用）。"""
    seg = dist(s, e) + dist(e, w) + 1e-6
    straight = dist(s, w) / seg
    dx = w[0] - s[0]
    dy = w[1] - neck[1]
    if straight > 0.88 and dx > 80 and dy < 80:
        return "完全伸直向画面右打出"
    if straight > 0.88 and dx > 80:
        return "向下伸出"
    if w[1] < neck[1] - 60 and w[0] < neck[0] + 80:
        return "向上高举过头"
    if dist(w, head) < 160 and dy < 120:
        return "握拳护在脸前"
    if dx < -40:
        return "收在身后"
    return "屈肘收在身前"


def leg_desc(h, k, a, hip_y_mid, ground_y):
    """一条腿的姿势。h 髋 k 膝 a 踝。前踢=膝朝前水平伸；后踢/横扫=腿朝后伸。"""
    thigh = dist(h, k) + 1e-6
    shin = dist(k, a) + 1e-6
    dxk = k[0] - h[0]
    if a[1] < h[1] - 20:
        return "高抬过头踢出"
    if dxk > 0.45 * thigh and a[1] > h[1]:
        if a[0] < k[0] - 0.3 * shin:
            return "膝前顶小腿后收（踢腿蓄势）"
        return "膝朝前顶出"
    if dxk < -0.45 * thigh:
        return "腿朝后伸直"
    if a[1] < k[1] - 0.3 * shin:
        return "屈膝收起"
    if k[1] - h[1] > 0.85 * thigh:
        return "蹬直支撑"
    return "支撑站立"


def describe_frame(fr):
    kp = fr["keypoints"]
    nose, neck = kp[0], kp[1]
    rsh, rel, rwr = kp[2], kp[3], kp[4]
    lsh, lel, lwr = kp[5], kp[6], kp[7]
    rhip, rkn, rank = kp[8], kp[9], kp[10]
    lhip, lkn, lank = kp[11], kp[12], kp[13]
    hip_mid = [ (rhip[0]+lhip[0])/2, (rhip[1]+lhip[1])/2 ]
    torso = dist(neck, hip_mid) + 1e-6
    lean = (neck[0] - hip_mid[0]) / torso
    parts = []
    # 躯干
    if lean > 0.35:
        parts.append("身体大幅前倾")
    elif lean < -0.25:
        parts.append("身体后仰")
    elif lean > 0.12:
        parts.append("身体微前倾")
    # 手臂（左右=角色自己的左右；角色朝右，所以两只拳都朝画面右打）
    parts.append("右拳" + arm_desc(rsh, rel, rwr, neck, nose))
    parts.append("左拳" + arm_desc(lsh, lel, lwr, neck, nose))
    # 腿
    ground_y = max(rank[1], lank[1])
    parts.append("右腿" + leg_desc(rhip, rkn, rank, hip_mid[1], ground_y))
    parts.append("左腿" + leg_desc(lhip, lkn, lank, hip_mid[1], ground_y))
    # 整体（倒地/腾空的粗判）
    xs_all = [p[0] for p in kp[:14]]
    ys_all = [p[1] for p in kp[:14]]
    horiz = max(xs_all) - min(xs_all)
    vert = max(ys_all) - min(ys_all)
    if horiz > 1.7 * vert:
        parts.append("横躺倒地")
    elif min(rank[1], lank[1]) < hip_mid[1] - 0.3 * dist(hip_mid, neck) * 2:
        parts.append("双腿离地腾空")
    return "，".join(parts)


if __name__ == "__main__":
    import sys
    cid = sys.argv[1] if len(sys.argv) > 1 else "c01"
    data = json.load(open(ROOT / "art-work" / "poses" / (cid + ".json")))
    for a, anim in data["anims"].items():
        print("== " + a)
        for i, fr in enumerate(anim["frames"][:3]):
            print(f"  {i:02d}: {describe_frame(fr)}")
