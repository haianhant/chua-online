# TRẠNG THÁI BẢN SNAPSHOT NÀY (2026-11-04)

## Đọc trước khi build/deploy: bản này đang DỞ DANG, chưa deploy được

Đợt "tính lại mặt bằng v2" (nới sân, đặt lại kiến trúc, hết chồng chéo)
đang dừng giữa chừng theo lệnh của Hải Anh. Source hiện LỆCH NHAU:

- ĐÃ SỬA theo mặt bằng mới: `components/three/controls.ts` (bounds
  -32..32 / -40..30, vườn (20,-13.5), chum (18.5,-12.8), luống (21,-20),
  bàn trà (27.5,-18.5), ghế trà (29.3,-18.5) hướng Tây, sàn + collider
  mới) và một phần `components/three/Grounds.tsx` (vòng đá cây đa, bỏ
  sàn hành lang, tường vườn rút ngắn, bãi cỏ + luống + chum mới).
- CHƯA SỬA (vẫn theo mặt bằng cũ): nhà trà, routes + bản đồ trong
  `app/page.tsx`, đá đường, `Lumbini.tsx`, `Temple.tsx` (sân/bệ),
  `SideStatuesPreview.tsx` (Địa Tạng +20%), unit test.

Vì vậy: KHÔNG build/deploy bản này lên live. Bản live hiện tại vẫn là
deploy sáng 04/11 (dpl_ARZU...). Muốn làm tiếp thì đọc
`arch-audit.md` (mục "V2 REPL AN" và "TẠM DỪNG 15:04"), sửa nốt các phần
CHƯA SỬA rồi mới build + test từng chặng.

## Build & chạy

- `npm install`
- Dev: `npm run dev`
- Build tĩnh (bắt buộc có biến môi trường, không là MẤT multiplayer):
  `NEXT_PUBLIC_MULTIPLAYER_WS_URL=wss://chua-online-temple.hunganhz179.workers.dev/ws npm run build`
- Deploy: Vercel project `chuahaianonline`, domain
  `chuahaianonline.vercel.app`; sau mỗi deploy thành công chỉ giữ
  khoảng 3 bản deploy mới nhất.
- Multiplayer: Cloudflare Worker trong `worker/src` (đã live, không
  cần đụng tới trừ khi đổi logic phòng).
- Test: các script `test-*.js` chạy bằng Playwright (xem `arch-audit.md`).
