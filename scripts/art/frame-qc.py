#!/usr/bin/env python3
"""frame-qc.py — 精灵帧全量质检（8 角色 × 全部帧）

六项检查（INBOX 2026-11-03 A1 复核 + 19:20 增补）：
  S 骨架线残留：目标骨架图(control 图)做掩膜膨胀 2px；掩膜内"近白或近骨架色、
    且比周围亮"的像素占掩膜面积 >3% → 失败（用覆盖率不用 IoU，细线 IoU 天然小）
  K 绿边：alpha 边缘 4px 带内 G 比 max(R,B) 高 30 以上、且颜色不匹配立绘配色
    的像素占带内像素 >2% → 失败（c07 绿围裙等立绘本有的绿色按立绘配色排除）
  G 半透明残影：alpha 30–200 像素占人物面积(A>200)的比例，比该角色 idle_00
    高 0.08 以上 → 失败
  P 动作跟随：对输出帧跑 DWPose(yolox_l + dw-ll_ucoco_384)，与目标骨架算
    PCK@0.1（身高归一），<0.7 → 失败
  I 像待机：非豁免动画帧与 idle_00 剪影 IoU >0.88 → 姿势画成了待机
  ID 身份（19:20 增补）：与定稿立绘是否同一角色，两子项任一失败即判 ID：
    a) 主色直方图距离 D：帧与立绘各自取 LAB 12^3 主色直方图(top-32 bin 重归一化)，
       D=1-Σmin。失败判据 D > max(0.45, 1.5×该角色当批中位数)——绝对下限抓
       整体换人，相对项按角色自身正常水平定标（8 角色服装色族相近，全局单一
       阈值误杀率高，2026-11-03 用 baseline vs 07f0df9 返修帧校准：RGB 直方图
       无法分离，LAB 空间 baseline p99=0.650；c07 st_hp 8 帧全换人 D=0.31–0.76，
       D+高度比合并可抓 7/8）
    b) 高度比：帧人物 bbox 高(A>100) / idle_00 bbox 高，超出 [0.85, 1.15] 失败；
       蹲/倒地类及腾空收腿类豁免（2026-11-03 全量 1632 帧标定：非豁免动作
       最低比值 0.90，豁免集内最低 0.49）
  T 整体半透明（19:20 增补）：alpha 30–200 像素占人物面积(A>30)比例 >12% → 失败
    （与 G 的区别：G 是相对自身 idle 的残影增量，T 是绝对整体半透明；baseline
    全帧最大 5.7%，阈值留 2 倍余量，抓 BiRefNet 抠图宽半透明带/大面积鬼影）

输出：.check/frame-qc-report.json + 每人一张问题帧标红蒙太奇
      .check/frame-qc-montage-<cid>.png

用法（latentsync-env 有 onnxruntime CUDA EP）：
  ~/latentsync-env/bin/python scripts/art/frame-qc.py
  ~/latentsync-env/bin/python scripts/art/frame-qc.py --chars c04 --limit 20   # 调试
  ~/latentsync-env/bin/python scripts/art/frame-qc.py --no-pose                # 跳过 DWPose
"""
import argparse
import json
import os
import sys
import time

# CUDA EP 依赖 cuDNN 9 / CUDA 12（latentsync-env 的 nvidia pip 包里带）。
# ⚠️ 必须用 scripts/art/run-qc.sh 启动（bash 层 export LD_LIBRARY_PATH）：
# ld.so 只在 python 进程启动时读 LD_LIBRARY_PATH，运行时改 os.environ 对 dlopen 无效。

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.ndimage import binary_dilation, binary_erosion, median_filter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ART = os.path.join(ROOT, "art-work")
CHK = os.path.join(ROOT, ".check")
MODELS = os.path.join(ROOT, "scripts", "art", "models")

# render-poses.py 的 18 色骨架色
SKEL_COLORS = np.array([
    (255, 0, 0), (255, 85, 0), (255, 170, 0), (255, 255, 0), (170, 255, 0), (85, 255, 0),
    (0, 255, 0), (0, 255, 85), (0, 255, 170), (0, 255, 255), (0, 170, 255), (0, 85, 255),
    (0, 0, 255), (85, 0, 255), (170, 0, 255), (255, 0, 255), (255, 0, 170), (255, 0, 85),
], dtype=np.int16)

TH = {"skel_frac": 0.03, "green_frac": 0.02, "ghost_delta": 0.08, "pck": 0.7, "idle_iou": 0.88,
      # ID 身份（19:20 增补，2026-11-03 baseline vs 07f0df9 返修帧校准）
      "id_color_abs": 0.45,    # 主色直方图距离绝对下限（整体换人）
      "id_color_rel": 1.5,     # 相对项：× 该角色当批中位数
      "id_height_min": 0.85,   # 高度比区间（vs idle_00）
      "id_height_max": 1.15,
      "trans_frac": 0.12}      # T 整体半透明：alpha 30–200 占人物面积上限

# I 像待机：这些动画本就接近 idle 或姿势独特，不判"没跟上动作"（INBOX 2026-11-03 第 4 条
# 指定豁免 idle/walk/crouch/block/win；ko/knockdown/maxstart 为独特姿势，一并豁免防误杀；
# blockstun/hitstun/dizzy 为纯状态动画（受击/格挡硬直/眩晕，无"该有的动作"、姿势本就接近
# 待机，c07 快测 idle_iou 0.94-0.99 证实误判），豁免。有实际动作的 airhit/gc/roll/attack 保留检查）
IDLE_EXEMPT = {"idle", "walkf", "walkb", "crouch", "crblock", "win", "ko", "knockdown",
               "maxstart", "blockstun", "hitstun", "dizzy"}


def anim_exempt(fname):
    return fname.rsplit("_", 1)[0] in IDLE_EXEMPT

# ID 高度比豁免：蹲/倒地类（INBOX 2026-11-03 19:20 指定"蹲/倒地类豁免"）+
# 腾空收腿/翻滚类（bbox 天然矮）。2026-11-03 全量 1632 帧标定：非豁免动作
# 最低比值 0.90（zhongkeng 0.90），豁免集内最低 0.49（ko 倒地）
ID_HEIGHT_EXEMPT = {
    "crouch", "crblock", "cr_hk", "cr_hp", "cr_lk", "cr_lp", "cr_mk", "cr_mp",
    "ko", "knockdown",
    "airhit", "j_hk", "jifenglong", "jump", "roll", "shanguang", "st_hk",
    "xuanfeng", "zhongdan",
}


def id_height_exempt(fname):
    return fname.rsplit("_", 1)[0] in ID_HEIGHT_EXEMPT

# 目标 18 点 → DWPose COCO17 候选（nose→0；肩/肘/腕/髋/膝/踝 前后腿各对应一对 COCO 点）
TARGET_TO_COCO = {
    0: [0],
    2: [5, 6], 5: [5, 6],
    3: [7, 8], 6: [7, 8],
    4: [9, 10], 7: [9, 10],
    8: [11, 12], 11: [11, 12],
    9: [13, 14], 12: [13, 14],
    10: [15, 16], 13: [15, 16],
}
BODY_IDS = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]


# ---------------- DWPose ONNX 推理（参考 Fannovel16/comfyui_controlnet_aux dw_onnx） ----------------

def det_preprocess(img, input_size=(640, 640)):
    padded = np.ones((input_size[0], input_size[1], 3), dtype=np.uint8) * 114
    r = min(input_size[0] / img.shape[0], input_size[1] / img.shape[1])
    resized = cv2.resize(img, (int(img.shape[1] * r), int(img.shape[0] * r)),
                         interpolation=cv2.INTER_LINEAR).astype(np.uint8)
    padded[: int(img.shape[0] * r), : int(img.shape[1] * r)] = resized
    return np.ascontiguousarray(padded.transpose(2, 0, 1), dtype=np.float32), r


def det_demo_postprocess(outputs, img_size):
    strides = [8, 16, 32]
    grids, exp_strides = [], []
    for stride in strides:
        hs, ws = img_size[0] // stride, img_size[1] // stride
        xv, yv = np.meshgrid(np.arange(ws), np.arange(hs))
        grid = np.stack((xv, yv), 2).reshape(1, -1, 2)
        grids.append(grid)
        exp_strides.append(np.full((grid.shape[0], grid.shape[1], 1), stride))
    grids = np.concatenate(grids, 1)
    exp_strides = np.concatenate(exp_strides, 1)
    outputs[..., :2] = (outputs[..., :2] + grids) * exp_strides
    outputs[..., 2:4] = np.exp(outputs[..., 2:4]) * exp_strides
    return outputs


def det_nms(boxes, scores, nms_thr=0.45, score_thr=0.1):
    """单类 NMS（person=0），boxes 为 xyxy，返回 [x1,y1,x2,y2,score,cls]"""
    if len(boxes) == 0:
        return None
    valid = scores > score_thr
    if valid.sum() == 0:
        return None
    boxes, scores = boxes[valid], scores[valid]
    x1, y1, x2, y2 = boxes[:, 0], boxes[:, 1], boxes[:, 2], boxes[:, 3]
    areas = (x2 - x1 + 1) * (y2 - y1 + 1)
    order = scores.argsort()[::-1]
    keep = []
    while order.size > 0:
        i = order[0]
        keep.append(i)
        ovr = np.maximum(0.0, np.minimum(x2[i], x2[order[1:]]) - np.maximum(x1[i], x1[order[1:]]) + 1) * \
              np.maximum(0.0, np.minimum(y2[i], y2[order[1:]]) - np.maximum(y1[i], y1[order[1:]]) + 1)
        ovr = ovr / (areas[order[1:]] + areas[i] - ovr)
        inds = np.where(ovr <= nms_thr)[0]
        order = order[inds + 1]
    out = np.zeros((len(keep), 6))
    out[:, :4] = boxes[keep]
    out[:, 4] = scores[keep]
    out[:, 5] = 0
    return out


class DWPose:
    def __init__(self):
        import onnxruntime as ort
        avail = ort.get_available_providers()
        provs = [p for p in ("CUDAExecutionProvider", "CPUExecutionProvider") if p in avail]
        self.det = ort.InferenceSession(os.path.join(MODELS, "yolox_l.onnx"), providers=provs)
        self.pose_sess = ort.InferenceSession(os.path.join(MODELS, "dw-ll_ucoco_384.onnx"), providers=provs)
        self.provs = provs

    def detect(self, img_bgr, score_thr=0.3):
        """img_bgr: HxWx3 uint8 → boxes (N,4) xyxy 原图坐标，或 None"""
        inp, ratio = det_preprocess(img_bgr)
        out = self.det.run(None, {self.det.get_inputs()[0].name: inp[None]})[0]  # (1,8400,85)
        pred = det_demo_postprocess(out, (640, 640))[0]
        boxes = pred[:, :4]
        # 输出 85 列 = 4 bbox + objectness(4) + 80 类(5..)，取 person=类0
        scores = (pred[:, 4:5] * pred[:, 5:6]).ravel()
        xyxy = np.ones_like(boxes)
        xyxy[:, 0] = boxes[:, 0] - boxes[:, 2] / 2
        xyxy[:, 1] = boxes[:, 1] - boxes[:, 3] / 2
        xyxy[:, 2] = boxes[:, 0] + boxes[:, 2] / 2
        xyxy[:, 3] = boxes[:, 1] + boxes[:, 3] / 2
        xyxy /= ratio
        dets = det_nms(xyxy, scores, nms_thr=0.45, score_thr=0.1)
        if dets is None:
            return None
        dets = dets[dets[:, 4] > score_thr]
        return dets[:, :4] if len(dets) else None

    def estimate(self, img_bgr, boxes, model_input_size=(288, 384)):
        """boxes: (N,4) xyxy → keypoints (N,17,2), scores (N,17)（原图坐标）"""
        crops, centers, scales = [], [], []
        for (x0, y0, x1, y1) in boxes:
            bbox = np.array([x0, y0, x1, y1])
            center = np.array([(x0 + x1) / 2, (y0 + y1) / 2])
            scale = (np.array([x1 - x0, y1 - y0]) * 1.25)  # padding=1.25
            # fix aspect ratio 到 w/h
            w, h = model_input_size[0], model_input_size[1]
            ar = w / h
            if scale[0] > scale[1] * ar:
                scale = np.array([scale[0], scale[0] / ar])
            else:
                scale = np.array([scale[1] * ar, scale[1]])
            # affine（参考 cv_ox_pose.top_down_affine：src[1]=center+(0,-w/2)，dst 同理）
            src = np.zeros((3, 2), dtype=np.float32)
            src[0] = center
            src[1] = center + np.array([0., -scale[0] * 0.5])
            src[2] = src[1] + np.r_[-(src[0][1] - src[1][1]), (src[0][0] - src[1][0])]
            dst = np.zeros((3, 2), dtype=np.float32)
            dst[0] = [w * 0.5, h * 0.5]
            dst[1] = np.array([w * 0.5, h * 0.5]) + np.array([0., -w * 0.5])
            dst[2] = dst[1] + np.r_[-(dst[0][1] - dst[1][1]), (dst[0][0] - dst[1][0])]
            warp = cv2.getAffineTransform(src, dst)
            crop = cv2.warpAffine(img_bgr, warp, (int(w), int(h)), flags=cv2.INTER_LINEAR)
            crop = (crop - np.array([123.675, 116.28, 103.53])) / np.array([58.395, 57.12, 57.375])
            crops.append(crop)
            centers.append(center)
            scales.append(scale)
        inp = np.stack(crops, 0).transpose(0, 3, 1, 2).astype(np.float32)
        outs = self.pose_sess.run(None, {self.pose_sess.get_inputs()[0].name: inp})
        simcc_x, simcc_y = outs[0], outs[1]
        all_k, all_s = [], []
        for i in range(len(crops)):
            sx, sy = simcc_x[i][:17], simcc_y[i][:17]  # 前 17 = 身体 COCO 点（后面是手/脸）
            K, Wx = sx.shape
            sxr, syr = sx.reshape(K, -1), sy.reshape(K, -1)
            xl, yl = sxr.argmax(1), syr.argmax(1)
            vx, vy = sxr.max(1), syr.max(1)
            mask = vx > vy
            vx[mask] = vy[mask]
            vals = vx
            locs = np.stack((xl, yl), -1).astype(np.float32)
            locs[vals <= 0] = -1
            locs /= 2.0  # simcc_split_ratio=2
            kp = locs / np.array(model_input_size) * scales[i] + centers[i] - scales[i] / 2
            all_k.append(kp)
            all_s.append(vals)
        return np.array(all_k), np.array(all_s)


# ---------------- 四项检查 ----------------

def skel_mask(frgb, poseimg):
    """S 骨架线像素掩膜：control 骨架掩膜膨胀 2px 内，近白/近 18 色骨架色
    且比邻域亮 25 的像素。check_skel 与 fix-frames-qc 共用（单一事实源）。"""
    m = poseimg.max(axis=2) > 40
    m = binary_dilation(m, iterations=2)
    R, G, B = (frgb[:, :, i].astype(np.int16) for i in range(3))
    bright = (0.299 * R + 0.587 * G + 0.114 * B).astype(np.float32)
    local = median_filter(bright, size=11)
    nearwhite = frgb.min(axis=2) > 185
    nearskel = np.zeros(frgb.shape[:2], bool)
    for c in SKEL_COLORS:
        nearskel |= (np.abs(R - c[0]) + np.abs(G - c[1]) + np.abs(B - c[2]) < 90)
    return m & (bright > local + 25) & (nearwhite | nearskel)


def check_skel(frgb, poseimg):
    """S 骨架线残留：骨架线像素占掩膜面积的比例（判据见 skel_mask）"""
    m = poseimg.max(axis=2) > 40
    m = binary_dilation(m, iterations=2)
    cand = skel_mask(frgb, poseimg)
    return float(cand.sum()) / max(int(m.sum()), 1)


def green_mask(frgb, palette_greens):
    """K 绿边像素掩膜：alpha 边缘 4px 带内 可见(A>150) 且 G-max(R,B)>30
    且 V>150 且非立绘合法绿。check_green 与 fix-frames-qc 共用。"""
    A = frgb[:, :, 3].astype(np.int16)
    m = A > 0
    band = binary_dilation(m, iterations=4) & ~binary_erosion(m, iterations=4)
    cand = band & (A > 150)
    R, G, B = (frgb[:, :, i].astype(np.int16) for i in range(3))
    px = cand & ((G - np.maximum(R, B)) > 30) & (frgb.max(axis=2) > 150)
    if palette_greens is not None and len(palette_greens) > 0:
        ys, xs = np.nonzero(px)
        cols = frgb[ys, xs, :3].astype(np.int16)
        legit = np.zeros(len(cols), bool)
        for c in palette_greens:
            legit |= (np.abs(cols - c).sum(axis=1) < 70)
        keep = np.zeros_like(px)
        keep[ys[~legit], xs[~legit]] = True
        return keep
    return px


def check_green(frgb, palette_greens):
    """K 绿边：绿边像素占边缘带内可见像素 >2% → 失败。
    半透明边缘(A≤150)的绿色归 G 检查管，K 只抓肉眼可见的绿边。
    返回 (frac, n_halo_px)"""
    A = frgb[:, :, 3].astype(np.int16)
    m = A > 0
    band = binary_dilation(m, iterations=4) & ~binary_erosion(m, iterations=4)
    n_cand = int((band & (A > 150)).sum())
    px = green_mask(frgb, palette_greens)
    n_px = int(px.sum())
    if n_px == 0:
        return 0.0, 0
    return n_px / max(n_cand, 1), n_px


def ghost_ratio(frgb):
    """G 半透明残影：alpha 30–200 像素 / 人物面积(A>200)"""
    A = frgb[:, :, 3]
    opq = int((A > 200).sum())
    gh = int(((A >= 30) & (A <= 200)).sum())
    return gh / max(opq, 1)


def idle_like_ratio(frgb, idle_rgb):
    """I 像待机：该帧与 idle_00 的剪影 IoU（脚底对齐 + 质心 x 对齐后比较）。
    >0.88 表示非豁免动画帧姿势画成了待机（没跟上动作）。
    只比"姿势形状"：垂直按最低不透明行（脚底）对齐到画布底，水平按质心对齐，
    排除"站的位置/大小"差异，专抓"动作画错"。"""
    m1 = idle_rgb[:, :, 3] > 50
    m2 = frgb[:, :, 3] > 50
    H, _ = m1.shape
    if m1.sum() < 100 or m2.sum() < 100:
        return 0.0

    def shift_to_bottom(m):
        ys = np.where(m.any(axis=1))[0]
        if len(ys) == 0:
            return m
        dy = (H - 1) - int(ys.max())
        if dy == 0:
            return m
        out = np.zeros_like(m)
        if dy > 0:
            out[dy:, :] = m[:H - dy, :]
        else:
            out[:H + dy, :] = m[-dy:, :]
        return out

    m1a = shift_to_bottom(m1)
    m2a = shift_to_bottom(m2)

    def cx(m):
        _, xs = np.where(m)
        return float(xs.mean()) if len(xs) else 0.0
    dx = cx(m1a) - cx(m2a)
    if abs(dx) > 1:
        m2a = np.roll(m2a, int(round(dx)), axis=1)
    inter = int((m1a & m2a).sum())
    union = int((m1a | m2a).sum())
    return inter / max(union, 1)


def _assign_coco(kps, scores, target_kp):
    """每个目标点指派 COCO 点：score<0.3 记 None；双候选取距目标绝对坐标近的。
    返回 dict{目标点索引: ci|None}。"""
    out = {}
    for ti, cands in TARGET_TO_COCO.items():
        best, best_d = None, None
        for ci in cands:
            if scores[ci] < 0.3:
                continue
            d = np.hypot(kps[ci, 0] - target_kp[ti][0], kps[ci, 1] - target_kp[ti][1])
            if best is None or d < best_d:
                best, best_d = ci, d
        out[ti] = best
    return out


def _procrustes(src, dst):
    """相似变换（平移+等比缩放，不旋转）：src' = s*src + t 最小二乘拟合 dst。
    返回 (s, t)；src/dst: (N,2)。"""
    sm, dm = src.mean(0), dst.mean(0)
    A, B = src - sm, dst - dm
    den = float((A * A).sum())
    s = float((A * B).sum()) / den if den > 1e-9 else 1.0
    t = dm - s * sm
    return s, t


def check_pose(dwp, img_bgr, target_kp):
    """P 动作跟随：DWPose 推帧上人体，与目标骨架比"姿势形状"。
    判定 = Procrustes 相似对齐（去尺度/平移）后 PCK@0.1（容差=目标身高 10%）。
    为什么对齐：生成+cleanup 管线会把人物系统性放大到 ~895px（目标骨架 ~666px），
    绝对坐标 PCK 恒 0；QC 要抓的是"动作做错"，不是"人物站的位置/大小"。
    姿势真错了（如目标出拳帧画成站立），对齐后四肢点 PCK 仍会掉 → 正确判失败。
    target_kp: 18 点 [x,y,conf]（1024 坐标）
    检测策略：先 YOLOX；检测不到人时用目标骨架 bbox×1.3 兜底。"""
    boxes = dwp.detect(img_bgr)
    note = "ok"
    if boxes is None:
        xs = [target_kp[i][0] for i in BODY_IDS]
        ys = [target_kp[i][1] for i in BODY_IDS]
        x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
        pad = 0.3 * max(x1 - x0, y1 - y0, 1)
        h, w = img_bgr.shape[:2]
        boxes = np.array([[max(x0 - pad, 0), max(y0 - pad, 0),
                           min(x1 + pad, w), min(y1 + pad, h)]], dtype=np.float64)
        note = "bbox_fallback"
    box = boxes[np.argmax((boxes[:, 2] - boxes[:, 0]) * (boxes[:, 3] - boxes[:, 1]))]
    kps, scores = dwp.estimate(img_bgr, [box])
    kps, scores = kps[0], scores[0]
    ys = [target_kp[i][1] for i in BODY_IDS]
    H = max(ys) - min(ys)
    if H < 50:
        return 0.0, "target_too_small"
    ci_map = _assign_coco(kps, scores, target_kp)
    # 对齐用点对（score≥0.3 的），<5 对说明检测不可信 → 豁免（返回 None）
    pairs = [(ti, ci) for ti, ci in ci_map.items() if ci is not None]
    if len(pairs) < 5:
        return None, note + ":few_kp"
    src = np.array([kps[ci] for _, ci in pairs], dtype=np.float64)
    dst = np.array([np.asarray(target_kp[ti], dtype=np.float64)[:2] for ti, _ in pairs])
    s, t = _procrustes(src, dst)
    tol = 0.1 * H
    n_ok = sum(float(np.hypot(*(s * e + t - d))) <= tol for e, d in zip(src, dst))
    # PCK = 检测到的点里对齐正确的比例。⚠️ 坑：分母不能用 18（全部目标点）——
    # 遮挡点（手臂被身体挡住等）永远拉低 PCK，p50 会被压到 0.46 造成 94% 假失败。
    return n_ok / len(pairs), note


def load_palette_greens(cid):
    """从立绘抠图提取该角色本有的绿色（用于排除 c07 绿围裙等合法绿）"""
    p = os.path.join(ART, "portrait-cutout", f"{cid}.cutout.png")
    if not os.path.exists(p):
        return []
    im = np.array(Image.open(p).convert("RGBA"))[::4, ::4]
    m = im[:, :, 3] > 128
    R, G, B = (im[:, :, i].astype(np.int16) for i in range(3))
    gm = m & (G - np.maximum(R, B) > 30)
    cols = im[gm][:, :3]
    if len(cols) < 20:
        return []
    q = (cols // 16).astype(np.int32)
    keys, counts = np.unique(q, axis=0, return_counts=True)
    out = []
    for i in np.argsort(-counts):
        if counts[i] < 10:
            break
        out.append(keys[i] * 16 + 8)
        if len(out) >= 24:
            break
    return np.array(out, dtype=np.int16)


# ---------------- ID 身份 / T 整体半透明（19:20 增补） ----------------

_LAB_LUT = None


def _lab_lut():
    """32^3 量化 RGB → LAB 12^3 bin 索引 查找表（128KB，一次构建全局复用）。
    RGB 按 //8 取 bin 中心做 sRGB→LAB 近似转换，L 取 0–100 线性分 12 bin，
    a/b 取 [-128,128] 分 12 bin（bin 宽 ~21，远大于感知噪声）。"""
    global _LAB_LUT
    if _LAB_LUT is not None:
        return _LAB_LUT
    r = (np.arange(32)[:, None, None] * 8 + 4) / 255
    g = (np.arange(32)[None, :, None] * 8 + 4) / 255
    b = (np.arange(32)[None, None, :] * 8 + 4) / 255

    def f(c):
        return np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)

    r, g, b = f(r), f(g), f(b)
    x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047
    y = r * 0.2126 + g * 0.7152 + b * 0.0722
    z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883

    def g2(c):
        return np.where(c > 0.008856, np.cbrt(c), 7.787 * c + 16 / 116)

    X, Y, Z = g2(x), g2(y), g2(z)
    L = 116 * Y - 16          # 0–100
    A = 500 * (X - Y) + 128   # 平移到 0–256
    B = 200 * (Y - Z) + 128
    Lb = np.clip(L / 100 * 12, 0, 11).astype(np.int32)
    Ab = np.clip(A / 256 * 12, 0, 11).astype(np.int32)
    Bb = np.clip(B / 256 * 12, 0, 11).astype(np.int32)
    _LAB_LUT = (Lb * 12 + Ab) * 12 + Bb
    return _LAB_LUT


def lab_maincolor_hist(fimg, m, K=32, minw=0.002):
    """LAB 12^3 主色直方图：可见像素(m) → LAB bin 计数，去 <minw 噪声 bin，
    取 top-K bin 重归一化。立绘与帧用同一函数，距离 D = 1 - Σmin(h1,h2)。"""
    lut = _lab_lut()
    q = (fimg[m][:, :3] // 8).clip(0, 31).astype(np.intp)
    idx = lut[q[:, 0], q[:, 1], q[:, 2]]
    h = np.bincount(idx, minlength=12 ** 3).astype(np.float64)
    t = h.sum()
    if t < 100:
        return None
    h[h / t < minw] = 0
    keep = np.argsort(-h)[:K]
    h2 = np.zeros_like(h)
    h2[keep] = h[keep]
    s = h2.sum()
    return h2 / s if s > 0 else h2


def id_color_dist(frame_hist, cutout_hist):
    """主色直方图距离 D = 1 - Σmin。返回 0–1，None 表示无法计算。"""
    if frame_hist is None or cutout_hist is None:
        return None
    return float(1 - np.minimum(frame_hist, cutout_hist).sum())


def bbox_height(img):
    """人物 bbox 高（A>100 的最上/最下行差），无有效像素返回 0。"""
    ys = np.where((img[:, :, 3] > 100).any(axis=1))[0]
    return int(ys.max() - ys.min() + 1) if len(ys) else 0


def id_height_ratio(fimg, idle_img):
    """帧人物高 / idle_00 人物高。idle 无效或帧无像素返回 None。"""
    hi = bbox_height(idle_img)
    if hi < 50:
        return None
    hf = bbox_height(fimg)
    if hf < 50:
        return None
    return hf / hi


def trans_ratio(fimg):
    """T 整体半透明：alpha 30–200 像素 / 人物面积(A>30)。面积太小返回 None。"""
    A = fimg[:, :, 3]
    area = int((A > 30).sum())
    if area < 100:
        return None
    return float(((A > 30) & (A <= 200)).sum()) / area


# ---------------- 蒙太奇 ----------------

def make_montage(cid, cells, font):
    """cells: [(fname, rgba, fails_str)] 按序排成 16 列网格，失败帧红框+标字"""
    cell_n, cols = 128, 16
    rows = (len(cells) + cols - 1) // cols
    canvas = Image.new("RGB", (cols * cell_n, rows * cell_n), (24, 24, 28))
    dr = ImageDraw.Draw(canvas)
    for k, (fname, arr, fails) in enumerate(cells):
        r, c = divmod(k, cols)
        small = Image.fromarray(arr).resize((cell_n, cell_n), Image.Resampling.LANCZOS)
        tmp = Image.new("RGBA", (cell_n, cell_n), (24, 24, 28, 255))
        tmp.alpha_composite(small)
        canvas.paste(tmp.convert("RGB"), (c * cell_n, r * cell_n))
        if fails:
            x0, y0 = c * cell_n, r * cell_n
            dr.rectangle([x0 + 1, y0 + 1, x0 + cell_n - 2, y0 + cell_n - 2], outline=(255, 40, 40), width=3)
            dr.text((x0 + 5, y0 + 4), fails, fill=(255, 70, 70), font=font)
    out = os.path.join(CHK, f"frame-qc-montage-{cid}.png")
    canvas.save(out)
    return out


# ---------------- 主流程 ----------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--chars", nargs="*", default=[f"c0{i}" for i in range(1, 9)])
    ap.add_argument("--no-pose", action="store_true", help="跳过 DWPose 动作跟随检查")
    ap.add_argument("--limit", type=int, default=0, help="每角色只查前 N 帧（调试）")
    ap.add_argument("--only", default="", help="只查文件名包含该子串的帧（调试）")
    ap.add_argument("--src", default="", help="帧目录根（默认 art-work/frames；"
                                               "如 art-work/fixed 则查 art-work/fixed/<cid>/）")
    ap.add_argument("--poses", default="poses", help="poses JSON 子目录（默认 poses；v3 帧用 poses-v3，帧清单/目标骨架以该目录为准）")
    args = ap.parse_args()
    os.makedirs(CHK, exist_ok=True)

    t0 = time.time()
    dwp = None
    if not args.no_pose:
        dwp = DWPose()
        print(f"DWPose 就绪: {dwp.provs}", flush=True)

    report = {"ts": time.strftime("%Y-%m-%d %H:%M:%S"), "thresholds": TH, "characters": {}}
    for cid in args.chars:
        t1 = time.time()
        poses = json.load(open(os.path.join(ART, args.poses, f"{cid}.json")))
        fdir = os.path.join(args.src, cid) if args.src else os.path.join(ART, "frames", cid)
        pdir = os.path.join(ART, "pose-img", cid)
        palette = load_palette_greens(cid)
        print(f"\n=== {cid} 立绘绿配色 {len(palette)} 组 ===", flush=True)

        # ID 身份：立绘主色直方图（每角色加载一次）
        cut_fp = os.path.join(ART, "portrait-cutout", f"{cid}.cutout.png")
        cut_hist = None
        if os.path.exists(cut_fp):
            cut_img = np.array(Image.open(cut_fp).convert("RGBA"))
            cut_hist = lab_maincolor_hist(cut_img, cut_img[:, :, 3] > 128)

        # 帧清单：以 poses JSON 为准（含目标骨架），再补目录里多出的帧
        frames = []  # (fname, target_kp or None)
        seen = set()
        for name, anim in poses["anims"].items():
            for i, fr in enumerate(anim["frames"]):
                fname = f"{name.replace('.', '_')}_{i:02d}.png"
                if fname in seen:
                    continue
                seen.add(fname)
                frames.append((fname, fr["keypoints"]))
        for fname in sorted(os.listdir(fdir)):
            if fname.endswith(".png") and fname not in seen:
                frames.append((fname, None))
        if args.limit:
            frames = frames[:args.limit]
        if args.only:
            frames = [f for f in frames if args.only in f[0]]

        base = None  # idle_00 的 ghost 基线
        idle_fp = os.path.join(fdir, "idle_00.png")
        idle_img = np.array(Image.open(idle_fp).convert("RGBA")) if os.path.exists(idle_fp) else None
        results = {}
        cells = []
        for fname, target in frames:
            fp = os.path.join(fdir, fname)
            fimg = np.array(Image.open(fp).convert("RGBA"))
            rec = {}

            if target is not None:
                pp = os.path.join(pdir, fname)
                poseimg = np.array(Image.open(pp).convert("RGB")) if os.path.exists(pp) else None
            else:
                poseimg = None

            # S
            if poseimg is not None:
                rec["skel"] = round(check_skel(fimg, poseimg), 5)
            # K
            gfrac, gn = check_green(fimg, palette)
            rec["green"] = round(gfrac, 5)
            rec["green_px"] = gn
            # G
            gr = ghost_ratio(fimg)
            rec["ghost"] = round(gr, 5)
            if fname == "idle_00.png":
                base = gr
            # ID 身份：主色直方图距离 + 高度比（蹲/倒地/腾空类豁免）
            m_vis = fimg[:, :, 3] > 150
            d = id_color_dist(lab_maincolor_hist(fimg, m_vis) if m_vis.sum() >= 100 else None,
                              cut_hist)
            rec["id_color"] = round(d, 4) if d is not None else None
            if idle_img is not None and fname != "idle_00.png" and not id_height_exempt(fname):
                hr = id_height_ratio(fimg, idle_img)
                rec["id_height"] = round(hr, 4) if hr is not None else None
            # T 整体半透明
            tr = trans_ratio(fimg)
            rec["trans"] = round(tr, 4) if tr is not None else None
            # I 像待机
            if (idle_img is not None and fname != "idle_00.png"
                    and not anim_exempt(fname)):
                rec["idle_iou"] = round(idle_like_ratio(fimg, idle_img), 4)
            # P（先收集，稍后批量不必要——逐帧跑，GPU 上够快）
            if not args.no_pose and target is not None:
                # 白底合成。⚠️ 坑：2D 帧 (H,W) * 3D alpha (H,W,1) 会广播爆炸成
                # (H,W,H,W) = 4GB 中间数组（实测 10s+/帧）。必须先堆成 (H,W,3) 再乘。
                alpha = fimg[:, :, 3:4].astype(np.float32) / 255
                rgb = fimg[:, :, :3].astype(np.float32)
                bgr = cv2.cvtColor((rgb * alpha + 255 * (1 - alpha)).astype(np.uint8),
                                   cv2.COLOR_RGB2BGR)
                pck, why = check_pose(dwp, bgr, target)
                rec["pck"] = round(pck, 4) if pck is not None else None
                if why != "ok":
                    rec["pck_note"] = why

            # 判定
            fails = []
            if "skel" in rec and rec["skel"] > TH["skel_frac"]:
                fails.append("S")
            if rec["green"] > TH["green_frac"]:
                fails.append("K")
            if base is not None and rec["ghost"] > base + TH["ghost_delta"]:
                fails.append("G")
            elif base is None and rec["ghost"] > TH["ghost_delta"]:
                fails.append("G")
            if "idle_iou" in rec and rec["idle_iou"] > TH["idle_iou"]:
                fails.append("I")
            # P 只作参考不计 fail（2026-11-03 判定）：DWPose 对动态姿势/特效帧误报率高
            # （抽视检证实 PCK≈0 帧多数姿势正确，检测/分配崩），PCK p50≈0.46 为管线常态。
            # 低 PCK 帧走抽视检（p-debug-overlay.py），真缺陷才修。
            pck = rec.get("pck")
            if pck is not None and pck < TH["pck"]:
                rec["pck_low"] = True
            rec["fails"] = fails
            results[fname] = rec
            cells.append((fname, fimg, "".join(fails)))

        # 第二遍判定（G 需要 idle_00 基线；ID 颜色需要角色级中位数定标）
        ds = [r["id_color"] for r in results.values() if r.get("id_color") is not None]
        id_med = float(np.median(ds)) if ds else None
        # 帧数太少（--only/--limit 调试）时中位数不可信 → 只用绝对下限
        id_thr = (max(TH["id_color_abs"], TH["id_color_rel"] * id_med)
                  if id_med is not None and len(ds) >= 30 else TH["id_color_abs"])
        for fname, rec in results.items():
            fails = [f for f in rec["fails"] if f not in ("G", "ID", "T")]
            if base is not None and rec["ghost"] > base + TH["ghost_delta"]:
                fails.append("G")
            elif base is None and rec["ghost"] > TH["ghost_delta"]:
                fails.append("G")
            if "idle_iou" in rec and rec["idle_iou"] > TH["idle_iou"]:
                fails.append("I")
            # ID 身份
            d = rec.get("id_color")
            if d is not None:
                rec["id_color_fail"] = d > id_thr
                if rec["id_color_fail"]:
                    fails.append("ID")
            hr = rec.get("id_height")
            if hr is not None:
                rec["id_height_fail"] = not (TH["id_height_min"] <= hr <= TH["id_height_max"])
                if rec["id_height_fail"]:
                    fails.append("ID")
            # T 整体半透明
            tr = rec.get("trans")
            if tr is not None:
                rec["trans_fail"] = tr > TH["trans_frac"]
                if rec["trans_fail"]:
                    fails.append("T")
            pck = rec.get("pck")
            if pck is not None and pck < TH["pck"]:
                rec["pck_low"] = True
            order = {"S": 0, "K": 1, "G": 2, "I": 3, "ID": 4, "T": 5}
            rec["fails"] = sorted(set(fails), key=lambda x: order[x])
            for k, (_, _, fs) in enumerate(cells):
                if cells[k][0] == fname:
                    cells[k] = (fname, cells[k][1], "".join(rec["fails"]))

        n_fail = sum(1 for r in results.values() if r["fails"])
        report["characters"][cid] = {
            "n_frames": len(results),
            "n_fail": n_fail,
            "ghost_base": round(base, 5) if base is not None else None,
            "id_color_median": round(id_med, 4) if id_med is not None else None,
            "id_color_thr": round(id_thr, 4),
            "fail_frames": [f for f, r in sorted(results.items()) if r["fails"]],
            "frames": results,
        }
        montage = make_montage(cid, cells, ImageFont.load_default(size=16))
        print(f"{cid}: {len(results)} 帧, 失败 {n_fail} → {report['characters'][cid]['fail_frames']}", flush=True)
        print(f"  蒙太奇: {montage}  用时 {time.time() - t1:.0f}s", flush=True)

    # ⚠️ 坑：部分运行（--only/--limit）写单独文件，绝不覆盖全量报告；
    # --src 运行时报告名加 -<src basename> 后缀，也不覆盖默认目录的全量报告
    partial = bool(args.only or args.limit)
    src_tag = ("-" + os.path.basename(os.path.normpath(args.src))) if args.src else ""
    rp = os.path.join(CHK, "frame-qc-report" + src_tag
                      + ("-partial.json" if partial else ".json"))
    if partial and not src_tag and os.path.exists(os.path.join(CHK, "frame-qc-report.json")):
        print("（部分运行：报告写 -partial，全量报告未动）", flush=True)
    with open(rp, "w") as f:
        json.dump(report, f, ensure_ascii=False, indent=1)
    tot = sum(c["n_frames"] for c in report["characters"].values())
    totf = sum(c["n_fail"] for c in report["characters"].values())
    print(f"\n完成：{tot} 帧, 失败 {totf} → {rp}  总用时 {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
