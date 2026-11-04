# TRẠNG THÁI BẢN SNAPSHOT NÀY (2026-11-04, bản v2-final)

## Bản này ĐÃ XONG và ĐÃ DEPLOY lên live

Đợt tính lại mặt bằng v2 đã hoàn thành và deploy chiều 04/11
(dpl_GdXBUnAe1xnxqqLMfFbcCzShYJfJ, live chuahaianonline.vercel.app):
sân gạch MỘT tấm lớn bao hết chuông + tắm Phật + vườn + nhà trà,
mọi đường đi đều thẳng (không còn đường chéo), vườn rau + nhà trà
đẩy xa ra đông, ghế trà chuyển sang phía đông bàn hướng Tây nhìn ra
luống rau, tượng Địa Tạng (ban đông) tăng thêm 20%, bản đồ tính lại
theo bounds mới. Chi tiết xem `arch-audit.md` (mục "V2 REPL AN").

Bản này khớp với live — push lên GitHub main rồi nối Vercel là an toàn.

## Build & chạy

- `npm install`
- Dev: `npm run dev`
- Build tĩnh (bắt buộc có biến môi trường, không là MẤT multiplayer):
  `NEXT_PUBLIC_MULTIPLAYER_WS_URL=wss://chua-online-temple.hunganhz179.workers.dev/ws npm run build`
- Deploy thủ công (trước khi nối Vercel): Vercel project
  `chuahaianonline`, domain `chuahaianonline.vercel.app`; sau mỗi
  deploy thành công chỉ giữ khoảng 3 bản deploy mới nhất.
- Multiplayer: Cloudflare Worker trong `worker/src` (đã live).
- Test nhanh: `node test-v2-unit.js` (99 kiểm tra) + tsc + build.
  (Đợt này bỏ qua test Playwright từng chặng theo lệnh làm nhanh.)
