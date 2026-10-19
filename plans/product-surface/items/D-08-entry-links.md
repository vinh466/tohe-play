# D-08 — Lối vào: một mô hình cho mọi link mời và link chia sẻ

- Status: **proposed** (2026-10-19)
- Kind: decision — module mới ở API, đường ống ở hub, thêm vào Game Contract → ADR
- Blocks: E-03 · Blocked by: D-06, D-07
- Research: [R-05](../research/R-05-identity-and-entry-prior-art.md), [R-03](../research/R-03-pwa-install-newcomer.md)

## Vì sao

Owner (2026-10-19): "với game cần khả năng mời người khác vào lobby trong game, thì link có thể giúp user và đúng lobby cần
đó, với game dạng 1 user muốn share cho người khác thì link share sẽ giúp user tiếp cận game"; "luồng mời user cần được
luôn quan tâm, hub phải đảm bảo luồng auth user hay profile sẳn sàng trước, các game cũng phải quan tâm luồng user khi vào
game và đến nơi game muốn".

Hôm nay mỗi lối vào tự làm một kiểu: `/r/<code>` (bàn, bắt account), `/register?invite=` (mã cộng đồng), `/play/<id>`
(không biết ai rủ), mời bằng ID (trong app). Game không có cách nào được mở thẳng vào một chỗ bên trong nó, và không tự tạo
link được (game không gọi mạng).

## Đề xuất

### 1. Mọi lối vào là một **ý định** (entry intent)

| Loại | URL | Ai tạo | Đưa tới | Bậc tối thiểu (D-06) | Ai xử lý chỗ đến |
|---|---|---|---|---|---|
| `site` | `/`, `/tro-choi/<slug>` | công khai | trang giới thiệu, trang game | — | trang tĩnh |
| `game` | `/play/<gameId>` | ai cũng được | menu của game | `identity.play` của game | hub mở game |
| `room` | `/r/<mã 6 số>` (đã có) | người ở bàn | sảnh của đúng bàn đó | max(`identity.rooms`, luật của bàn) — mặc định `named` | hub (sảnh do hub vẽ, ADR 0016) |
| `share` | `/s/<mã>` (mới) | game, qua hub | game, kèm một **đích bên trong game** (thử thách cùng seed, một màn, "vượt điểm của tôi") | `identity.play` | **game** (`init.entry`) |
| `community` | `/register?invite=` (đã có) | admin | đăng ký vào một cộng đồng | tạo account | hub |
| `profile` | trong app, ID 12 số (ADR 0033) | account | lời mời trên danh mục | `account` | hub |

Mọi link có một **mã gõ được** (mã bàn 6 số, mã chia sẻ 8 ký tự): iPhone không mở app đã cài từ link (link luôn mở
Safari, storage riêng — R-03), nên người đã cài app cần ô "Nhập mã" trong app.

### 2. Link chia sẻ là một **đối tượng**, không chỉ là URL (như link mời của Discord)

```mermaid
erDiagram
  PROFILE ||--o{ SHARE_LINK : "tạo (hồ sơ máy hoặc tài khoản)"
  SHARE_LINK ||--o{ ENTRY_COUNT : "đếm theo ngày"
  SHARE_LINK {
    string code "8 ký tự Crockford base32, gõ được"
    string kind "game | share"
    string game_id
    string game_version "bản lúc tạo — game tự quyết có mở được không"
    json payload "≤ 2 KB, game tự kiểm (dữ liệu không tin được)"
    string requires "any | named | account"
    timestamp expires_at "mặc định 30 ngày"
    int max_uses "tuỳ chọn"
    timestamp revoked_at "người tạo hoặc admin"
  }
  ENTRY_COUNT {
    date day
    int opened
    int played
    int signed_up "phễu D-04 — số tổng, không ai cụ thể"
  }
```

### 3. Một đường ống ở hub cho mọi lối vào

```mermaid
flowchart TD
  url([Link · QR · mã gõ tay]) --> resolve["1 · Giải mã: URL → ý định<br/>mã bàn / mã chia sẻ → hỏi API"]
  resolve --> valid{Còn dùng được?}
  valid -- "hết hạn, bàn đóng,<br/>game ẩn với tuổi này" --> dead["Ngõ cụt có lối ra:<br/>“Bàn đã đóng — chơi với bot?”"]
  valid -- được --> keep["2 · Giữ ý định<br/>(URL + IndexedDB) qua đăng nhập,<br/>OAuth, mã email, điều khoản, cài app"]
  keep --> ctx{"3 · Đang trong WebView<br/>Zalo/Messenger?"}
  ctx -- có --> hint["Gợi ý “Mở bằng trình duyệt”<br/>(không chặn)"] --> gate
  ctx -- không --> gate["4 · Cổng định danh (D-06)<br/>bậc = max(game, tính năng, bàn/link)"]
  gate --> prof["5 · Hồ sơ sẵn sàng:<br/>chọn hồ sơ · công tắc trẻ em ·<br/>điều khoản nếu account mới"]
  prof --> launch["6 · Mở: sảnh bàn (hub)<br/>hoặc game với init.entry"]
  launch --> route{"7 · Game tới đích?"}
  route -- handled --> done([Đang ở đúng chỗ])
  route -- "unsupported / invalid" --> fallback["Menu của game +<br/>“Bản game này chưa mở được lời mời”"]
  done --> after["8 · Sau đó: đếm phễu,<br/>nhắc cài app / giữ tiến độ đúng lúc"]
```

### 4. Ba luồng tiêu biểu

**Người mới được rủ vào bàn qua Zalo** (iPhone, chưa có gì):

```mermaid
sequenceDiagram
  actor N as Người mới
  participant Z as Zalo (WebView)
  participant H as Hub (Safari)
  participant API
  N->>Z: chạm link toheplay.io.vn/r/482913 (thẻ xem trước: "Lan mời bạn vào bàn Tiến Lên")
  Z->>H: dải "Mở bằng trình duyệt" → Safari
  H->>API: GET bàn theo mã 482913
  API-->>H: Tiến Lên, 2/4 ghế, luật bàn "Ai có link cũng vào" (named)
  H->>N: một màn: tên gợi ý "Mèo Cam" + hình → "Vào bàn"
  H->>API: tạo hồ sơ máy (proof-of-work) + ngồi ghế
  API-->>H: khoá thiết bị (cookie), ghế 3
  H->>N: bàn chơi — không email, không mật khẩu
  Note over H,N: sau ván: "Giữ tiến độ & chơi trên máy khác?" → Google một chạm (D-07 S1)<br/>và "Thêm Tò He vào màn hình chính" (hướng dẫn iOS 26)
```

**Một người chơi chia sẻ thử thách** (game một người):

```mermaid
sequenceDiagram
  actor A as Lan (đang chơi)
  participant G as Game (iframe)
  participant H as Hub
  participant API
  actor B as Bạn của Lan
  A->>G: "Thách bạn" sau ván 2048 điểm
  G->>H: share { kind: "share", payload: { seed, target: 2048 }, text }
  H->>H: hồ sơ của Lan đủ bậc để tạo link? (named — trẻ em cần công tắc của chủ account)
  H->>API: tạo link → mã K7Q2-M9XA
  H->>A: bảng chia sẻ của máy (Zalo, Messenger, chép link, QR)
  B->>H: mở toheplay.io.vn/s/K7Q2M9XA
  H->>API: giải mã → game, payload, requires
  H->>H: cổng định danh: any → hồ sơ máy lặng lẽ
  H->>G: init.entry { kind: "share", payload: { seed, target: 2048 }, from: "Lan" }
  G->>H: entry { result: "handled" }
  G->>B: "Lan đạt 2048 — đến lượt bạn" (cùng seed)
```

**Game xin nâng bậc giữa chừng** (bật xếp hạng khi đang là hồ sơ máy):

```mermaid
sequenceDiagram
  actor U as Người chơi (hồ sơ máy)
  participant G as Game
  participant H as Hub
  U->>G: chạm "Lên bảng xếp hạng"
  G->>H: identity.require("account", "ranked")
  H->>U: tờ đăng nhập (Google một chạm · email)
  alt người chơi đồng ý
    U->>H: Google
    H->>H: D-07: hồ sơ máy → hồ sơ tài khoản (giữ id)
    H->>G: result ok + settings/profile mới (kind: account)
    G->>U: chơi tiếp, run này được xếp hạng
  else bỏ qua
    H->>G: result not ok
    G->>U: chơi tiếp như cũ, không xếp hạng
  end
```

### 5. Ai làm gì

| Bên | Trách nhiệm |
|---|---|
| **Hub** | giải mã link, giữ ý định qua mọi bước, cổng định danh, hồ sơ sẵn sàng (chọn hồ sơ, trẻ em, điều khoản), mở sảnh/game, ngõ cụt có lối ra, bảng chia sẻ của máy + QR, ô "Nhập mã", nhắc đúng lúc |
| **Game** | khai báo `identity` và `entries` trong `game.json`; nhận `init.entry`, tới đích hoặc về menu; trả `entry.result` trong vài giây; xin `identity.require` / `share` qua hub; **không** tự đăng nhập, không gọi mạng |
| **Kit** (`@tohe/game-kit`) | `createShell` có sẵn đường đi mặc định: có `init.entry` thì bỏ màn tiêu đề và tới đích; không hiểu thì về menu kèm thông báo |
| **API** | module `Links` (tạo, giải mã, hết hạn, giới hạn, thu hồi, đếm); hồ sơ máy (D-06); luật vào bàn; nội dung thẻ xem trước; bảo lãnh đăng ký qua link (D-05) |
| **Conformance** | game nhận `init.entry` lạ không lỗi, luôn trả `entry.result`; loại đã khai báo thì xử lý được |

### 6. Thêm vào Game Contract (protocol 1, thêm không phá — như `shell`, `ranked`)

| Chỗ | Thêm |
|---|---|
| `game.json` | `identity` (D-06); `entries: ["share"]` — loại lối vào game tự xử lý |
| `init` | `entry?: { kind, payload?, from?, version }` |
| game → host | `entry` (`result`: `handled` · `unsupported` · `invalid`) · `identity.require` (`level`, `reason`) · `share` (`payload`, `text`) |
| SDK | `session.entry`, `session.identity.require()`, `session.share()` |

### 7. Thẻ xem trước, chống lạm dụng, đo lường

- **Thẻ xem trước**: `/r/<mã>` và `/s/<mã>` trả HTML có `og:` theo link ("Lan mời bạn vào bàn Tiến Lên", ảnh của game) —
  Caddy của hub lấy nội dung từ API rồi trả về SPA như thường. Hồ sơ trẻ em: thẻ không hiện tên/hình trừ khi chủ account cho.
- **Chống lạm dụng**: mỗi hồ sơ tạo tối đa N link/ngày; payload ≤ 2 KB; hết hạn mặc định; người tạo và admin thu hồi được;
  giải mã link có giới hạn theo IP; tên qua bộ lọc (ADR 0035).
- **Đo lường** (D-04): mỗi link đếm mở / chơi / tạo account theo ngày — số tổng, không gắn với ai.

## Phương án

| | Cách | Mất |
|---|---|---|
| A | Giữ mỗi lối vào một kiểu, thêm dần | mỗi game mới lại tự nghĩ; luồng định danh lệch nhau; không đo được |
| **B** ⭐ | Một mô hình ý định + một đường ống + link chia sẻ là đối tượng ở server (trên) | module `Links`, đường ống ở hub, thêm contract — làm theo giai đoạn |
| C | Link không trạng thái: payload ký HMAC ngay trong URL | không thu hồi, không giới hạn, không đếm, URL dài; chỉ hợp cho `game` (mà `game` vốn không cần token) |

## Đề xuất của agent

**B.** Mọi lối vào — hôm nay và game sau này — đi qua một đường ống, nên "hub đảm bảo định danh sẵn sàng trước" là luật của
nền tảng chứ không phải việc của từng màn hình. Game chỉ khai báo và tới đích. Mở rộng = thêm một loại ý định.

## Câu hỏi cho owner

| Q | Câu hỏi | Đề xuất |
|---|---|---|
| Q1 | Phương án B? | **B** |
| Q2 | Link chia sẻ hết hạn mặc định sau bao lâu? | **30 ngày**, người tạo đổi được |
| Q3 | Game đầu tiên dùng `share`? | **Ghép Khối**: "Thách bạn" cùng seed, vượt điểm của tôi |
| Q4 | Mỗi hồ sơ tạo tối đa bao nhiêu link/ngày? | **30** |
