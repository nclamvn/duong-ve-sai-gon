#!/usr/bin/env python3
"""DV-070: paint a dark short crop on the Panzergrenadier albedo from the scalp UV mask (scripts/pz-hair-mask.mjs).
The source scalp is shaved skin; it becomes dark brown-black stubble that keeps the source's fine luminance variation
(a high-pass of the skin), with the mask's soft hairline. Use: paint-pz-hair.py <albedo.png> <mask.png> <out.png>"""
import cv2, numpy as np, sys
src, msk, dst = sys.argv[1:4]
im = cv2.imread(src)
f = im[..., ::-1].astype(np.float32) / 255
lin = np.where(f <= 0.04045, f / 12.92, ((f + 0.055) / 1.055) ** 2.4)
m = cv2.imread(msk, cv2.IMREAD_GRAYSCALE).astype(np.float32) / 255
m = cv2.resize(m, (im.shape[1], im.shape[0]))
m = cv2.dilate(m, np.ones((23, 23), np.uint8))  # cover the island padding (mip bleed)
m = cv2.GaussianBlur(m, (0, 0), 1.5)[..., None]
lum = (lin @ np.array([0.2126, 0.7152, 0.0722], np.float32))[..., None]
detail = np.clip(lum / (cv2.GaussianBlur(lum, (0, 0), 5)[..., None] + 1e-3), 0.55, 1.6)
rng = np.random.default_rng(7)
grain = np.clip(1 + rng.normal(0, 0.18, lum.shape).astype(np.float32), 0.5, 1.6)
grain = cv2.GaussianBlur(grain, (0, 0), 0.6)[..., None] if grain.ndim == 2 else grain
hair = np.array([0.028, 0.02, 0.015], np.float32) * detail * grain
out = lin * (1 - m) + hair * m
srgb = np.where(out <= 0.0031308, out * 12.92, 1.055 * np.power(np.clip(out, 0, 1), 1 / 2.4) - 0.055)
cv2.imwrite(dst, (np.clip(srgb, 0, 1)[..., ::-1] * 255).astype(np.uint8))
print('hair mask coverage', round(float((m > 0.5).mean()), 4))
