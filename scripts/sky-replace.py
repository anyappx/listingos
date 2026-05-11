#!/usr/bin/env python3
"""
LOS-036: sky-replace.py
Replace sky in real estate photos using color-based mask detection.
Usage: python3 scripts/sky-replace.py <image_path> <output_path> <sky_name>
Available sky names: clear_blue, sunset, dramatic, twilight, dawn, stormy, golden, overcast, dusk_purple, starry
"""

import cv2
import numpy as np
import sys
import os
import shutil
import subprocess


# ---------------------------------------------------------------------------
# Sky gradient definitions — each entry is (top_color_BGR, bottom_color_BGR)
# ---------------------------------------------------------------------------
SKY_GRADIENTS = {
    "clear_blue":  ((235, 206, 135), (255, 230, 200)),   # sky blue top → light blue bottom
    "sunset":      ((45,  80,  255), (100, 160, 255)),   # deep orange-red top → soft orange bottom
    "dramatic":    ((20,  10,  10),  (60,  40,  80)),    # near-black top → dark indigo bottom
    "twilight":    ((80,  30,  60),  (140, 80,  160)),   # deep purple top → soft violet bottom
    "dawn":        ((100, 150, 255), (180, 220, 255)),   # warm pink-peach top → soft gold bottom
    "stormy":      ((60,  55,  50),  (100, 95,  90)),    # dark charcoal top → mid-gray bottom
    "golden":      ((30,  100, 220), (80,  180, 255)),   # deep amber top → gold bottom
    "overcast":    ((160, 155, 150), (200, 198, 195)),   # cool gray top → light gray bottom
    "dusk_purple": ((60,  20,  80),  (140, 60,  180)),   # deep violet top → lavender bottom
    "starry":      ((10,   5,   5),  (30,  15,  40)),    # near-black top → deep midnight blue
}

DEFAULT_SKY = "clear_blue"


def build_sky_gradient(sky_name: str, height: int, width: int) -> np.ndarray:
    """
    Build a full-image numpy gradient (BGR uint8) for the given sky name.
    The gradient runs top-to-bottom across the full image height so it blends
    naturally into the foreground via the alpha mask.
    """
    if sky_name not in SKY_GRADIENTS:
        print(f"[sky-replace] Unknown sky '{sky_name}', falling back to '{DEFAULT_SKY}'")
        sky_name = DEFAULT_SKY

    top_bgr, bot_bgr = SKY_GRADIENTS[sky_name]

    # Build per-channel gradient
    gradient = np.zeros((height, width, 3), dtype=np.float32)
    for ch in range(3):
        col_top = float(top_bgr[ch])
        col_bot = float(bot_bgr[ch])
        column = np.linspace(col_top, col_bot, height, dtype=np.float32)
        gradient[:, :, ch] = np.tile(column.reshape(-1, 1), (1, width))

    return np.clip(gradient, 0, 255).astype(np.uint8)


def detect_sky_mask(image_bgr: np.ndarray) -> np.ndarray:
    """
    Return a float32 mask [0..1] where 1 = sky pixel.
    Strategy:
      - Only consider the top 40% of the image.
      - Convert to HSV; sky pixels have saturation < 30 and value > 150.
      - Gaussian-blur edges (kernel 21) for smooth compositing.
    """
    h, w = image_bgr.shape[:2]
    top_region_h = int(h * 0.40)

    # Build binary mask — start fully zero
    raw_mask = np.zeros((h, w), dtype=np.uint8)

    # Work only on the top 40%
    roi = image_bgr[:top_region_h, :]
    hsv_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)

    # Sky: low saturation, high value
    saturation = hsv_roi[:, :, 1].astype(np.float32)
    value = hsv_roi[:, :, 2].astype(np.float32)

    sky_pixels = (saturation < 30) & (value > 150)
    raw_mask[:top_region_h, :] = (sky_pixels * 255).astype(np.uint8)

    # Gaussian blur to soften edges
    blurred = cv2.GaussianBlur(raw_mask, (21, 21), 0)

    # Normalise to [0, 1] float
    mask_float = blurred.astype(np.float32) / 255.0
    return mask_float


def composite(original: np.ndarray, sky: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """
    Alpha-blend original and sky using the mask.
    mask == 1  → pure sky
    mask == 0  → pure original (foreground)
    """
    alpha = mask[:, :, np.newaxis]          # (H, W, 1)
    orig_f = original.astype(np.float32)
    sky_f  = sky.astype(np.float32)
    blended = orig_f * (1.0 - alpha) + sky_f * alpha
    return np.clip(blended, 0, 255).astype(np.uint8)


def replace_sky(image_path: str, output_path: str, sky_name: str) -> None:
    print(f"[sky-replace] Loading image: {image_path}")
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"Cannot read image: {image_path}")

    h, w = image.shape[:2]
    print(f"[sky-replace] Image size: {w}x{h}")

    print(f"[sky-replace] Detecting sky mask (color-based HSV heuristic)...")
    mask = detect_sky_mask(image)

    sky_coverage = float(mask.sum()) / (h * w) * 100
    print(f"[sky-replace] Sky coverage: {sky_coverage:.1f}%")

    print(f"[sky-replace] Replacing sky with {sky_name}...")
    sky_gradient = build_sky_gradient(sky_name, h, w)

    result = composite(image, sky_gradient, mask)

    # Ensure output directory exists
    out_dir = os.path.dirname(output_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    print(f"[sky-replace] Saving result to: {output_path}")
    success = cv2.imwrite(output_path, result)
    if not success:
        raise IOError(f"Failed to write output image: {output_path}")

    print(f"[sky-replace] Done.")


def main() -> None:
    if len(sys.argv) < 4:
        print("Usage: python3 sky-replace.py <image_path> <output_path> <sky_name>")
        print(f"Available skies: {', '.join(sorted(SKY_GRADIENTS.keys()))}")
        sys.exit(1)

    image_path  = sys.argv[1]
    output_path = sys.argv[2]
    sky_name    = sys.argv[3].lower().strip()

    try:
        replace_sky(image_path, output_path, sky_name)
    except Exception as e:
        print(f"[sky-replace] ERROR: {e}")
        print(f"[sky-replace] Falling back: copying input to output unchanged.")
        try:
            out_dir = os.path.dirname(output_path)
            if out_dir:
                os.makedirs(out_dir, exist_ok=True)
            shutil.copy2(image_path, output_path)
            print(f"[sky-replace] Fallback copy successful.")
        except Exception as copy_err:
            print(f"[sky-replace] Fallback copy also failed: {copy_err}")
        sys.exit(0)


if __name__ == "__main__":
    main()
