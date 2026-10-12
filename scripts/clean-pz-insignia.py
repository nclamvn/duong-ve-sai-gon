#!/usr/bin/env python3
"""Remove WW2 insignia from the Panzergrenadier albedo (DV-069): collar tabs, shoulder-strap piping, sleeve chevron (green
components, convex hull per component), breast eagle (fixed box), belt buckle emblem (disc). Holes are filled with a clean
tunic-panel patch re-lit to the local cloth mean, feathered 2 px. Use: clean-pz-insignia.py <albedo.png> <out.png>"""
import cv2, numpy as np, sys
im=cv2.imread(sys.argv[1]).astype(np.float32)
a=im.astype(int); b,g,r=a[...,0],a[...,1],a[...,2]
lum=(0.114*b+0.587*g+0.299*r)
green=((g>r+10)&(g>b+10)&(g>60)).astype(np.uint8)*255
d=cv2.dilate(green,np.ones((15,15),np.uint8))
n,lab,st,cen=cv2.connectedComponentsWithStats(d)
mask=np.zeros(green.shape,np.uint8)
for i in range(1,n):
    if st[i][4]<=150: continue
    pts=np.column_stack(np.nonzero(lab==i))[:,::-1].astype(np.int32)
    hull=cv2.convexHull(pts); cv2.fillConvexPoly(mask,hull,255)
mask=cv2.dilate(mask,np.ones((5,5),np.uint8))
# keep only cloth-ish pixels (not black island padding, not dark belt leather)
greenish=(g>r+5)&(g>b+3)
cv2.rectangle(mask,(452,762),(520,808),255,-1)  # breast eagle (light grey, not green)
mask[(lum<25)|((lum<62)&~greenish)]=0
# reference clean cloth panel (large tunic piece)
ref=im[240:420,620:1080].copy()  # rows, cols: large clean tunic panel
refmean=ref.reshape(-1,3).mean(0)
out=im.copy()
n2,lab2,st2,_=cv2.connectedComponentsWithStats(mask)
for i in range(1,n2):
    x,y,w,h,area=st2[i]
    comp=(lab2==i)
    ring=cv2.dilate(comp.astype(np.uint8),np.ones((21,21),np.uint8)).astype(bool)&~comp&(lum>55)&(green==0)
    local=im[ring].mean(0) if ring.sum()>20 else refmean
    yy,xx=np.nonzero(comp)
    ry=(yy*7+13)%ref.shape[0]; rx=(xx*3+29)%ref.shape[1]   # decorrelated sampling still reads as weave at game scale
    ry=(yy - y + 37)%ref.shape[0]; rx=(xx - x + 53)%ref.shape[1]
    patch=ref[ry,rx]-refmean+local
    out[yy,xx]=patch
# feather
soft=cv2.GaussianBlur(mask.astype(np.float32)/255,(0,0),2.0)[...,None]
out=im*(1-soft)+out*soft
# buckle emblem: plain stamped steel
cy,cx,rad=738,330,24
Y,X=np.ogrid[:im.shape[0],:im.shape[1]]
circ=((Y-cy)**2+(X-cx)**2)<=rad**2
ringb=(((Y-cy)**2+(X-cx)**2)<=(rad+8)**2)&~circ
metal=im[ringb].mean(0)
noise=np.random.default_rng(1).normal(0,4,(circ.sum(),1))
out[circ]=metal+noise
cv2.imwrite(sys.argv[2],np.clip(out,0,255).astype(np.uint8))
pass
