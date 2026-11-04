# TRẠNG THÁI BẢN SNAPSHOT NÀY (2026-11-04, bản v2.1 — cải thiện UI/UX khuôn viên, Tắm Phật & Đồ lam đi chùa)

## Các hạng mục cập nhật UI/UX trong bản này

1. **Mở rộng khuôn viên & tách thoáng các cụm kiến trúc (`Temple.tsx`, `BellTower.tsx`, `Grounds.tsx`, `Lumbini.tsx`, `controls.ts`)**:
   - Nới rộng sân gạch đối xứng hai bên lên **`88m × 49m`** (`x: -44..44`, `z: -36..13`, bounds `x: -46..46, z: -44..32`) kết hợp tiền sảnh trước Cổng Tam Quan (`18m × 7m`, `z: 13..20`) và hệ thống **tường bao khuôn viên chùa truyền thống** bao trọn toàn bộ công trình.
   - **Tách giãn khoảng cách giữa Chính điện và tất cả các kiến trúc phụ** (khoảng thở từ `9.4m` đến `12m`, không còn cụm dính sát nhau):
     - **Tâm Liên Hồ (Hồ sen)**: dời ra `(-16.0, 3.0)` (cách đường chính gần `12m`).
     - **Gác chuông**: dời ra `(-22.0, -9.0)` (tách thoáng `9.4m` khỏi mái hiên Chính điện).
     - **Vườn Lâm Tỳ Ni – Lễ đài Tắm Phật**: dời ra `(-28.0, -24.0)` (tách thoáng `11.4m` khỏi Chính điện và `7.5m` khỏi Gác chuông).
     - **Cây đa Bách Linh**: dời ra `(22.0, 8.0)` (tách thoáng khỏi hành lang Đông và Chính điện).
     - **Cổng & Vườn Lộc Uyển**: cổng dời ra `x = 20.0`, thảm cỏ và luống rau ở `x = 23.4..31.0` (`(27.5, -20.0)`).
     - **Nhà trà – Hiên đọc**: dời ra `(36.5, -18.5)` (`x = 33.0..40.0`, tách biệt hẳn với khu luống rau).
   - **Bổ sung hệ thống biển hiệu gỗ truyền thống** (hai trụ gỗ lim trên chân tảng đá, bảng gỗ chữ vàng chạm khắc 2 mặt, mái ngói mũi hài che mưa nắng):
     - Biển hiệu **“Cây đa Bách Linh”** tại lối vào sân đa `(18.2, 11.2)`.
     - Biển hiệu **“Tâm Liên Hồ”** tại bờ đông nam hồ sen `(-13.2, 7.8)`.
     - Biển hiệu **“Vườn Lộc Uyển”** tại lối vào cổng vườn `(18.4, -7.6)` kèm bức hoành **“Vườn Lộc Uyển”** trên xà cổng `(20.0, -10.0)`.

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

## 2026-11-04: repo chuyển sang public, Vercel tự deploy
- Repo `haianhant/chua-online` chuyển từ private sang public lúc ~16:50 ngày 2026-11-04 (user tự đổi trong Settings) để Vercel gói Hobby deploy được commit của collaborator.
- Commit này chỉ để kích hoạt một production deploy mới với cấu hình framework Next.js (deploy git trước đó build lúc project chưa cài framework nên lên live bị 404).
