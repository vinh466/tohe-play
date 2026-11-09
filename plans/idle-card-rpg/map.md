# Map — RPG thẻ bài treo máy

Mỗi item là một quyết định mà mục tiêu phụ thuộc vào, cùng thứ tự phụ thuộc. Cạnh `A --> B` đọc là "quyết A trước B". Trạng thái nằm ở [PLAN.md](PLAN.md); trang này giữ hình dạng của plan.

```mermaid
flowchart TD
  D01 --> D02[D-02 Platform fit]
  D01 --> D04[D-04 Core loop & battle]
  D02 --> D17[D-17 Platform extension package]
  D17 --> D03[D-03 Nền tảng kỹ thuật]
  D17 --> E01[E-01 Persistent shell]
  D17 --> D16[D-16 Scope, phasing & wireframes]
  D04 --> D03
  D04 --> D05[D-05 Card/character core]
  D05 --> D06[D-06 Progression]
  D06 --> D07[D-07 Economy & idle rewards]
  D04 --> D08[D-08 Meta: codex, bonds, rank (no home)]
  D06 --> D08
  D04 --> D09[D-09 Content framework]
  D05 --> D09
  D06 --> D09
  D07 --> D10[D-10 Daily & live structure]
  D09 --> D10
  D03 --> D11[D-11 Content pipeline]
  D09 --> D11
  D05 --> D12[D-12 UX: one board + panels]
  D08 --> D12
  D10 --> D12
  E01 --> D12
  D01 --> D13[D-13 Art direction & battle feel]
  D05 --> D13
  D12 --> D13
  D03 --> E03[E-03 FX player]
  D13 --> E03
  D01 --> D14[D-14 World, road & name]
  D12 --> D15[D-15 Audio, haptics & feel]
  D13 --> D15
  D04 --> D16
  D07 --> D16
  D10 --> D16
  D12 --> D16
  D13 --> D16
```

## Items

| ID | Câu hỏi / thay đổi | Vì sao mục tiêu cần | Blocks |
|---|---|---|---|
| D-01 | Game dành cho ai, lời hứa một câu, một phiên chơi dài bao lâu, "treo máy" nghĩa là gì, vì sao mở lại ngày mai? | Mọi lựa chọn battle, progression, UX và art đều bám vào đây | D-02, D-04, D-13, D-14 |
| D-02 | Game này sống được trong giới hạn Tò He (64 KB save, build budget, offline, không server logic) hay cần thay đổi nền tảng? | Quyết định trước khi thiết kế hệ thống để không vẽ ra thứ không chạy được | D-17, E-01 |
| D-03 | Engine/render (Phaser, DOM/React, hybrid), cách tách logic/view, save schema & migration, dữ liệu nội dung | Là nền để làm game lớn, nhiều nội dung, sửa lâu dài | D-11, E-03 |
| D-04 | Vòng lặp chính: auto normal + auto-cast skill (toggle manual), nhịp trận, thắng/thua/thử lại | Là trục gameplay; quyết trước mọi hệ thống khác | D-03, D-05, D-08, D-09, D-16 |
| D-05 | Nhân vật là thẻ: 6 hero/3 hàng, vai trò, hệ, rarity, kỹ năng, đội hình, cách thẻ tương tác | Là đơn vị nội dung và sức mạnh; quyết định độ sâu của battle | D-06, D-09, D-12, D-13 |
| D-06 | Các trục phát triển (company level, sao, gear, skill…), đường cong và cảm giác mạnh lên | Là điểm mạnh chính theo yêu cầu của owner | D-07, D-08, D-09 |
| D-07 | Nguồn/thu nhập tiền tệ, chỗ tiêu, phần thưởng offline, cap và nhịp tiến trình | Quyết định game có "đã" khi quay lại hay không, và có bị grind vô nghĩa | D-10, D-16 |
| D-08 | Lớp meta ngoài trận: codex, bonds, company rank, records; **không nhà** | Tạo lý do quay lại ngoài màn đánh; là chỗ mở rộng nội dung | D-12 |
| D-09 | Khung nội dung: 4 vùng × 12 stage, dungeon, boss, event, chế độ phụ; schema dữ liệu | Để thêm nội dung hàng tháng mà không sửa core | D-10, D-11, D-16 |
| D-10 | Nhịp hằng ngày: nhiệm vụ, daily, offline return, streak không gây áp lực; có live/event không | Quyết định retention và cách game tôn trọng thời gian người chơi | D-12, D-16 |
| D-11 | Cách viết/thêm hero, stage, event: data-driven, validate, balance sim, asset packs | Là điều kiện để "nội dung mở rộng được" — mục tiêu cốt lõi | — |
| D-12 | Screen map, navigation, bố cục: **một bàn đánh bài + panel mở trên đó**; dock, sheet, pause | Biến hệ thống thành sản phẩm dùng được; đầu ra wireframe | D-13, D-15, D-16 |
| D-13 | Art direction: thẻ, pixel art, khung thẻ, animation, hiệu ứng va chạm, damage number, readability | Là yêu cầu trực tiếp của owner và quyết định pipeline asset | D-15, D-16 |
| D-14 | Thế giới, thème, tên game, tông kể chuyện; con đường và các vùng đất | Tạo bản sắc và chất liệu cho hero/quái/nội dung | — |
| D-15 | Âm thanh, haptics, rung/feedback khi đánh; **chỉ SFX**, không music | Hoàn thiện cảm giác "sát thương có sức nặng" trên phone | D-16 |
| D-16 | v1 gồm gì: 4 vùng × 12, 16 hero, 16 quái, 4 boss, 1 event; thứ tự build, bộ wireframe | Chốt phạm vi để plan graduate được, không mở vô hạn | — |
| D-17 | Gói platform extension: P0 (shell/assets/save), P1 (+ content packs), P2 (full); không music | Owner chọn mở rộng nền tảng trước; cần chốt cái gì là đủ cho bản chơi được | D-03, E-01, D-16 |
| E-01 | Thêm `persistent` vào shell của game-kit: bỏ "Ván mới", giữ Chơi tiếp/Menu chính | Một RPG là thế giới persistent, không phải một ván; shell hiện tại sẽ hiện nút reset sai | D-12 |
| E-03 | Kit FX player cho sprite sheet + act timing (pixelfx) | Board cần hit-stop/shake/push theo effect; kit chưa có player | D-16 |

## Considered and left off

- **Base/camp/làng**: owner chọn Đoàn Thám Hiểm, không base. Caravan chỉ là home screen + idle-fiction, không phải base-building.
- **Real-time PvP / arena đồng bộ**: nền tảng chỉ có rooms turn-based; idle RPG không cần. Nếu sau này muốn async arena, đó là item mới.
- **Chat, guild, social feed**: ngoài non-goals của Tò He.
- **Monetization, energy gate, gacha bằng tiền thật**: bị cấm bởi vision; mọi cơ chế summon phải dùng tiền tệ kiếm trong game.
- **Native app / 3D**: PWA + 2D là đủ và phù hợp giới hạn build.
- **Server-authoritative battle**: không cần cho single-player; save/score đi qua hub.
- **Kịch bản chi tiết từng chương**: plan chốt khung; nội dung cụ thể viết ở giai đoạn sau.
- **Content packs ngay từ v1**: để P1 sau khi loop được chứng minh; v1 đi bằng immutable build + data-driven content.
