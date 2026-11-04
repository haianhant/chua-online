# TRẠNG THÁI BẢN SNAPSHOT NÀY (2026-11-04, bản v2.3 — Đại Hùng Bảo Điện 3 tầng, Bảo Tháp Báo Ân 7 tầng, Nghi lễ Phật giáo truyền thống & Đi thuyền qua Sông Bát Nhã sang Đảo HSK)

## Các hạng mục cập nhật trong bản v2.3

1. **Kiến trúc Chùa Việt cổ đồ sộ nhiều tầng (`Temple.tsx`, `controls.ts`)**:
   - **Đại Hùng Bảo Điện 3 tầng chồng diêm 12 mái đao**:
     - **Tầng 1 (Hạ điện)**: Bậc thềm rồng đá xanh chạm nổi, hệ cột gỗ lim lớn, đôi câu đối sơn son thếp vàng (*"Từ bi phổ độ chúng sinh giới / Trí tuệ quang minh vạn pháp môn"*), hoành phi *"Hải An Tự"*.
     - **Tầng 2 (Lầu Tàng Kinh / Cổ diêm)**: Hàng cột gỗ lim tầng lầu, lan can con tiện gỗ bao quanh, khung cửa sổ chữ Thọ và hệ mái đao tầng 2 vươn rộng.
     - **Tầng 3 (Thượng điện)**: Lầu vọng tâm linh với 4 mái đao cong vút và đỉnh mái **Lưỡng Long Chầu Pháp Luân** vàng rực ở độ cao `~16.2m`, treo chuông gió đồng ở các góc đao.
   - **Cổng Tam Quan Gác 2 tầng 8 mái đao**: Nâng cấp Cổng Tam Quan thêm tầng gác chuông/khánh cổ kính phía trên lối Trung quan, mái chồng diêm 2 lớp và hai mái phụ Tả/Hữu quan có đầu đao cong vút.
   - **Bảo Tháp Báo Ân 7 tầng (`SevenStoryStupa`)**: Tọa lạc tại `(35.0, 0, -2.5)` cao `~19.5m` với bệ đá bát giác chạm sen, 7 tầng tháp bát giác thu dần lên cao, mỗi tầng có mái ngói đỏ đầu đao treo chuông đồng và khám thờ tượng Phật vàng, đỉnh tháp Cửu trùng vòng Tướng luân và bầu Hồ lô vàng.

2. **Các hoạt động Phật giáo ý nghĩa tham khảo từ chùa thật (`Temple.tsx`, `Grounds.tsx`, `Pond.tsx`, `app/page.tsx`)**:
   - **🎋 Xin Xâm / Gieo Quẻ Từ Bi Đầu Năm (trong Chính điện)**: Đặt ống xâm tre và thẻ quẻ đầu sơn đỏ trên bàn gỗ bên phải bàn thờ chính (`(2.2, 0.98, -19.8)`). Phật tử lắc ống xâm nhận **Quẻ lành Từ Bi — Pháp ngữ đầu năm** (6 quẻ: *Đại An, Đại Cát, Từ Bi, Trí Tuệ, Hiếu Đạo, Tịnh Tâm* kèm kệ thơ 4 câu, lời bàn Phật pháp và việc thiện nên làm) và có thể lưu vào Sổ cầu an.
   - **🎋 Treo Thẻ Gỗ Ước Nguyện Bồ Đề (cạnh Cây đa Bách Linh)**: Dựng **Giá treo thẻ nguyện ước** bằng gỗ lim có mái ngói nhỏ tại `(18.5, 0, 5.2)` với các thẻ gỗ đỏ/vàng đung đưa trong gió. Khi Phật tử viết ước nguyện và ấn treo, thẻ gỗ mới ánh vàng sẽ hiện thêm trên giá treo và lưu vào Sổ cầu an.
   - **🪷 Thả Đèn Hoa Đăng Cầu Nguyện (trên Tâm Liên Hồ & Sông Bát Nhã)**: Thắp sáng đèn hoa sen hồng có ngọn nến lung linh trôi nhẹ trên mặt hồ sen và dòng sông trước chùa kèm lời cầu nguyện bình an.
   - **🏯 Chiêm Bái & Kinh Hành Nhiễu Bảo Tháp Báo Ân 7 Tầng**: Tìm hiểu ý nghĩa **Tứ Trọng Ân** & **Thất Giác Chi** của 7 tầng tháp và thực hành **Đi kinh hành nhiễu tháp** theo chiều kim đồng hồ quanh chân tháp.

3. **Đi thuyền qua Sông Bát Nhã sang Hòn Đảo HSK — Kết nối `https://hoc-hsk.vercel.app/` (`RiverAndHSKIsland.tsx`, `CameraRig.tsx`, `Player.tsx`, `app/page.tsx`)**:
   - **Bến Thuyền Độ Sinh & Sông Bát Nhã (`z = 20..47.5`)**: Cầu tàu gỗ lim có trụ đèn lồng đỏ, biển hiệu *"Bến Thuyền · Đảo HSK"*, dòng sông xanh biếc điểm hoa đăng trôi và con **Thuyền gỗ truyền thống** có mui tre, đèn lồng mũi thuyền và đôi mái chèo động.
   - **Hành trình Đi thuyền (`CameraMode = 'boat'`)**: Khi ấn **⛵ Đi thuyền sang Đảo HSK** (tại Bến thuyền hoặc trên thanh công cụ), nhân vật bước xuống thuyền, thuyền khua mái chèo lướt qua Sông Bát Nhã với góc nhìn điện ảnh ngắm toàn cảnh Đại Hùng Bảo Điện 3 tầng từ mặt sông.
   - **Hòn Đảo HSK (`Đảo HSK · Học Viện Hán Ngữ`, `z = 46.5..68`)**: Cổng chào Đảo HSK, **Lầu Văn Hiến HSK 2 tầng** kiến trúc Á Đông cổ kính giữa rừng đào hồng, bàn đá đọc sách và hộp thoại/cổng dẫn trực tiếp sang trang học tiếng Trung **`https://hoc-hsk.vercel.app/`**.

---

## Các hạng mục cập nhật trước đó (bản v2.2)

1. **Chọn giới tính & 2 hình mẫu nhân vật Phật tử đi chùa (`Player.tsx`, `controls.ts`, `app/page.tsx`)**:
   - Bổ sung chọn nhân vật **Nữ Phật tử** hoặc **Nam Phật tử** ngay tại màn hình chào mừng và trong hộp thoại **Cài đặt**.
2. **Vào Chính điện tự động đi chậm & Thông báo giải thích ý nghĩa (`Player.tsx`, `app/page.tsx`)**.
3. **Khớp chân 2 đoạn (Đùi + Cẳng chân) — Sửa triệt để lỗi ngồi ghế bay lơ lửng & Cải thiện Quỳ lễ, Ngồi thiền, Vái Phật (`Player.tsx`)**.
4. **Animation Quét lá đa, Cầm gáo tưới cây & Thả cá phóng sinh (`Player.tsx`, `Grounds.tsx`, `Pond.tsx`, `app/page.tsx`)**.
5. **Thiết kế lại Lư hương đồng trước Chính điện & Lùi vị trí hợp lý (`IncenseBurner.tsx`, `controls.ts`, `World.tsx`)**.
6. **Thêm 2 Chú Tiểu đi kinh hành quanh chùa & Trò chuyện tương tác (`NoviceMonks.tsx`, `World.tsx`, `app/page.tsx`)**.
7. **Sửa bảng tên không bị cột gỗ che chữ & Tối ưu tốc độ hiển thị cảnh nền lúc mới vào (`Grounds.tsx`, `Lumbini.tsx`, `World.tsx`)**.

## Build & chạy

- `npm install`
- Dev: `npm run dev`
- Build tĩnh (bắt buộc có biến môi trường, không là MẤT multiplayer):
  `NEXT_PUBLIC_MULTIPLAYER_WS_URL=wss://chua-online-temple.hunganhz179.workers.dev/ws npm run build`
- Test nhanh: `node test-v2-unit.js` (116 kiểm tra) + `npx tsc --noEmit` + build.
