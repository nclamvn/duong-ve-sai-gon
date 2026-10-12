"""Sinh claims.jsonl cho domain dem_ngam từ snapshot đã chụp; mỗi evidence_span phải nằm nguyên văn trong snapshot (tự kiểm)."""
import json, os
S = 'snapshots'
T = '2026-10-11T14:00:00Z'
out = []
def add(entity, field, value, span, snap, url, extraction='verbatim', tier='A', source='sketchfab.com'):
    snap = snap + '.html'
    txt = open(os.path.join(S, snap), encoding='utf-8').read()
    assert span in txt, (snap, span)
    out.append({'entity': entity, 'field': field, 'value': value, 'evidence_span': span, 'extraction': extraction, 'tier': tier,
                'capture': {'url': url, 'fetched_at': T, 'snapshot': snap, 'source': source}})

def skfb(uid10, uid, entity, nhom, dang, ket, han=None, han_span=None):
    snap = f'skfb_{uid10}.json'
    j = json.load(open(os.path.join(S, snap + '.html')))
    url = f'https://api.sketchfab.com/v3/models/{uid}'
    add(entity, 'nhom', nhom, '"uid": "%s"' % uid, snap, url, 'inferred')
    add(entity, 'nguon', 'sketchfab', '"viewerUrl": "https://sketchfab.com', snap, url, 'normalized')
    add(entity, 'tac_gia', j['user']['username'], '"username": "%s"' % j['user']['username'], snap, url)
    add(entity, 'gia', '0', '"isDownloadable": true', snap, url, 'inferred')
    add(entity, 'giay_phep', j['license']['label'], '"label": "%s"' % j['license']['label'], snap, url)
    add(entity, 'hinh_hoc', f"{j['faceCount']} mặt", '"faceCount": %d' % j['faceCount'], snap, url, 'normalized')
    add(entity, 'ngay_dang', j['publishedAt'][:10], '"publishedAt": "%s' % j['publishedAt'][:10], snap, url, 'normalized')
    if dang: add(entity, 'dang', dang[0], dang[1], snap, url, 'inferred')
    if han: add(entity, 'han_che', han, han_span, snap, url, 'inferred')
    add(entity, 'ket_luan', ket, '"name": "%s"' % j['name'].replace('"', '\\"'), snap, url, 'inferred', 'C')

# ---- xe
skfb('cc8cd08ccb', 'cc8cd08ccbff40898ffedf40f9aa04bb', 'ZIL157 bort platforma — JLabus (Sketchfab)', 'xe', ('ZIL-157 thùng gỗ có khung bạt, 12 texture, Blender + Substance', 'Created in Blender and Substance painer'), 'chon')
skfb('8c550c84d5', '8c550c84d5d7417eaa91a163c6896f94', 'ZIL157 — JLabus (Sketchfab)', 'xe', ('ZIL-157 thùng có khung bạt, 38 texture', 'Created in Blender and substance painter'), 'du_phong', 'nặng (277k mặt), phải giảm lưới', '"faceCount": 276922')
skfb('9e04792245', '9e047922452346f28acc8f4f6cc66d7b', 'ZIL 157 Military Truck — rylo (Sketchfab)', 'xe', ('ZIL-157 bẩn, có rig hệ treo, texture 1K', 'Rigged the suspension for the animation'), 'du_phong', 'rất nặng (687k mặt, 139 texture)', '"faceCount": 686682')
skfb('bc45123f03', 'bc45123f030540f3bd66edc7e548726d', 'Zil 157 — dugito03 (Sketchfab)', 'xe', None, 'loai', 'người đăng ghi đã sửa mô hình, không rõ tác giả gốc', 'I modified this model a bit')
skfb('38e93a0437', '38e93a0437c84184a141fe44a5125e4f', 'ZiL-130 — nghesiyeubuom97 (Sketchfab)', 'xe', ('ZiL-130 thùng bạt, gắn thẻ quân đội nhân dân Việt Nam', 'vietnam-peoples-army'), 'du_phong', 'ZiL-130 là xe đường bằng 4x2, ít dùng trên tuyến rừng', 'Production began in 1962')
skfb('b21ad606d2', 'b21ad606d20a467eac0e63e7d298488d', 'zil-130 — Ara_my45yt (Sketchfab)', 'xe', None, 'loai', 'trùng đúng số mặt với bản của nghesiyeubuom97, nghi đăng lại', '"faceCount": 174063')
skfb('55003cdc57', '55003cdc57194a50b8de6513956e8fde', 'Military Truck ZIL-157 KUNG (RAW SCAN) — Zende (Sketchfab)', 'xe', ('ZIL-157 thùng kín KUNG, quét ảnh', 'photogrammetry'), 'du_phong', 'thùng kín xe cứu thương, không phải xe chở hàng', '"label": "Free Standard"')
# ---- súng
skfb('070de1ca5d', '070de1ca5d664160b3fd489c412f871e', 'dshk — hensyu_leader (Sketchfab)', 'sung', ('DShK chân ba càng, làm bằng Blockbench', 'blockbench'), 'loai', 'chất lượng thấp (Blockbench)', '"name": "blockbench"')
skfb('aceec722e7', 'aceec722e7e148b0992da0d271c10cd2', 'DSHK completed — nemanjr981 (Sketchfab)', 'sung', None, 'loai', 'chất lượng thấp, dáng không đúng', '"faceCount": 3826')
skfb('df0a97950c', 'df0a97950c1140d087541734ed597743', 'Twin Dshk Shielded Tri-pod emplacement — Sleepykingzzz (Sketchfab)', 'sung', ('DShK nòng đôi có khiên, tự chế', 'Duel DShk'), 'loai', 'biến thể tưởng tượng, không có thật', "I went with Duel DShk's yet again")
for e, snap, url, gia, gia_span, hh, hh_span, dang, dang_span, date, ket in [
    ('DShK Heavy Machine Gun Low-poly PBR — Max3d (Fab)', 'fab_dshk_max3d.md', 'https://www.fab.com/listings/59580218-ec56-4e5b-9580-e0136acac8d7', '824806 VND', '(₫824,806)', '25.919 tam giác, PBR 4K một bộ', 'Low-poly (25,919 Tris )', 'giá ba càng phòng không, bộ phận tách rời', 'Separate objects for animation.', '2025-12-01', 'chon'),
    ('Heavy Machine Gun Dshk 1938 — Frigus (Fab)', 'fab_dshk_frigus.md', 'https://www.fab.com/listings/511153e8-a2e5-42ec-a3c1-2e2b696eb813', '1023966–1422286 VND', '(From ₫1,023,966 to ₫1,422,286)', '139k tam giác, 3 bộ texture 4K', 'Tris: 139k', 'giá bánh xe Kolesnikov có khiên (thêm bản ba càng)', 'giá bánh xe Kolesnikov có tấm chắn', '2024-10-29', 'du_phong')]:
    add(e, 'nhom', 'sung', 'Title:', snap, url, 'inferred', source='fab.com')
    add(e, 'nguon', 'fab', 'Fab', snap, url, 'normalized', source='fab.com')
    add(e, 'gia', gia, gia_span, snap, url, 'normalized', source='fab.com')
    add(e, 'giay_phep', 'Fab Standard (bắt buộc gói .dvpak, DV-062)', 'Standard License', snap, url, 'normalized', source='fab.com')
    add(e, 'hinh_hoc', hh, hh_span, snap, url, 'normalized', source='fab.com')
    add(e, 'dang', dang, dang_span, snap, url, 'inferred', source='fab.com')
    add(e, 'han_che', 'không dùng AI, không sinh bằng AI', 'Generated with AI\nNo', snap, url, 'normalized', source='fab.com')
    add(e, 'ket_luan', ket, 'Title:', snap, url, 'inferred', 'C', source='fab.com')
add('Vietnam Meta Soldier PAVN — wellweldedgames (Fab)', 'nhom', 'nhan_vat', 'Title:', 'fab_pavn_meta.md', 'https://www.fab.com/listings/38938841-09b8-4111-96a3-0e17546f08f8', 'inferred', source='fab.com')
add('Vietnam Meta Soldier PAVN — wellweldedgames (Fab)', 'han_che', 'chỉ Unreal, nhân vật nam', 'Unreal Engine', 'fab_pavn_meta.md', 'https://www.fab.com/listings/38938841-09b8-4111-96a3-0e17546f08f8', 'normalized', source='fab.com')
add('Vietnam Meta Soldier PAVN — wellweldedgames (Fab)', 'ket_luan', 'loai', 'Masculine', 'fab_pavn_meta.md', 'https://www.fab.com/listings/38938841-09b8-4111-96a3-0e17546f08f8', 'inferred', 'C', source='fab.com')
add('Stylized Vietnamese Model with Skirt — Tam Nguyen (Fab)', 'nhom', 'nhan_vat', 'Title:', 'fab_chibi_vn.md', 'https://www.fab.com/listings/20bde5ef-80ce-448f-aaa3-59a366872d05', 'inferred', source='fab.com')
add('Stylized Vietnamese Model with Skirt — Tam Nguyen (Fab)', 'han_che', 'phong cách chibi', 'Chibi Girl', 'fab_chibi_vn.md', 'https://www.fab.com/listings/20bde5ef-80ce-448f-aaa3-59a366872d05', 'verbatim', source='fab.com')
add('Stylized Vietnamese Model with Skirt — Tam Nguyen (Fab)', 'ket_luan', 'loai', 'Chibi Girl', 'fab_chibi_vn.md', 'https://www.fab.com/listings/20bde5ef-80ce-448f-aaa3-59a366872d05', 'inferred', 'C', source='fab.com')
# ---- nhân vật nữ
skfb('600d4d4aa7', '600d4d4aa71c4181b2567a3605ce8c57', 'Alina Ip — jungle_jim (Sketchfab)', 'nhan_vat', None, 'loai', 'dựng từ DAZ3D + Character Creator 4 (giấy phép game riêng), nội dung gợi dục', 'Made with FaceGen Artist Pro, DAZ3D & Character Creator 4')
skfb('b38456c89b', 'b38456c89bf94323aa3c079f27e435ce', 'Casual Woman in Brown Dress Rigged Idle — florah (Sketchfab)', 'nhan_vat', ('phụ nữ châu Á, váy nâu, có rig + idle', 'simple brown sleeveless dress'), 'du_phong', 'trang phục hiện đại, nặng (256k mặt)', '"faceCount": 255948')
skfb('9fcb06e1d0', '9fcb06e1d0c04b6f9587443a895ac465', 'Vietnamese girl — nhacedm01598 (Sketchfab)', 'nhan_vat', None, 'loai', 'nội dung gợi dục, không rig', 'sexy-girl')
skfb('239d03fb11', '239d03fb117647f58924ed5e334f0a7a', 'Young women in traditional of Bac Ninh — phamminhdai1989 (Sketchfab)', 'nhan_vat', ('áo tứ thân quan họ, tạo dáng ngồi thổi sáo', 'traditional attire from Bac Ninh'), 'loai', 'tạo dáng sẵn, trang phục lễ hội', '"faceCount": 483914')
skfb('ce12c12741', 'ce12c12741194cc8b7d5b0f5d12568e6', 'female#2 — nguyenvanpat (Sketchfab)', 'nhan_vat', None, 'loai', 'phong cách anime', 'animegirl')
skfb('66c8984fa0', '66c8984fa0d94a5391b067f191243155', 'Vietnam-woman — golfkantapol1993 (Sketchfab)', 'nhan_vat', None, 'loai', 'hoạt hình, không texture', '"faceCount": 13004')
skfb('abd86436d0', 'abd86436d03344b9a40c82e127fb6252', 'Vietnamese Non La — NNgan (Sketchfab)', 'dao_cu', ('nón lá low-poly, tác giả người Việt', 'Viet Nam Non La'), 'chon')
mp = 'mpfb_closed_source.txt'; mpu = 'https://static.makehumancommunity.org/mpfb/faq/use_in_closed_source.html'
E = 'MPFB / MakeHuman (dựng nhân vật nữ Thu)'
add(E, 'nhom', 'cong_cu', 'Can I use models made with MPFB in a closed-source game?', mp, mpu, 'inferred', source='makehumancommunity.org')
add(E, 'nguon', 'makehuman', 'MakeHuman Community', mp, mpu, 'normalized', source='makehumancommunity.org')
add(E, 'gia', '0', 'All core assets (the base mesh, targets, skins…) are shared under CC0', mp, mpu, 'inferred', source='makehumancommunity.org')
add(E, 'giay_phep', 'CC0 (lưới gốc, target, da)', 'All core assets (the base mesh, targets, skins…) are shared under CC0', mp, mpu, 'normalized', source='makehumancommunity.org')
add(E, 'han_che', 'asset bên thứ ba theo license riêng', 'if you use a third party asset shared under a different license it is your responsibility', mp, mpu, 'verbatim', source='makehumancommunity.org')
add(E, 'dang', 'rig + hoạt ảnh qua Mixamo', 'Animating characters using Mixamo', mp, mpu, 'inferred', source='makehumancommunity.org')
add(E, 'ket_luan', 'chon', 'Yes.', mp, mpu, 'inferred', 'C', source='makehumancommunity.org')
# ---- đạo cụ Poly Haven
for a, dang in [('vintage_oil_lamp', 'đèn dầu'), ('wooden_lantern_01', 'đèn lồng gỗ'), ('barrel_03', 'phuy'), ('metal_jerrycan_green', 'can xăng xanh'), ('wooden_military_crate', 'hòm gỗ quân dụng'), ('old_military_crate', 'hòm quân dụng cũ')]:
    snap = f'ph_{a}.json'; j = json.load(open(os.path.join(S, snap + '.html'))); url = f'https://api.polyhaven.com/info/{a}'
    au = list(j['authors'])[0]
    add(a, 'nhom', 'dao_cu', '"name": "%s"' % j['name'], snap, url, 'inferred', source='polyhaven.com')
    add(a, 'nguon', 'polyhaven', '"name": "%s"' % j['name'], snap, url, 'inferred', source='polyhaven.com')
    add(a, 'tac_gia', au, au, snap, url, 'verbatim', source='polyhaven.com')
    add(a, 'gia', '0', '"name": "%s"' % j['name'], snap, url, 'inferred', 'B', source='polyhaven.com')
    add(a, 'giay_phep', 'CC0 (mọi asset Poly Haven)', '"name": "%s"' % j['name'], snap, url, 'inferred', 'B', source='polyhaven.com')
    add(a, 'hinh_hoc', f"{j['polycount']} poly", '"polycount": %d' % j['polycount'], snap, url, 'normalized', source='polyhaven.com')
    add(a, 'dang', dang, '"name": "%s"' % j['name'], snap, url, 'inferred', source='polyhaven.com')
    add(a, 'ket_luan', 'chon' if a not in ('wooden_lantern_01', 'old_military_crate') else 'du_phong', '"name": "%s"' % j['name'], snap, url, 'inferred', 'C', source='polyhaven.com')
with open('claims.jsonl', 'w') as f:
    for c in out: f.write(json.dumps(c, ensure_ascii=False) + '\n')
print(len(out), 'claims')
