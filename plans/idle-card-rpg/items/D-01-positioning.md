# D-01 — Positioning, player and promise

**Status:** proposed — chờ owner chốt · **Kind:** decision · **Blocked by:** —

## Question

Game này dành cho ai, lời hứa một câu là gì, một phiên chơi kéo dài bao lâu, và vì sao người chơi mở lại vào ngày mai?

## What the owner already said (2026-11-09)

- Muốn một sản phẩm lớn hẳn cho Tò He, và chính owner muốn chơi.
- RPG treo máy, farm, nâng cấp, tiến trình lớn; đánh mạnh vào **hệ thống phát triển, tiến trình, nội dung**.
- Nhân vật/quái **thẻ hóa**; va chạm gây sát thương phải có sức nặng.
- Cảm hứng: Summoners War / Epic Seven, võ hiệp / tiên hiệp / Tam Quốc, Hero Wars / Evony / MU, AFK Arena / Idle Heroes.
- **Pixel art**, **fantasy gốc**, **cân bằng auto + quyết định**, **v1 ~1 tuần**.

## Options

### A — "Làng Mây": a floating village and its guardians (recommended)

- Bạn là người giữ một ngôi làng trên mây, vừa gây dựng lại làng, vừa đưa các hộ vệ đi khám phá những hòn đảo lạ.
- **Home = camp**: 3 công trình nhỏ (farm, mine, spring) sản xuất chậm; nâng cấp làng là tiến trình nhìn thấy được.
- **Adventure = sky islands**: mỗi chương là một hòn đảo, mỗi stage là một cụm quái; boss là người giữ đảo.
- **Heroes = guardians**: mỗi hero có một mảnh ký ức, một bond với hero khác; bộ sưu tập có lý do cảm xúc, không chỉ số.
- **Promise**: *"Một RPG thẻ bài treo máy ấm áp nhưng sâu: gây dựng lại Làng Mây, nuôi dưỡng những hộ vệ, và đưa họ ra những hòn đảo trên mây. Mỗi ngày 2–3 phiên ngắn; không quảng cáo, không nạp, không ép giờ."*
- **Session**: 5–10 phút, 2–3 lần/ngày; 20–30 phút khi muốn đẩy chương; idle chest 12 h; không energy.
- **Why it fits Tò He**: ấm, có nhà, có lý do quay lại; idle và base có nghĩa trong truyện; pixel art dễ tạo bản sắc.
- **Cost**: thêm một màn camp + 3 công trình; cần viết một chút lore/bond; art cho làng và đảo.

### B — "Đoàn Thám Hiểm": a roaming company, no home

- Không base; một đoàn hộ vệ đi từ vùng đất này sang vùng đất khác; stage là tuyến đường; idle chest là "doanh trại tạm".
- **Pros**: ít scope hơn; tập trung vào battle/progression; dễ làm nhanh.
- **Cons**: không có "nhà" để quay về; idle chỉ còn một chest; bản sắc yếu hơn; khó tạo cảm giác tiến trình ngoài trận.
- **Promise**: *"Một đội, một con đường, mỗi ngày đi xa hơn."*

### C — "Đấu Trường Cổ": champions of an ancient arena

- Không base; trọng tâm là đội hình, boss gauntlet và bảng thành tích; tông lạnh, cạnh tranh.
- **Pros**: battle-first; hợp người thích min-max; ít art ngoài trận.
- **Cons**: Tò He không có real-time PvP; bảng xếp hạng cần integrity; không có monetization thì động lực cạnh tranh yếu; lệch tông ấm của Tò He.
- **Promise**: *"Đội hình của bạn là câu trả lời."*

## Recommendation

**A — "Làng Mây"**, với một **light camp** (3 công trình, không bày trí, không cướp nhà) chứ không phải base-building đầy đủ.

Lý do:

1. Nó trả lời được cả hai yêu cầu của owner: **tiến trình dài** (camp + hero + gear + chương) và **có lý do quay lại** (làng, chest, daily).
2. Nó khác AFK/Summoners War ở chỗ **có nhà**, không chỉ có màn hình leo stage. Đó là bản sắc Tò He.
3. Nó cho phép pixel art kể chuyện: làng thay đổi theo cấp, đảo có palette riêng, hero có bond.
4. Nó vẫn đủ "sâu" cho người thích hệ thống: đội hình, tốc độ, gear set, star, element.
5. Nó giới hạn scope: camp chỉ 3 công trình; không phải một game thứ hai.

Điều **không** làm ở v1: bày trí làng, nhà của từng hero, cướp tài nguyên, guild, PvP, cốt truyện dài. Làng là **một màn hình**, không phải một mode riêng.

## What it changes

- **D-02**: cần `shell` + E-01 (persistent game); build budget ~4.5 MB; save có camp/heroes/gear.
- **D-04**: battle phải đủ nhẹ để người chơi vào- ra nhanh, nhưng đủ sâu cho first clear/boss.
- **D-05**: 4 hero, 4 role, 4 element; bond là một lớp nhẹ.
- **D-06**: camp level + star + gear; không prestige.
- **D-08**: light camp là meta chính, không phải base-building.
- **D-09**: chương = đảo; boss = người giữ đảo; tower = "tháp trời"; world boss = "bóng tối trên mây".
- **D-13**: card + pixel sprite; camp và đảo có palette riêng.
- **D-14**: tên "Làng Mây" chỉ là working title; cần một buổi đặt tên.

## Evidence

- Genre patterns and what to take/avoid: [R-01](../research/R-01-genre.md).
- Idle chest 12 h, two sessions a day, no energy: [R-02](../research/R-02-progression-economy.md).
- 4-hero readability on a 360 px phone: [R-03](../research/R-03-battle-card-ux.md).
- Platform fit, shell gap, build budget: [R-04](../research/R-04-platform-fit.md).

## Discussion

**owner (2026-11-09):** chọn pixel art, fantasy gốc, cân bằng auto + quyết định, v1 ~1 tuần; thích Summoners War/Epic Seven, võ hiệp, Hero Wars/MU, AFK/Idle Heroes.

**agent (2026-11-09):** recommend A. Nó giữ được "chất" của các game tham chiếu (đội hình, gear, leo stage) nhưng thêm một lý do quay lại mà các game đó không có: một ngôi làng để nhìn thấy lớn lên. Nếu owner muốn thuần battle hơn, B là phương án giảm scope; C không hợp vì thiếu PvP thật và monetization.

**owner:** _chưa trả lời._
