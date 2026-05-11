#!/usr/bin/env python3
"""
LOS-037: day-to-dusk.py
Convert a daytime real-estate photo to a dusk/twilight look.
Usage: python3 scripts/day-to-dusk.py <image_path> <output_path>

Pipeline:
  1. Darken overall image (multiply 0.55)
  2. Warm orange cast on highlights (avg > 150)
  3. Blue/purple cast on shadows (avg < 80)
  4. Replace sky with dusk_purple gradient (inline sky logic — no subprocess)
  5. Detect window rectangles (bright, low-sat patches below top-40%) and add warm yellow glow
"""

import cv2
import numpy as np
import sys
import os
import shutil
import subprocess


# ---------------------------------------------------------------------------
# Sky gradient table (same as sky-replace.py, inlined so script is standalone)
# ---------------------------------------------------------------------------
SKY_GRADIENTS = {
    "clear_blue":  ((235, 206, 135), (255, 230, 200)),
    "sunset":      ((45,  80,  255), (100, 160, 255)),
    "dramatic":    ((20,  10,  10),  (60,  40,  80)),
    "twilight":    ((80,  30,  60),  (140, 80,  160)),
    "dawn":        ((100, 150, 255), (180, 220, 255)),
    "stormy":      ((60,  55,  50),  (100, 95,  90)),
    "golden":      ((30,  100, 220), (80,  180, 255)),
    "overcast":    ((160, 155, 150), (200, 198, 195)),
    "dusk_purple": ((60,  20,  80),  (140, 60,  180)),
    "starry":      ((10,   5,   5),  (30,  15,  40)),
}


def _build_sky_gradient(sky_name: str, height: int, width: int) -> np.ndarray:
    top_bgr, bot_bgr = SKY_GRADIENTS.get(sky_name, SKY_GRADIENTS["dusk_purple"])
    gradient = np.zeros((height, width, 3), dtype=np.float32)
    for ch in range(3):
        column = np.linspace(float(top_bgr[ch]), float(bot_bgr[ch]), height, dtype=np.float32)
        gradient[:, :, ch] = np.tile(column.reshape(-1, 1), (1, width))
    return np.clip(gradient, 0, 255).astype(np.uint8)


def _detect_sky_mask(image_bgr: np.ndarray) -> np.ndarray:
    """Returns float32 mask [0..1]; 1 = sky."""
    h, w = image_bgr.shape[:2]
    top_h = int(h * 0.40)
    raw_mask = np.zeros((h, w), dtype=np.uint8)

    roi = image_bgr[:top_h, :]
    hsv_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    sat = hsv_roi[:, :, 1].astype(np.float32)
    val = hsv_roi[:, :, 2].astype(np.float32)
    sky_pixels = (sat < 30) & (val > 150)
    raw_mask[:top_h, :] = (sky_pixels * 255).astype(np.uint8)

    blurred = cv2.GaussianBlur(raw_mask, (21, 21), 0)
    return blurred.astype(np.float32) / 255.0


def step1_darken(image: np.ndarray, factor: float = 0.55) -> np.ndarray:
    """Multiply all pixel values by factor to darken the image."""
    print(f"[day-to-dusk] Step 1: Darkening overall image (factor={factor})...")
    darkened = (image.astype(np.float32) * factor)
    return np.clip(darkened, 0, 255).astype(np.uint8)


def step2_warm_highlights(image: np.ndarray) -> np.ndarray:
    """
    Step 2: Add warm orange cast to highlight pixels.
    Pixels where channel average > 150 get shifted toward BGR (0, 80, 180).
    Strength of shift is proportional to how bright the pixel is (0..1 in [150..255] range).
    """
    print("[day-to-dusk] Step 2: Adding warm orange cast to highlights...")
    img_f = image.astype(np.float32)

    # Per-pixel average across channels
    avg = img_f.mean(axis=2)  # (H, W)

    # Build a blend weight: 0 when avg<=150, linearly up to 0.45 when avg==255
    weight = np.clip((avg - 150.0) / 105.0, 0.0, 1.0) * 0.45  # (H, W)
    weight_3ch = weight[:, :, np.newaxis]  # (H, W, 1)

    # Target warm orange in BGR: B=0, G=80, R=180
    warm_color = np.array([0.0, 80.0, 180.0], dtype=np.float32)  # (3,)

    result = img_f * (1.0 - weight_3ch) + warm_color * weight_3ch
    return np.clip(result, 0, 255).astype(np.uint8)


def step3_cool_shadows(image: np.ndarray) -> np.ndarray:
    """
    Step 3: Add blue/purple cast to shadow pixels.
    Pixels where channel average < 80 get shifted toward BGR (60, 20, 0).
    """
    print("[day-to-dusk] Step 3: Adding blue/purple cast to shadows...")
    img_f = image.astype(np.float32)

    avg = img_f.mean(axis=2)

    # Weight: 0 when avg>=80, linearly up to 0.50 when avg==0
    weight = np.clip((80.0 - avg) / 80.0, 0.0, 1.0) * 0.50
    weight_3ch = weight[:, :, np.newaxis]

    # Target cool blue-purple in BGR: B=60, G=20, R=0
    cool_color = np.array([60.0, 20.0, 0.0], dtype=np.float32)

    result = img_f * (1.0 - weight_3ch) + cool_color * weight_3ch
    return np.clip(result, 0, 255).astype(np.uint8)


def step4_replace_sky(image: np.ndarray, sky_name: str = "dusk_purple") -> np.ndarray:
    """
    Step 4: Replace sky region using the same HSV color-based mask from sky-replace.py.
    Uses dusk_purple gradient by default.
    """
    print(f"[day-to-dusk] Step 4: Replacing sky with '{sky_name}' gradient...")
    h, w = image.shape[:2]

    mask = _detect_sky_mask(image)
    sky_coverage = float(mask.sum()) / (h * w) * 100
    print(f"[day-to-dusk]   Sky coverage detected: {sky_coverage:.1f}%")

    sky_gradient = _build_sky_gradient(sky_name, h, w)

    alpha = mask[:, :, np.newaxis]
    orig_f = image.astype(np.float32)
    sky_f  = sky_gradient.astype(np.float32)
    blended = orig_f * (1.0 - alpha) + sky_f * alpha
    return np.clip(blended, 0, 255).astype(np.uint8)


def step5_window_glow(image: np.ndarray) -> np.ndarray:
    """
    Step 5: Detect bright, low-saturation rectangular patches BELOW the top 40%
    (heuristic for lit windows at dusk). Add warm yellow-orange glow around them.

    Detection: HSV value > 200 AND saturation < 50, in lower 60% of image.
    Glow: dilate the window mask, then blend warm orange-yellow into the dilation halo.
    """
    print("[day-to-dusk] Step 5: Detecting windows and adding warm glow...")
    h, w = image.shape[:2]
    top_cutoff = int(h * 0.40)

    img_f = image.astype(np.float32)

    # ---- Detect window pixels ----
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    val = hsv[:, :, 2].astype(np.float32)
    sat = hsv[:, :, 1].astype(np.float32)

    window_mask = np.zeros((h, w), dtype=np.uint8)
    # Only look below top 40%
    roi_val = val[top_cutoff:, :]
    roi_sat = sat[top_cutoff:, :]
    window_pixels = (roi_val > 200) & (roi_sat < 50)
    window_mask[top_cutoff:, :] = (window_pixels * 255).astype(np.uint8)

    window_coverage = float(window_mask.sum()) / 255 / (h * w) * 100
    print(f"[day-to-dusk]   Window pixel coverage: {window_coverage:.2f}%")

    if window_coverage < 0.001:
        print("[day-to-dusk]   No significant window areas found — skipping glow.")
        return image

    # ---- Build glow halo by dilating the window mask ----
    kernel_size = max(15, int(min(h, w) * 0.03) | 1)  # ~3% of smaller dimension, odd
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
    dilated = cv2.dilate(window_mask, kernel, iterations=2)

    # Halo = dilated region MINUS the actual window core
    halo_mask = cv2.subtract(dilated, window_mask)

    # Soft blur the halo for a natural glow spread
    halo_blurred = cv2.GaussianBlur(halo_mask, (kernel_size | 1, kernel_size | 1), 0)
    halo_float = halo_blurred.astype(np.float32) / 255.0 * 0.60  # max 60% blend
    halo_3ch = halo_float[:, :, np.newaxis]

    # Warm window glow colour: orange-yellow BGR = (0, 140, 255)
    glow_color = np.array([0.0, 140.0, 255.0], dtype=np.float32)
    result = img_f * (1.0 - halo_3ch) + glow_color * halo_3ch

    # Also slightly warm the window pixels themselves
    win_float = (window_mask.astype(np.float32) / 255.0 * 0.35)[:, :, np.newaxis]
    warm_win_color = np.array([20.0, 160.0, 255.0], dtype=np.float32)
    result = result * (1.0 - win_float) + warm_win_color * win_float

    return np.clip(result, 0, 255).astype(np.uint8)


def day_to_dusk(image_path: str, output_path: str) -> None:
    print(f"[day-to-dusk] Loading image: {image_path}")
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"Cannot read image: {image_path}")

    h, w = image.shape[:2]
    print(f"[day-to-dusk] Image size: {w}x{h}")

    # Run pipeline steps
    result = step1_darken(image, factor=0.55)
    result = step2_warm_highlights(result)
    result = step3_cool_shadows(result)
    result = step4_replace_sky(result, sky_name="dusk_purple")
    result = step5_window_glow(result)

    # Ensure output directory exists
    out_dir = os.path.dirname(output_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    print(f"[day-to-dusk] Saving result to: {output_path}")
    success = cv2.imwrite(output_path, result)
    if not success:
        raise IOError(f"Failed to write output image: {output_path}")

    print(f"[day-to-dusk] Done.")


def main() -> None:
    if len(sys.argv) < 3:
        print("Usage: python3 day-to-dusk.py <image_path> <output_path>")
        sys.exit(1)

    image_path  = sys.argv[1]
    output_path = sys.argv[2]

    try:
        day_to_dusk(image_path, output_path)
    except Exception as e:
        print(f"[day-to-dusk] ERROR: {e}")
        print(f"[day-to-dusk] Falling back: copying input to output unchanged.")
        try:
            out_dir = os.path.dirname(output_path)
            if out_dir:
                os.makedirs(out_dir, exist_ok=True)
            shutil.copy2(image_path, output_path)
            print(f"[day-to-dusk] Fallback copy successful.")
        except Exception as copy_err:
            print(f"[day-to-dusk] Fallback copy also failed: {copy_err}")
        sys.exit(0)


if __name__ == "__main__":
    main()
