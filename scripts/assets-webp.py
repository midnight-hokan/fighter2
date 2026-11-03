#!/usr/bin/env python3
"""给大图生成 WebP 副本（游戏运行时优先加载 .webp，失败再回退 .png）。
零点出口带宽小，PNG 原图全站约 90MB，换成 WebP 后约十分之一。
用法：python3 scripts/assets-webp.py [--check]   （--check：只检查是否有过期/缺失的 webp，有则退出码 1）
规则：按 PNG 内容哈希判断（记在 public/assets/webp-manifest.json），PNG 变了或 webp 不存在就重新生成（git 检出不保留时间戳，所以不用 mtime）。生产 PNG 的流水线不用改，发布前跑一下即可（deploy.sh 已自动调用）。
"""
import sys, os, glob, json, hashlib
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets')
# (glob, 质量)：图集保留较高质量；立绘带透明；场景图不透明
RULES = [
    ('*/c0*/atlas.png', 80),
    ('*/portraits/*/*.png', 85),
    ('*/scenes/*.png', 80),
    ('*/stages/*/*.png', 85),
    ('*/projectiles/*.png', 90),
]

MAN = os.path.join(ROOT, 'webp-manifest.json')

def sha(p):
    return hashlib.sha1(open(p, 'rb').read()).hexdigest()

def load_man():
    try: return json.load(open(MAN))
    except Exception: return {}

def todo(man):
    out = []
    for pat, q in RULES:
        for p in sorted(glob.glob(os.path.join(ROOT, pat))):
            w = p[:-4] + '.webp'
            key = os.path.relpath(p, ROOT)
            h = sha(p)
            if not os.path.exists(w) or man.get(key) != h:
                out.append((p, w, q, key, h))
    return out

def main():
    man = load_man()
    jobs = todo(man)
    if '--check' in sys.argv:
        for p, w, *_ in jobs: print('缺少或过期：', os.path.relpath(w, ROOT))
        sys.exit(1 if jobs else 0)
    if '--stamp' in sys.argv:   # 只记录现有 webp 对应的 PNG 哈希（首次建清单用）
        for p, w, q, key, h in jobs:
            if os.path.exists(w): man[key] = h
        json.dump(man, open(MAN, 'w'), indent=0, sort_keys=True); print('已记录', len(man)); return
    before = after = 0
    for p, w, q, key, h in jobs:
        im = Image.open(p)
        im = im.convert('RGBA') if im.mode in ('RGBA', 'LA', 'P') else im.convert('RGB')
        im.save(w, 'WEBP', quality=q, method=6)
        before += os.path.getsize(p); after += os.path.getsize(w)
        man[key] = h
    json.dump(man, open(MAN, 'w'), indent=0, sort_keys=True)
    if jobs: print(f'生成 {len(jobs)} 个 webp：{before/1e6:.1f}MB → {after/1e6:.1f}MB')
    else: print('webp 都是最新的')

if __name__ == '__main__':
    main()
