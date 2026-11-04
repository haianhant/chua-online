# TRẠNG THÁI BẢN SNAPSHOT NÀY (2026-11-04, bản v2.1 — cải thiện UI/UX khuôn viên, Tắm Phật & Đồ lam đi chùa)

## Các hạng mục cập nhật UI/UX trong bản này

1. **Mở rộng & định hình rõ khuôn viên chùa (`Temple.tsx`, `BellTower.tsx`, `Grounds.tsx`, `controls.ts`)**:
   - Nới rộng sân gạch đối xứng hai bên (`64m × 46m`, `x: -32..32`, `z: -33..13`) kết hợp tiền sảnh trước Cổng Tam Quan (`16m × 7m`, `z: 13..20`) và hệ thống **tường bao khuôn viên chùa truyền thống** (chân đá xanh, thân tường vàng vôi ấm, mái ngói mũi hài và trụ biểu) nối liền hai bên Cổng Tam Quan, bao trọn Gác chuông, Vườn Lâm Tỳ Ni (Lễ đài Tắm Phật), Hồ sen, Sân đa, Vườn sau và Nhà trà.
   - Dời nhẹ Gác chuông sang `(-14, -8.5)` để tách thoáng khỏi mái hiên Chính điện và đường đá đi vào khu Tắm Phật.
   - Dời tường và cổng Vườn sau sang `x = 16.0` (phía đông lối đi hành lang `x = 14.5`) để lối đi thẳng mạch, không còn cắt ngang qua đường đá.

2. **Xử lý triệt để các mảng đất và chi tiết chồng chéo (Z-fighting & Geometry overlap)**:
   - Tách cao độ nền sân gạch (`y = 0.02`), nền sân Lâm Tỳ Ni (`y = 0.03` kèm bó vỉa đá `y = 0.045`), thảm cỏ vườn sau (`y = 0.03` thu gọn `x: 17.4..23.8, z: -25.0..-11.8` kèm bó vỉa đá, không còn tràn dưới nền Nhà trà hay trùng cao độ với đường đá `y = 0.04`).
   - Chuẩn hóa đường đá trung tâm dừng trước Lư hương (không đâm xuyên dưới lư hương và bậc thềm Chính điện), bỏ các phiến đá tròn thừa đè lên đá viền Hồ sen, chỉnh bậc đá bờ hồ và cột rễ phụ cây đa không lấn lối đi.

3. **Tôn tượng Thái tử Tất Đạt Đa đản sinh tại Lễ đài Tắm Phật (`Lumbini.tsx`, `app/page.tsx`)**:
   - Bổ sung tôn tượng **Thái tử Tất Đạt Đa sơ sinh (Đức Phật Thích Ca Mâu Ni lúc đản sinh)** bằng đồng thếp vàng trang nghiêm đứng trên đài sen giữa bồn nước hoa sen tại Vườn Lâm Tỳ Ni, đúng truyền thống Phật giáo Bắc tông Việt Nam: mình trần đeo kiềng vàng, quấn xiêm y xếp nếp chạm hoa văn, **tay trái chỉ lên trời (chỉ thiên), tay phải chỉ xuống đất (chỉ địa)**, diện mạo từ hòa, nhục髻 (ushnisha) và vòng hào quang phía sau.
   - Tinh chỉnh quỹ đạo gáo nước và dòng nước thơm rưới nhẹ nhàng từ phía trên tôn tượng Thái tử chảy về bồn sen.

4. **Trang phục nhân vật — Bộ đồ lam đi chùa (`Player.tsx`, `RemotePlayers.tsx`)**:
   - Thiết kế lại nhân vật chính và khách cùng phòng trong trang phục **Bộ đồ lam Phật tử đi chùa**: áo lam cổ tàu truyền thống, nẹp áo vạt chéo cài 5 nút vải trắng ngà, huy hiệu hoa sen thêu ngực trái và họa tiết sen sau lưng, quần lam ống suông, giày vải đế trắng ngà, vòng chuỗi hạt gỗ trầm nơi cổ tay, đầu trần tóc búi gọn cài trâm gỗ (bỏ nón lá trong khuôn viên chùa).

## Build & chạy

- `npm install`
- Dev: `npm run dev`
- Build tĩnh (bắt buộc có biến môi trường, không là MẤT multiplayer):
  `NEXT_PUBLIC_MULTIPLAYER_WS_URL=wss://chua-online-temple.hunganhz179.workers.dev/ws npm run build`
- Test nhanh: `node test-v2-unit.js` (109 kiểm tra) + `npx tsc --noEmit` + build.
