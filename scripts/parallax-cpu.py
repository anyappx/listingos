#!/usr/bin/env python3
"""
CPU-only 2.5D parallax from a single photo using Depth Anything V2 ONNX.
No GPU required. ~600ms per 4-second 1080p clip.

Usage:
  python3 parallax-cpu.py <image_path> <output_path> [motion] [intensity] [duration] [reverse]

Motion presets: dolly | horizontal | zoom | orbital | circle | vertical
Intensity: float, 0.3 (subtle) to 2.0 (dramatic). Default 1.0
"""
import sys
import os
import subprocess
import cv2
import numpy as np

MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "depth_anything_v2_vits.onnx")

# Use ffmpeg-static from node_modules if system ffmpeg not available
_script_dir = os.path.dirname(os.path.abspath(__file__))
_ffmpeg_static = os.path.join(_script_dir, "..", "node_modules", "ffmpeg-static", "ffmpeg")
FFMPEG_BIN = _ffmpeg_static if os.path.isfile(_ffmpeg_static) else "ffmpeg"


def load_depth_session():
    import onnxruntime as ort
    return ort.InferenceSession(MODEL_PATH, providers=["CPUExecutionProvider"])


def estimate_depth(session, image: np.ndarray) -> np.ndarray:
    """Run Depth Anything V2 Small. ~100ms on CPU."""
    h, w = image.shape[:2]
    inp = cv2.resize(image, (518, 518)).astype(np.float32) / 255.0
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std  = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    inp = (inp - mean) / std
    inp = np.transpose(inp, (2, 0, 1))[np.newaxis]
    input_name = session.get_inputs()[0].name
    depth = session.run(None, {input_name: inp})[0][0]
    depth = cv2.resize(depth, (w, h))
    dmin, dmax = depth.min(), depth.max()
    if dmax > dmin:
        depth = (depth - dmin) / (dmax - dmin)
    return depth.astype(np.float32)


def ease_inout(t: float) -> float:
    """Smooth ease-in-out curve: eliminates jerky start/stop."""
    return t * t * (3.0 - 2.0 * t)


def render_parallax(
    image: np.ndarray,
    depth: np.ndarray,
    motion: str = "dolly",
    intensity: float = 1.0,
    duration: float = 4.0,
    fps: int = 30,
    width: int = 1920,
    height: int = 1080,
    output_path: str = "clip.mp4",
    reverse: bool = False,
):
    """Render 2.5D parallax video via depth-based pixel displacement."""
    # Resize source to target dimensions
    image = cv2.resize(image, (width, height))
    depth = cv2.resize(depth, (width, height))

    total_frames = int(duration * fps)

    # FIX H: Overscan — render at 110% to hide edge artifacts during displacement
    os_w = int(width * 1.1)
    os_h = int(height * 1.1)
    render_image = cv2.resize(image, (os_w, os_h))
    render_depth = cv2.resize(depth, (os_w, os_h))

    # Precompute base coordinate grids in overscan space
    xs = np.arange(os_w, dtype=np.float32)
    ys = np.arange(os_h, dtype=np.float32)
    x_grid, y_grid = np.meshgrid(xs, ys)

    # Foreground depth weight: closer objects move more
    fg_weight = (1.0 - render_depth)

    # FIX H: VideoWriter at target dimensions (frames are cropped before writing)
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    cx_off = (os_w - width) // 2
    cy_off = (os_h - height) // 2

    for frame_idx in range(total_frames):
        raw_t = frame_idx / max(total_frames - 1, 1)
        t = ease_inout(raw_t)
        if reverse:
            t = 1.0 - t

        # --- Camera path per motion preset (use target w/h for consistent magnitudes) ---
        if motion == "dolly":
            scale = 1.0 + t * intensity * 0.12
            dx = dy = 0.0

        elif motion == "horizontal":
            dx = (t - 0.5) * intensity * width * 0.08
            dy = 0.0
            scale = 1.0

        elif motion == "vertical":
            dx = 0.0
            dy = (t - 0.5) * intensity * height * 0.06
            scale = 1.0

        elif motion == "zoom":
            scale = 1.0 + t * intensity * 0.18
            dx = dy = 0.0

        elif motion == "orbital":
            dx = np.sin(t * np.pi) * intensity * width * 0.05
            dy = np.cos(t * np.pi * 0.5) * intensity * height * 0.02
            scale = 1.0 + t * 0.02

        elif motion == "circle":
            angle = t * np.pi * 0.6
            dx = np.sin(angle) * intensity * width * 0.04
            dy = (1.0 - np.cos(angle)) * intensity * height * 0.03
            scale = 1.0

        else:  # fallback = dolly
            scale = 1.0 + t * intensity * 0.10
            dx = dy = 0.0

        # --- Depth-based parallax displacement (in overscan space) ---
        parallax_strength = intensity * 0.06
        src_x = x_grid - fg_weight * dx * parallax_strength * 8
        src_y = y_grid - fg_weight * dy * parallax_strength * 8

        # --- Scale/zoom around render center ---
        if scale != 1.0:
            cx, cy = os_w / 2.0, os_h / 2.0
            src_x = cx + (src_x - cx) / scale
            src_y = cy + (src_y - cy) / scale

        # --- Translate whole frame ---
        src_x = src_x + dx * 0.3
        src_y = src_y + dy * 0.3

        src_x = np.clip(src_x, 0, os_w - 1).astype(np.float32)
        src_y = np.clip(src_y, 0, os_h - 1).astype(np.float32)

        # FIX G: BORDER_REFLECT_101 mirrors edge pixels — eliminates smearing
        frame = cv2.remap(
            render_image, src_x, src_y,
            cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_REFLECT_101,
        )

        # FIX H: Crop overscan frame back to target dimensions
        frame = frame[cy_off:cy_off + height, cx_off:cx_off + width]

        # FIX I: Depth-of-field — blur background proportional to inverse depth
        depth_crop = render_depth[cy_off:cy_off + height, cx_off:cx_off + width]
        for sigma in [1, 2, 4]:
            blurred = cv2.GaussianBlur(frame, (0, 0), sigma)
            mask = ((1.0 - depth_crop) > sigma * 0.25).astype(np.float32)[..., np.newaxis]
            frame = (frame * (1 - mask) + blurred * mask).astype(np.uint8)

        writer.write(frame)

    writer.release()

    # FIX J: Re-encode mp4v → H.264 in a single pass (pipeline.js skips its own re-encode)
    raw = output_path + ".raw.mp4"
    os.rename(output_path, raw)
    subprocess.run(
        [FFMPEG_BIN, "-y", "-i", raw,
         "-c:v", "libx264", "-preset", "fast", "-crf", "18",
         "-pix_fmt", "yuv420p", "-an", output_path],
        check=True, capture_output=True,
    )
    os.remove(raw)


MODEL_URL = "https://github.com/fabio-sim/Depth-Anything-ONNX/releases/download/v2.0.0/depth_anything_v2_vits.onnx"


def ensure_model():
    if os.path.exists(MODEL_PATH):
        return
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    print(f"[parallax] Downloading depth model (~25MB)...", flush=True)
    import urllib.request
    urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
    print(f"[parallax] Model ready at {MODEL_PATH}", flush=True)


def main():
    if len(sys.argv) < 3:
        print("Usage: parallax-cpu.py <image> <output> [motion] [intensity] [duration] [reverse]")
        sys.exit(1)

    ensure_model()

    image_path  = sys.argv[1]
    output_path = sys.argv[2]
    motion      = sys.argv[3] if len(sys.argv) > 3 else "dolly"
    intensity   = float(sys.argv[4]) if len(sys.argv) > 4 else 1.0
    duration    = float(sys.argv[5]) if len(sys.argv) > 5 else 4.0
    reverse     = (sys.argv[6].lower() == "true") if len(sys.argv) > 6 else False

    image = cv2.imread(image_path)
    if image is None:
        print(f"ERROR: cannot read image: {image_path}", file=sys.stderr)
        sys.exit(1)

    print(f"[parallax] {os.path.basename(image_path)} → {motion} i={intensity} {duration}s", flush=True)

    session = load_depth_session()
    depth   = estimate_depth(session, image)
    render_parallax(
        image, depth,
        motion=motion,
        intensity=intensity,
        duration=duration,
        reverse=reverse,
        output_path=output_path,
    )

    print(f"[parallax] done → {output_path}", flush=True)


if __name__ == "__main__":
    main()
