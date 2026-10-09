# DV-056 · Completion Report: tay trái đỡ ốp lót (sửa kênh hằng bị rơi)

STATUS: DONE

## Lỗi Chủ nhà báo
"bàn tay trái cao che luôn nòng súng mà không phải đang đỡ súng" (ảnh DV-055 trên Mac).

## Nguyên nhân gốc
FBX2glTF bỏ mọi kênh hoạt cảnh KHÔNG đổi theo thời gian. Trong gói AB3DX, các ngón tay trái nắm ốp lót và
phép biến đổi khe gắn súng (`weapon_r`) đều là kênh hằng, nên bị rơi: ngón tay trái xoè ra (lòng bàn tay
"vẫy" phía trên ốp lót), súng mất vị trí gắn. Phép xoay −90° Z thủ công ở DV-055 chỉ là chữa triệu chứng.

## Sửa
- `scripts/convert-ab3dx-vm.mjs`: đọc lại từng FBX bằng FBXLoader của three trong Node, nạp lại mọi kênh xoay
  và tịnh tiến hằng (cm → m) còn thiếu vào clip tương ứng (idle +154 kênh, Reload +131). Bỏ phép xoay súng
  thủ công: súng về đúng chỗ nghệ sĩ gắn. Clip `Ads_idle` và `Aloft_Loop` trước bị rơi nay có lại (39 clip).
- `vmStates.ts`: ngắm đứng yên dùng vòng thở `Ads_idle` của nghệ sĩ thay cho giữ khung cuối (vẫn lùi về giữ
  khung khi thiếu clip). Thêm 1 unit test.
- Không sửa hình học, không IK (luật DV-054 giữ nguyên).

## TEST RESULTS
- typecheck: 0 lỗi
- unit: 154/154 pass
- validate-assets: 98 asset, 0 lỗi, 0 cảnh báo
- E2E boot (webgl-ci): 6/6 pass
- ảnh trong game (WebGL sandbox): `game_*.jpg`, `sheet.jpg`. Hông: tay trái nắm dưới ốp lót. Ngắm: đầu ruồi
  giữa tâm, tay trái đỡ dưới. Nạp: băng đạn trong tay trái.

## Còn mở
- Góc cầm hông có thể chỉnh camera (FOV/độ lùi) sau khi Chủ nhà xem trên Mac.
