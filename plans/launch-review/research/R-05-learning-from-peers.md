# R-05 — Học từ miniblox.io và các sản phẩm cùng loại, cùng giá trị

- Date: 2026-10-22 · Feeds: D-03 (tính năng trước launch), D-02 (nội dung ba mục)
- **[đã kiểm]** = đọc hôm nay. **[chưa kiểm]** = hiểu biết chung, hoặc blog bên thứ ba. Các site trò chơi đều là app JS, nên
  phần lớn chỉ đọc được HTML tĩnh, manifest, `robots.txt`, `llms.txt`, sitemap và chính sách.

## Question

Owner (2026-10-22): "có trang https://miniblox.io/, tôi chưa xem kỹ, nhưng research xem ta có thể học hỏi gì từ nó hay sản
phẩm tương tự để chốt plan nâng cấp sắp tôi, thoải mái đề xuất mạnh cho tôi".

## Findings

### miniblox.io và dòng game ".io"

- **miniblox.io** **[đã kiểm]**
  - Là gì: game khối kiểu Minecraft trên trình duyệt (WebGL), 17 chế độ chơi.
  - Lời mời gọi: "No download, no sign-up, unblocked at school". Tài khoản là tuỳ chọn, để giữ tiến độ.
  - SEO: mỗi chế độ có một trang tĩnh `/game/<slug>`, sinh lúc build, dịch sang `/es/ /pt-br/ /fr/ /de/ /ru/`. Có trang nhắm
    đúng ý định tìm kiếm của học sinh (`/game/unblocked`, `/game/school`, `/game/chromebook`). `robots.txt` mời AI crawler
    và trỏ tới `llms.txt`.
  - Vào bằng link: `/join/<code>` nằm nguyên trên thanh địa chỉ suốt ván.
  - Đăng nhập: Discord, Google.
  - **Sống bằng quảng cáo dày đặc**: video preroll (AdinPlay), quảng cáo tự chạy đè lên góc màn chơi (chú thích trong code:
    "Revisit 540px against session length once revenue is stable"), AdSense, Google Analytics, SDK của CrazyGames.
  - Chính sách quyền riêng tư là mẫu chung (2026-08-26): cookie quảng cáo DoubleClick, có thể hỏi địa chỉ và số điện thoại;
    phần đã đọc không nói gì tới trẻ em.
  - Manifest: `display: fullscreen`, `orientation: landscape`.
  - Nguồn: https://miniblox.io/llms.txt, https://miniblox.io/sitemap.xml, https://miniblox.io/robots.txt,
    https://miniblox.io/privacy, https://miniblox.io/game/skywars
- **bloxd.io**: "No downloads, no login!", PWA `standalone` — https://bloxd.io/manifest.json **[đã kiểm]**.
- **krunker.io**: AdSense; điều khoản đòi **từ 13 tuổi**, có nội dung người dùng tạo và mua bằng tiền thật — https://krunker.io/docs/privacy.txt **[đã kiểm]**.
- **skribbl.io** **[đã kiểm]** (https://skribbl.io/)
  - Trang chủ là **một thẻ duy nhất**: tên, avatar, ngôn ngữ, rồi "Play!" hoặc "Create Private Room".
  - Phòng riêng: cài đặt (2–20 người, số vòng, thời gian), link mời "Click to copy", nút Bắt đầu.
  - Công cụ kiểm duyệt: chủ phòng đá và cấm người; bỏ phiếu đá; tắt tiếng; báo cáo. Có câu "not responsible for any user
    generated content". Có quảng cáo.

### Cùng giá trị với Tò He

- **Lichess** **[đã kiểm]** (https://lichess.org/about, https://lichess.org/page/kid-mode)
  - "Powered by volunteers and donations".
  - Không quảng cáo, không theo dõi: "never will". Mã nguồn mở; dịch qua Crowdin; có chế độ cho người khiếm thị.
  - **Kid Mode**: đối thủ chỉ gửi được nước đi; trẻ chỉ nhắn được cho lớp và giáo viên; chặn diễn đàn, blog, stream; có mặt
    cười trên mọi trang; chỉ người có mật khẩu mới tắt được.
  - **[chưa kiểm]**: trang chủ có lưới "chơi nhanh", "Chơi với bạn" (link và QR), câu đố hằng ngày; người ủng hộ chỉ được
    huy hiệu.
- **Board Game Arena**: miễn phí gần hết; Premium tạo được bàn của game Premium, người miễn phí vào chơi được —
  https://boardgamearena.com/faq. **[chưa kiểm]** Bàn chơi theo thời gian thực hoặc **theo lượt, kéo dài nhiều ngày**.
- **Gartic Phone** **[chưa kiểm, blog]**: mở link mời thì thấy "You've been invited to join a room", chọn avatar và tên rồi
  vào; có QR.
- **Jackbox** **[chưa kiểm, blog]**: **một màn hình chung** (TV) hiện mã phòng 4 chữ; điện thoại vào `jackbox.tv` làm tay
  cầm; người đến muộn làm khán giả; có chế độ gia đình.
- **ZingPlay** (Tiến Lên ở Việt Nam): tài khoản mới được 30.000 "vàng"; phòng chia theo **mức cược**; có giải đấu, sự kiện
  hằng ngày — https://fptshop.com.vn/tin-tuc/giai-tri/zingplay-175383, https://hoanghamobile.com/tin-tuc/?p=344156.
  **[chưa kiểm]** Cũng thường thấy: số dư xu ở đầu màn, xu khi đăng nhập mỗi ngày, cấp VIP, ném đồ ở bàn. Người chơi quen
  luật miền Nam: chặt heo, tới trắng.
- **Khan Academy Kids**: "100% free with no ads or subscriptions", tải về chơi offline —
  https://apps.apple.com/us/app/khan-academy-kids/id1378467217, https://www.khanacademy.org/kids **[đã kiểm]**.
- **Duolingo Family Quest** **[chưa kiểm, newsletter]**: cả nhà góp chung một mục tiêu, hợp tác chứ không thi đua.
- **Discord Activities**: chơi ngay trong cuộc gọi — https://discord.com/blog/server-activities-games-voice-watch-together **[đã kiểm qua kết quả tìm kiếm]**.

### Tò He hôm nay (code, 2026-10-22)

| Đã có | Nguồn |
|---|---|
| Trang công khai cho từng game, `llms.txt`, sitemap | `apps/web/src/pages/games/[id].astro`, `llms.txt.ts` |
| Link mời `/s/…`, mã bàn `/r/…`, thẻ xem trước | ADR 0044 |
| QR ở màn bàn chơi | `apps/hub/src/pages/RoomPage.tsx` |
| Bot lấp ghế trống (`BotsFill`), bot đánh thay người rớt mạng (`BotsTakeOver`), có mức độ khó | `services/api/src/Tohe.Api/Modules/Rooms/RoomActor.cs:179-181` |
| Xem bàn (khán giả), quyền của chủ bàn | `RoomsModule.cs:194`, ADR 0016 |
| Emote ở bàn | `packages/game-sdk/src/reactions.ts` |
| "Thách bạn" (cùng seed, vượt điểm) | ADR 0045 |
| Hồ sơ trẻ em, mã quản lý của bố mẹ, công tắc "Chơi online với người ngoài" | ADR 0023, 0043 |

**Chưa có**: thử thách hằng ngày, bàn cố định của gia đình, màn hình chung, bàn theo lượt kéo dài nhiều ngày, lời hứa "không
bao giờ" thành một trang. Hồ sơ trẻ em có hiện trên bảng xếp hạng công khai không: **cần kiểm**.

## So what

- **Tò He có một thứ mà cả dòng game ".io" không nói được: "không quảng cáo".** Họ dẫn đầu bằng "không tải, không đăng nhập";
  Tò He nói được cả ba: "Không quảng cáo · Không cần tài khoản · Chơi ngay".
- Phần lớn "mẫu chơi cùng" của skribbl, Gartic, BGA (bot, QR, xem bàn, chủ bàn) **đã có ở tầng API** — cái thiếu là cách
  trình bày: mục Chơi cùng (D-02) nên là một thẻ hai, ba hành động to, như skribbl.
- Những gì dòng game này làm để giữ người — xu, mức cược, VIP, quà đăng nhập, vòng quay, quảng cáo đè màn chơi, chat với
  người lạ — **là đúng những gì Tò He đã hứa không làm.** Không chép.
- Hướng đi riêng cho gia đình Việt, chưa ai làm tốt: **bàn của gia đình**, **màn hình chung** (Tết, cả nhà quanh TV), **thử
  thách hằng ngày cho cả nhà**, **bàn theo lượt cho gia đình ở xa**.
