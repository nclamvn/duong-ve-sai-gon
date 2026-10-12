#!/usr/bin/env python3
"""Remove hand-written graffiti from the M16A1 (DavidFalke, CC-BY) albedos (DV-070): stock panel text + two peace symbols
(texture 0), "born to kill" scrawl on the handguard (texture 3). The dark plastic panel is found as the connected dark
component around a seed, holes filled; marks = pixels brighter than the panel median; filled with a clean panel patch.
Use: clean-m16-graffiti.py <dir with tex0.png, tex3.png>  (writes tex0_clean.png, tex3_clean.png)"""
import cv2, numpy as np, sys, os
def clean(src, dst, seed, box, fill_patch):
    im = cv2.imread(src, cv2.IMREAD_UNCHANGED)
    rgb = im[..., :3].astype(np.float32)
    lum = cv2.cvtColor(im[..., :3], cv2.COLOR_BGR2GRAY)
    x0, y0, x1, y1 = box
    dark = np.zeros(lum.shape, np.uint8)
    dark[y0:y1, x0:x1] = (lum[y0:y1, x0:x1] < 45).astype(np.uint8) * 255
    dark = cv2.morphologyEx(dark, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(dark)
    panel = (lab == lab[seed[1], seed[0]]).astype(np.uint8) * 255
    panel = cv2.morphologyEx(panel, cv2.MORPH_CLOSE, np.ones((25, 25), np.uint8))
    ff = panel.copy(); h, w = ff.shape
    cv2.floodFill(ff, np.zeros((h + 2, w + 2), np.uint8), (w - 1, h - 1), 255)
    interior = cv2.bitwise_or(panel, cv2.bitwise_not(ff))
    interior = cv2.erode(interior, np.ones((7, 7), np.uint8))
    med = float(np.median(lum[(interior > 0) & (lum < 45)]))
    marks = ((interior > 0) & (lum > med + 18)).astype(np.uint8) * 255
    marks = cv2.dilate(marks, np.ones((7, 7), np.uint8)) & interior
    px0, py0, px1, py1 = fill_patch
    ref = rgb[py0:py1, px0:px1]
    yy, xx = np.nonzero(marks)
    out = rgb.copy()
    out[yy, xx] = ref[(yy - y0) % ref.shape[0], (xx - x0) % ref.shape[1]]
    soft = cv2.GaussianBlur(marks.astype(np.float32) / 255, (0, 0), 1.5)[..., None]
    im[..., :3] = np.clip(rgb * (1 - soft) + out * soft, 0, 255).astype(np.uint8)
    cv2.imwrite(dst, im)
    print(src, 'marks', int((marks > 0).sum()), 'median', med)
D = sys.argv[1]
clean(os.path.join(D, 'tex0.png'), os.path.join(D, 'tex0_clean.png'), seed=(150, 100), box=(0, 0, 540, 450), fill_patch=(100, 20, 220, 190))
clean(os.path.join(D, 'tex3.png'), os.path.join(D, 'tex3_clean.png'), seed=(600, 500), box=(540, 440, 990, 740), fill_patch=(560, 460, 700, 520))
