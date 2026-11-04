# TRẠNG THÁI BẢN SNAPSHOT NÀY (2026-11-04, bản v2.2 — 2 nhân vật Nam/Nữ Phật tử, Chú tiểu kinh hành, Lư hương đồng & cải tiến toàn diện Animation/UX)

## Các hạng mục cập nhật trong bản v2.2

1. **Chọn giới tính & 2 hình mẫu nhân vật Phật tử đi chùa (`Player.tsx`, `controls.ts`, `app/page.tsx`)**:
   - Bổ sung chọn nhân vật **Nữ Phật tử** hoặc **Nam Phật tử** ngay tại màn hình chào mừng trước khi bước vào chùa (bên dưới ô nhập tên) và trong hộp thoại **Cài đặt** (lưu `localStorage`).
   - **Nữ Phật tử (`female`)**: Áo lam cổ tàu vạt chéo cài 5 nút vải trắng ngà, huy hiệu hoa sen hồng thêu ngực trái, tà áo xẻ nhẹ, quần lam ống suông, giày vải, chuỗi hạt gỗ trầm, tóc búi gọn cài trâm gỗ.
   - **Nam Phật tử (`male`)**: Dáng vai rộng, Bộ đồ lam cư sĩ nam màu lam xám trầm (`#4d6276`), cổ tàu, nẹp thẳng chính giữa ngực cài 5 nút vải trắng ngà, 2 túi áo cư sĩ đắp nổi phía dưới vạt trước, quần lam sẫm, giày vải, chuỗi hạt gỗ trầm, mái tóc nam cắt ngắn gọn gàng.

2. **Vào Chính điện tự động đi chậm & Thông báo giải thích ý nghĩa (`Player.tsx`, `app/page.tsx`)**:
   - Khi bước qua cửa vào trong Chính điện (`isInHall`), nhân vật tự động giảm tốc độ còn `~52%` với nhịp bước khoan thai, nhẹ nhàng.
   - Hiển thị thông báo khi bước vào Chính điện kèm thanh trạng thái **“🙏 Trong Chính điện: Đang đi chậm rãi, nhẹ bước — Vì sao?”** mở hộp thoại giải thích văn hóa đi chùa truyền thống Việt Nam (*“Đi nhẹ bước êm, nói khẽ mỉm cười”* để giữ sự thanh tịnh nơi thờ Tam Bảo và không làm động tâm người đang lễ bái, tọa thiền).

3. **Khớp chân 2 đoạn (Đùi + Cẳng chân) — Sửa triệt để lỗi ngồi ghế bay lơ lửng & Cải thiện Quỳ lễ, Ngồi thiền, Vái Phật (`Player.tsx`)**:
   - Thiết kế lại chân nhân vật gồm 2 khớp nối tại đầu gối (`legL/R` tại hông + `shinL/R` tại gối), **bỏ hoàn toàn việc ép `body.scale.y`** (vốn làm bẹp đầu và thân nhân vật trước đây).
   - **Ngồi ghế đá / ghế gỗ hành lang / ghế bàn trà ngoài trời**: Hông hạ đúng cao độ mặt ghế (`poseDrop = -0.40m` cho ghế đá/gỗ, `-0.30m` cho ghế Nhà trà), đùi đặt ngang trên mặt ghế, cẳng chân gập vuông góc buông xuống để bàn chân chạm đất tự nhiên — không còn lơ lửng trên không.
   - **Ngồi tĩnh tâm trong Chính điện**: Ngồi xếp bằng (kiết già / bán già) sát trên đệm tọa cụ (`poseDrop = -0.68m`), hai tay chắp búp sen trước ngực.
   - **Quỳ lễ & Vái Phật trong Chính điện**: Đầu gối chạm đệm tọa cụ, cẳng chân duỗi gập ra sau áp mặt chiếu (`poseDrop = -0.42m`), hai tay chắp búp sen nâng nhẹ lên trán kết hợp nhịp **cúi mình vái lễ Tam Bảo** êm dịu theo chu kỳ.

4. **Animation Quét lá đa, Cầm gáo tưới cây & Thả cá phóng sinh (`Player.tsx`, `Grounds.tsx`, `Pond.tsx`, `app/page.tsx`)**:
   - **Quét lá đa (`Grounds.tsx`, `Player.tsx`)**: Thay chuyển động chọc chổi trước-sau cũ bằng **động tác hai tay nắm cán chổi tre đưa ngang từ phải sang trái (`latArc`)** kết hợp xoay nhẹ eo và vai như quét sân thật.
   - **Cầm gáo đi tưới cây (`Player.tsx`, `Grounds.tsx`, `app/page.tsx`)**: Khi ấn *Múc nước*, chiếc gáo gỗ đầy nước tại luống cạn sẽ gắn trực tiếp vào bàn tay phải để người Phật tử **cầm gáo nước đi bộ** tới luống rau; khi ấn *Tưới rau*, nhân vật nghiêng gáo đưa qua lại tưới dòng nước mát kèm thanh tiến trình trực quan.
   - **Thả cá phóng sinh & Vẽ lại cá chép Koi (`Pond.tsx`, `Player.tsx`, `app/page.tsx`)**:
     - Khi ấn thả `1`, `2` hoặc `3` chú cá, nhân vật đứng bên bờ hồ hơi khuỵu gối, hai tay nâng **bát sành đựng cá phóng sinh** nghiêng nhẹ xuống mặt hồ; **đúng số lượng cá chép (`1`, `2` hoặc `3` con)** phóng theo đường vòng cung nước từ bát xuống hồ tạo vòng sóng lan tỏa rồi nhập vào đàn cá bơi trong hồ.
     - Vẽ lại mô hình **cá chép Koi** đa đốt thân uốn lượn mềm mại, đầu bo tròn có đôi râu cá chép, mắt viền vàng, vây lưng, đôi vây ngực quạt nước và đuôi kép xòe quạt.

5. **Thiết kế lại Lư hương đồng trước Chính điện & Lùi vị trí hợp lý (`IncenseBurner.tsx`, `controls.ts`, `World.tsx`)**:
   - Dời vị trí lư hương lùi nhẹ về phía thềm Chính điện (`z = -2.65`, trước đây `z = -2.2`) để lối đi ngang sân trước thoáng đãng mà vẫn giữ đúng vị trí truyền thống trước cửa Tam Bảo.
   - Dựng lại mô hình **Đỉnh đồng / Lư hương 3 chân hổ phù** trên bệ đá xanh chạm sen 3 cấp, bầu lư đồng hun tròn chạm nổi lưỡng long chầu mặt nguyệt, đôi tai lư vân mây uốn cong, lớp tro hương mịn và chân nhang đỏ.

6. **Thêm 2 Chú Tiểu đi kinh hành quanh chùa & Trò chuyện tương tác (`NoviceMonks.tsx`, `World.tsx`, `app/page.tsx`)**:
   - Bổ sung **Chú tiểu Tâm An** (đi kinh hành khu vực sân Tây, Tâm Liên Hồ, Gác Chuông, Vườn Lâm Tỳ Ni) và **Chú tiểu Tâm Minh** (đi kinh hành khu vực sân Đông, Cây đa Bách Linh, Vườn Lộc Uyển, Nhà Trà).
   - Khi người chơi đến gần (`< 3.0m`) hoặc chạm vào chú tiểu, chú tiểu dừng bước, xoay người hướng về phía Phật tử, chắp tay xá chào và mở hộp thoại trò chuyện:
     1. *Quy tắc & nét đẹp khi đi chùa thật* (cách đi cổng Tam Quan, bước qua bậu cửa gỗ, thắp hương vừa đủ, giữ oai nghi).
     2. *Một ngày tu học ở chùa của chú tiểu* (công phu khuya, chấp tác quét lá, tưới rau, học kinh).
     3. *Xin một lời nhắn nhủ bình an hôm nay* (lời nhắc chánh niệm, hiếu kính cha mẹ — có thể lưu vào Sổ cầu an).
     4. *Nhờ chú tiểu chỉ đường* đến từng khu vực trong chùa.

7. **Sửa bảng tên không bị cột gỗ che chữ & Tối ưu tốc độ hiển thị cảnh nền lúc mới vào (`Grounds.tsx`, `Lumbini.tsx`, `World.tsx`)**:
   - Đưa 2 trụ gỗ của toàn bộ biển hiệu (*Cây đa Bách Linh*, *Tâm Liên Hồ*, *Vườn Lộc Uyển*, *Vườn Lâm Tỳ Ni*) ra ngoài mép bảng chữ (`postX = width * 0.5 + 0.14`) để không che khuất bất kỳ nét chữ nào.
   - Bọc riêng `<GuanyinGLB />` trong `<Suspense fallback={null}>` tại `World.tsx` để việc tải file GLB tượng Phật nghìn mắt nghìn tay trong điện không bao giờ chặn việc hiển thị ngay lập tức khung cảnh sân chùa, Cổng Tam Quan và bầu trời phía sau màn hình nhập tên.

## Build & chạy

- `npm install`
- Dev: `npm run dev`
- Build tĩnh (bắt buộc có biến môi trường, không là MẤT multiplayer):
  `NEXT_PUBLIC_MULTIPLAYER_WS_URL=wss://chua-online-temple.hunganhz179.workers.dev/ws npm run build`
- Test nhanh: `node test-v2-unit.js` (116 kiểm tra) + `npx tsc --noEmit` + build.

## 2026-11-04: repo chuyển sang public, Vercel tự deploy
- Repo `haianhant/chua-online` chuyển từ private sang public lúc ~16:50 ngày 2026-11-04 (user tự đổi trong Settings) để Vercel gói Hobby deploy được commit của collaborator.
- Commit này chỉ để kích hoạt một production deploy mới với cấu hình framework Next.js (deploy git trước đó build lúc project chưa cài framework nên lên live bị 404).
