# Brief — RPG thẻ bài treo máy (working title)

Status: **draft** — chờ owner xác nhận. Plan rời *Frame* khi brief được chốt.

## Why

- Tôi muốn một sản phẩm lớn hẳn cho Tò He, và chính tôi muốn chơi nó.
- Nó là **RPG treo máy**: farm, nâng cấp, có tiến trình đủ lớn để cảm giác "lớn lên" rõ ràng.
- Điều tôi muốn đánh mạnh nhất là **hệ thống phát triển, tiến trình và nội dung** — không phải chỉ một vòng lặp vui rồi hết.
- Hình ảnh: nhân vật, quái, kỹ năng được **thẻ hóa**; khi đánh nhau, hiệu ứng va chạm/ra đòn phải làm **sát thương có sức nặng**, dễ đọc trên phone.
- Cảm hứng đến từ các game trên điện thoại. Người chơi chính là **phone**, không phải desktop.
- Giai đoạn này chỉ **planning và wireframe**. Đi chậm, bóc từng vấn đề, research các sản phẩm đã có, brainstorm rồi chốt với owner. Chưa viết code game.

## Owner's answers — 2026-11-09

Năm câu hỏi gốc, ghi nguyên lựa chọn:

| Câu hỏi | Owner chọn |
|---|---|
| Game tham chiếu | **Summoners War / Epic Seven** (turn-based sâu, gear/runes), **Võ hiệp / tiên hiệp / Tam Quốc** (auto-farm, thẻ tướng, cảnh giới), **Hero Wars / Evony / MU** (meta nặng, nhiều hệ thống farm), **AFK Arena / Idle Heroes** (idle, đội hình, leo stage) |
| Hướng art | **Pixel art** |
| Thế giới & thème | **Fantasy gốc** (thế giới riêng, tự do thiết kế phe phái/quái/lore) |
| Idle hay active | **Cân bằng**: auto-battle là chính, nhưng có vài quyết định trong trận (đội hình, skill, mục tiêu) |
| Độ lớn v1 | **Khoảng 1 tuần** nội dung gắn bó |

Đọc ra từ các lựa chọn:

- Owner thích **chiều sâu hệ thống** (gear, đội hình, nhiều trục nâng cấp) chứ không chỉ game giải trí nhanh.
- Nhưng v1 chỉ ~1 tuần, nên phải chọn **ít trục nhưng sâu**, không bê nguyên 8 hệ thống của game live-service.
- Pixel art + fantasy gốc cho phép tự sản xuất asset, kiểm soát build size, và tạo bản sắc riêng thay vì bám IP.
- "Cân bằng" là điểm khó nhất: auto để farm idle, nhưng trận đáng ra quyết định phải có chỗ cho người chơi can thiệp.

## Constraints in force

Từ nền tảng Tò He (spec hiện tại):

- Không ads, không in-app purchase, không tracking. Không có cơ chế monetization.
- **Offline-first**: chơi được khi mất mạng; save và score đồng bộ sau. Save tối đa **64 KB** mỗi game; build mặc định **3 MB** (`sizeBudgetKb` khai báo được, nhưng là một quyết định của plan).
- Game chạy trong sandbox, chỉ nói chuyện với hub qua Game Contract; không gọi API riêng, không tự dùng localStorage/IndexedDB/cookie.
- Không có server-authoritative gameplay. Save conflict: last write wins. Server chỉ giữ save, score, rooms và ranked replay.
- Asset đi qua Studio packs (ADR 0051, 0053); build phải mang theo pack đã khai báo.
- Phone-first: portrait, một tay, màn hình nhỏ; phải chạy tốt trên máy tầm trung. Hỗ trợ light/dark, vi/en.
- Đây là plan space: chỉ quyết định và wireframe, không implement.

## Done when

- Brief này được owner xác nhận.
- Mọi quyết định nền tảng được `decided` / `deferred` / `dropped`: định vị, platform fit, core loop/battle, card core, progression, economy, meta, content framework, UX/navigation, art direction, tech foundation, scope.
- Có **screen map + navigation** và **wireframe** cho các màn hình chính, đủ để một người khác dựng được flow.
- Có **khung nội dung** và kế hoạch nội dung đầu tiên (hero, chương, chế độ) chứng minh nền tảng mở rộng được.
- Có graduation list: ADR/docs/PR cần làm để bước sang implementation.

## Not this plan

- Viết code game, sản xuất art/audio hàng loạt, build thật.
- Thay đổi backend, trừ khi một khoảng trống của nền tảng làm mục tiêu bất khả thi — khi đó là một E item + ADR riêng.
- Monetization, real-time PvP, chat/social feed, native app.
- Nội dung chi tiết của từng chương/hero ở mức kịch bản; plan chỉ chốt **khung** để viết nội dung sau.
