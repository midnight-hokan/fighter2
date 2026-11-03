#!/usr/bin/env bash
# frame-qc 运行包装：latentsync-env 的 onnxruntime 1.21 CUDA EP 需要 cuDNN 9 / CUDA 12，
# 这些 so 已随 pip 包在 latentsync-env 的 site-packages/nvidia/*/lib 里。
# ⚠️ LD_LIBRARY_PATH 必须在 python 进程启动前 export（ld.so 只在进程启动时读一次，
# python 运行时改 os.environ 对 dlopen 无效）。
# ⚠️ 只用 CUDA 12 系目录（cudnn/cublas/cuda_runtime/cuda_nvrtc）；
#    若环境里混有 CUDA 13 库（如 whisper-env 的 cu13、系统 /usr/local/cuda-13.1）
#    会让 ort 1.21 的 CUDA EP 加载失败，回退 CPU（每帧 20s+ vs GPU 0.2s）。
set -euo pipefail
NV="$(/home/yuguang/latentsync-env/bin/python -c 'import sysconfig; print(sysconfig.get_paths()["purelib"])')/nvidia"
LDP=""
for d in cudnn cublas cuda_runtime cuda_nvrtc; do
  [ -d "$NV/$d/lib" ] && LDP="${LDP}${NV}/${d}/lib:"
done
export LD_LIBRARY_PATH="${LDP}${LD_LIBRARY_PATH:-}"
exec /home/yuguang/latentsync-env/bin/python scripts/art/frame-qc.py "$@"
