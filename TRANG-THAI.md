# TRẠNG THÁI BẢN SNAPSHOT NÀY (2026-11-04, bản v2.4 — Tối ưu hiệu năng PC mượt mà, Mở rộng 38 Chỗ Ngồi Tọa Thiền & Niệm Kinh, Bảng Xếp Hạng Công Đức 8 Phẩm Vị, Sửa lỗi đi trên sông & Thả cá từ tay)

## Các hạng mục cập nhật trong bản v2.4

1. **Tối ưu hiệu năng 3D trên máy tính PC (`app/page.tsx`, `World.tsx`, `Temple.tsx`, `Grounds.tsx`, `Pond.tsx`, `textures.ts`)**:
   - **Triệt tiêu bão re-render React 5 lần/giây (`app/page.tsx`)**: Trước đây `setInterval(..., 200)` luôn gọi `setPlayerPos({ x: px, z: pz })`, `setSweepProgress`, `setBathProgress` ngay cả khi người chơi đứng yên, khiến toàn bộ cây component React + R3F `<World>` re-render 5 lần/giây. Nay chỉ cập nhật `playerPos` khi đang mở Sơ đồ 2D (`mapOpen`) và di chuyển `> 0.35m`, và chỉ cập nhật tiến trình khi nghi lễ tương ứng đang diễn ra.
   - **Bọc `React.memo` cho toàn bộ các cụm kiến trúc 3D nặng**: `World`, `MainHall`, `TamQuan`, `ChantPavilion`, `WestChantingHall`, `EastChantingPavilion`, `MeritBoardMonument`, `Garden`, `SevenStoryStupa`, `Grounds`, `LotusPond`.
   - **Dùng chung Singleton Procedural Textures (`textures.ts`)**: Cache bộ texture `wood`, `roofTile`, `stone`, `brick`, `grass`, `door` ở cấp module thay vì tạo mới `HTMLCanvasElement` + upload GPU nhiều lần.
   - **Tối ưu ánh sáng, bóng đổ & Distance Culling tượng GLB 276.834 đa giác (`Temple.tsx`, `World.tsx`)**:
     - Giảm từ 5 `pointLight` trong Chính điện xuống 1 `pointLight` trung tâm ấm áp.
     - Tự động ẩn 2 pho tượng quét 3D chi tiết cao (`ShakyamuniPreview` & `KsitigarbhaPreview` — tổng 276k triangles) khi người chơi đang ở ngoài sân xa (`z >= 3.5 || |x| >= 16`).
     - Giới hạn `dpr` trên màn hình PC độ phân giải cao ở mức `[1, 1.35]` kết hợp `powerPreference: 'high-performance'` để tránh quá tải fill-rate trên màn hình 2K/4K và GPU tích hợp.

2. **Mở rộng chùa to, rộng, đồ sộ hơn & Tăng lên 38 Chỗ Ngồi Niệm Kinh (`Temple.tsx`, `Grounds.tsx`, `controls.ts`, `Player.tsx`, `app/page.tsx`)**:
   - **Tả Chung Lâu & Hữu Cổ Lâu 2 tầng (`MainHall`)**: Mở rộng hai bên mặt tiền Đại Hùng Bảo Điện (`x = ±10.6`) với hai lầu chuông – lầu trống 2 tầng mái đao cong vút kết nối bằng hành lang gỗ lim.
   - **Quảng Trường Tiền Đường Đại Bái (`36m × 9.4m`)**: Mở rộng quảng trường đá xanh trước Cổng Tam Quan với phù điêu hoa sen đá chạm nổi đường kính `5.6m` và 6 trụ **Cờ Phướn Phật Giáo Ngũ Sắc**.
   - **38 chỗ ngồi Tọa Thiền & Niệm Kinh (`SEATS`) trải khắp 7 khu vực**:
     - **Đại Hùng Bảo Điện (16 bồ đoàn, `4 hàng × 4 tọa cụ`)**: Kèm 8 bàn **Kinh Án** gỗ lim thấp, sách kinh mở trang vàng và mõ gỗ tụng kinh.
     - **Niệm Phật Đường Tây — Lầu Tụng Kinh Liên Hoa 2 tầng (`WestChantingHall` tại `(-15.5, 0, -16.5)`, 8 bồ đoàn `west-chant-1..8`)**: Lầu gỗ 2 tầng 8 mái đao thờ tượng Phật A Di Đà, đại mộc ngư và 8 tọa cụ hoa sen kèm bàn kinh.
     - **Đài Niệm Kinh Bảo Tháp (`EastChantingPavilion` tại `(35.0, 0, 6.8)`, 6 bồ đoàn `stupa-chant-1..6`)**: Đình gỗ tứ giác mái đao hướng về Bảo Tháp Báo Ân 7 tầng với 6 bồ đoàn và bàn kinh.
     - **8 chỗ ngồi ngoài trời**: Thêm đệm bồ đoàn dưới gốc **Cây đa Bách Linh** (`banyan-mat-1..2`), bên bờ **Tâm Liên Hồ** (`lake-mat-1..2`), ghế gỗ **Hành lang Đông** (`corridor-chair-2..3`) và **Nhà Trà**.
   - Khi ngồi tại bất kỳ vị trí nào trong 38 chỗ ngồi, nhân vật đều ngồi xếp bằng kiết già trên bồ đoàn (hoặc ngồi ghế chuẩn xác) và có ngay nút **📿 Mở Kinh Niệm Phật** kèm hộp thoại **🧘 Chọn chỗ ngồi Niệm Kinh (38)** giúp tự động tìm chỗ trống và bước tới ngồi.

3. **Bảng Xếp Hạng Công Đức & Hệ Thống 8 Phẩm Vị Trong Chùa (`lib/merit.ts`, `Temple.tsx`, `Player.tsx`, `app/page.tsx`)**:
   - **Đài Bia Vàng Công Đức 3D (`MeritBoardMonument` tại `(8.8, 0, -1.2)`)**: Bia đá xanh chạm trán rồng đặt trên lưng rùa đá đội bia (*Quy趺*) dưới lầu tứ trụ mái đao sơn son thếp vàng ngay sân chính.
   - **8 Phẩm Vị Tu Tập**: *Thiện Tín Sơ Tâm (🌱)* → *Phật Tử Tinh Tấn (🪷)* → *Cư Sĩ Tri Khách (📿)* → *Hộ Pháp Thiện Tâm (🎋)* → *Hiền Giả Từ Bi (🏮)* → *Bồ Đề Đạo Hữu (☸️)* → *Trưởng Lão Công Đức (🏯)* → *Liên Hoa Đại Đức (🌟)*. Huy hiệu phẩm vị hiển thị trực tiếp phía trên bảng tên 3D của nhân vật.
   - **Tích lũy Công Đức từ 14 Phật sự**: Dâng hương (`+15`), Tụng kinh niệm Phật (`+30`), Quỳ lễ phát nguyện (`+15`), Phóng sinh cá chép (`+20`), Tắm Phật (`+30`), Quét lá đa (`+25`), Tưới rau (`+20`), Thỉnh đại hồng chung (`+10`), Xin xâm Từ Bi (`+10`), Treo thẻ ước nguyện (`+15`), Thả hoa đăng (`+15`), Kinh hành nhiễu Bảo Tháp (`+25`), Đi thuyền sang Đảo HSK (`+20`), Đàm đạo cùng Chú tiểu (`+10`).

4. **Sửa triệt để lỗi đi bộ được trên sông & Cá phóng sinh bơi ra trực tiếp từ bát trên tay (`controls.ts`, `World.tsx`, `Player.tsx`, `Pond.tsx`)**:
   - **Chặn đi bộ trên Sông Bát Nhã**: Bổ sung hệ thống collider dọc toàn bộ bờ kè đá Sông Bát Nhã (`z >= 22.6` ở hai bên cầu tàu) và mũi cầu tàu (`z >= 23.5`), đồng thời giới hạn mặt phẳng click-to-move ở bờ sông (`z <= 22.3`). Người chơi chỉ có thể bước ra cầu tàu gỗ và lên thuyền sang Đảo HSK.
   - **Thả cá phóng sinh trực tiếp từ bát trên tay người chơi**: Tính tọa độ 3D thực tế (`getWorldPosition`) của chiếc bát sành trên hai bàn tay nhân vật mỗi frame (`releaseState.handPos`), hiển thị đàn cá chép Koi bơi trong bát trên tay người chơi cho tới đúng khoảnh khắc từng chú cá phóng ra từ vành bát theo quỹ đạo dòng nước đáp xuống mặt hồ trước mặt người chơi (`releaseState.waterTarget`).

---

## Các hạng mục cập nhật trước đó (bản v2.3)

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

## Gỡ tính năng chọn chỗ ngồi niệm kinh (2026-11-05)

- **Đã gỡ:** bảng chọn chỗ ngồi tọa thiền & niệm kinh (40 vị trí, lọc theo khu), 4 nút mở bảng (thanh trên, nút 🧘 mobile, menu mobile, nút nhanh desktop) và nút "Tìm chỗ ngồi Tọa Thiền & Niệm Kinh" trong hộp thoại Bảng Vàng (`app/page.tsx`).
- **Lý do (tính năng không hoạt động):** bấm "Đến ngồi niệm kinh" chỉ cho nhân vật đi bộ tự động tới ghế, nhưng trên đường có quá nhiều vật cản (cột, tường, lư hương, hồ sen, bàn ghế) và chưa có tính toán đường đi tránh vật cản tới từng chỗ ngồi, nên nhân vật thường kẹt giữa đường không tới được ghế.
- **Giữ lại:** dữ liệu `SEATS` (`controls.ts`), ngồi thủ công khi tự đi tới gần ghế, nút "Mở Kinh Niệm Phật" khi đang ngồi, bảng Niệm Phật mở bằng phím E ở khu niệm Phật.
- **Muốn khôi phục:** cần tính đường đi tránh vật cản tới từng ghế (waypoint riêng cho từng ghế hoặc pathfinding) rồi mới gắn lại bảng chọn ghế.
