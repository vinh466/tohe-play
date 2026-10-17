# Map — Public launch

Mọi item mục tiêu phụ thuộc vào, và cái nào chặn cái nào. Cạnh `A --> B` đọc là "quyết A trước B". Trạng thái nằm ở
bảng trong [PLAN.md](PLAN.md); trang này chỉ là hình dạng.

## Các track (làm song song được)

| Track | Gồm | Ghi chú |
|---|---|---|
| **T1 Release** | D-14 (E-03 → E-04 → E-05, E-06), D-15 | Đã decided toàn bộ phần cần làm — graduate được ngay |
| **T2 Identity & hồ sơ** | D-01, D-02, D-05, D-06, D-17, E-01 | Thay ADR 0004/0011; household chuyển thành account (D-01); tên + ID hồ sơ (D-17) |
| **T3 Email** | E-02 | T2 cần nó để gửi mã |
| **T4 OAuth & liên kết** | D-03, D-04 | OAuth chỉ chạy ở prod; test bằng scheme giả + mock server |
| **T5 Bảng xếp hạng & engine độ tin** | D-09, D-11, D-16, D-10 | Thay cho "Family" của review trước; engine (D-16) là năng lực nền tảng, D-10 là verifier đầu tiên |
| **T6 Admin** | D-07, D-08 (6a shell + module đọc dữ liệu có sẵn · 6b vai trò, admin đầu tiên, 2FA, audit · 6c người dùng, cài đặt đăng nhập, mã mời) | 6a bắt đầu được ngay |
| **T7 Sẵn sàng public** | D-12, D-13, E-07, E-09 | |
| **T8 Observability** | E-08 | Sau chart (ServiceMonitor) |
| **Ra mắt** | E-10 | Sau mọi thứ "phải có" |

## Phụ thuộc giữa các item

```mermaid
flowchart TD
  D14["D-14 Release via chart"] --> E03["E-03 Env-agnostic images"]
  E03 --> E04["E-04 Chart tohe"]
  E04 --> E05["E-05 UAT pulls GHCR images"]
  E04 --> E06["E-06 platform-infra apps/tohe"]
  E04 --> E08["E-08 Observability"]
  D04["D-04 Sign-in methods"] --> D15["D-15 UAT HTTPS"]

  D02["D-02 Email identity"] --> D03["D-03 Linking"]
  D03 --> D04
  D02 --> D12["D-12 Registration modes"]
  D01["D-01 Accounts and profiles"] --> D05["D-05 Step-up"]
  D01 --> D06["D-06 Age and consent"]
  D01 --> E01["E-01 UAT migration"]
  D02 --> E01
  D01 --> D17["D-17 Profile name and ID"]
  D17 --> E01
  D17 -.-> T2build
  E02["E-02 Transactional email"] -.->|"needed to build"| T2build(["T2 build"])
  D05 -.-> T2build
  D06 -.-> T2build

  D07["D-07 Admin console"] --> D08["D-08 First owner"]

  D01 --> D09["D-09 Leaderboards"]
  D12 --> D09
  D09 --> D16["D-16 Integrity engine"]
  D16 --> D10["D-10 Replay verifier (contract)"]
  D09 --> D11["D-11 Room boards"]
  D11 --> D16
  D07 --> D16

  D01 --> E07["E-07 Privacy, deletion, moderation"]
  D17 --> E07
  D06 --> E07
  D09 --> E07
  D12 --> E09["E-09 Bot protection"]
  E07 --> E10["E-10 Launch checklist"]
  E08 --> E10
  E09 --> E10
  D13["D-13 Games origin domain"] --> E10
```

## Thứ tự làm (phase của việc xây, không phải của plan)

| Phase | Song song | Xong khi |
|---|---|---|
| **A — Chốt** | owner trả lời D-17, D-16, D-06, E-02 · agent bắt đầu T1 | T2 và T5 đủ quyết định để spec |
| **B — Nền** | T1 (E-03 → E-04 → E-05; E-06 sau lần publish đầu) · T3 · spec rồi xây T2 · T6a | chart cài được lên kind và chạy trên UAT; đăng ký bằng email + hồ sơ mặc định có ID chạy trên UAT |
| **C — Mở rộng** | T4 · T6b · T5: engine v1 + bảng trong account + bảng tuần công khai của phòng | Google/GitHub chạy trên prod lúc đăng ký còn đóng; tạo được admin đầu tiên; engine chạy với kết quả phòng |
| **D — Sẵn sàng public** | T6c (gồm hàng đợi xem xét) · T7 · T8 · T5: bảng cộng đồng, replay Ghép Khối (nếu D-16 Q2 = có) | checklist public xanh; gia đình và bạn bè dùng UAT ổn định |
| **E — Ra mắt** | E-10 | một cộng đồng dùng thử trên prod |
| sau ra mắt | thêm game vào `ReplayVerifier`; tín hiệu v2; rating (D-11) | |

## Item

| ID | Câu hỏi / thay đổi | Mục tiêu cần nó vì | Chặn |
|---|---|---|---|
| D-01 | Một account nhiều hồ sơ, có hồ sơ mặc định | Mô hình người chơi cho user-first | D-05, D-06, D-09, D-17, E-01, E-07 |
| D-02 | Email là định danh + bộ luồng chuẩn | Public cần khôi phục và liên kết | D-03, D-12, E-01 |
| D-03 | Luật liên kết | Không bị chiếm account qua OAuth | D-04 |
| D-04 | Cách đăng nhập v1, cấu hình hai lớp, OAuth ở prod | "bật tắt và config được" | D-15 |
| D-05 | Xác thực lại hai mức | "1 lớp auth lại khi config profile" cho cả account chỉ có OAuth | T2 |
| D-06 | Cổng tuổi, đồng ý điều khoản | Trẻ em tự đăng ký | E-07 |
| D-07 | Admin console | "quản lý nền tảng, monitor" | D-08 |
| D-08 | Admin đầu tiên | Cài mới an toàn trên URL public | — |
| D-09 | Bảng xếp hạng phân tầng theo độ tin | Bảng công khai không bị gian lận | D-11, D-16, E-07 |
| D-10 | Verifier replay (đổi contract) | Bảng công khai cho game một người | — |
| D-11 | Bảng và hạng của phòng | Bảng công khai cho phòng | D-16 |
| D-16 | Engine độ tin | "1 engine xịn" — độ tin là năng lực nền tảng, nâng cấp từ đây | D-10 |
| D-17 | Tên đặt thoải mái + ID 12 số | "username cho đặt thoải mái", "mời đích danh profile" | E-01, E-07 |
| D-12 | Chế độ đăng ký, mã mời cộng đồng | Mở dần cho "vài cộng đồng nhỏ" | D-09, E-09 |
| D-13 | Games origin trên domain riêng? | Game có thể do AI viết; passkey sau này | E-10 |
| D-14 | Release bằng chart riêng | Prod trên `platform-infra` | E-03…E-06 |
| D-15 | UAT có HTTPS? | PWA/passkey trên UAT | — |
| E-01 | Chuyển dữ liệu UAT | Gia đình không mất dữ liệu | — |
| E-02 | Email giao dịch | Mọi luồng gửi mã | T2 build |
| E-03…E-06 | Image, chart, UAT kéo image, `apps/tohe` | D-14 | E-08 |
| E-07 | Quyền riêng tư, xoá account, kiểm duyệt tên | Public | E-10 |
| E-08 | `/metrics`, ServiceMonitor, alert tối thiểu | Vận hành prod | E-10 |
| E-09 | Chống bot đăng ký (Turnstile, tuỳ chọn) | Public | E-10 |
| E-10 | Checklist ra mắt: restore thử, load test phòng, security review | Ra mắt | — |

## Đã cân nhắc và để ngoài

- **Redis, nhiều API instance, SignalR backplane** — ADR 0016 chốt một instance; không cần cho vài cộng đồng.
- **Hệ thống bạn bè** — ID hồ sơ (D-17) chừa đường, như friend code; làm khi có nhu cầu.
- **Hồ sơ tự đăng nhập, đồng sở hữu hồ sơ, ghim thiết bị vào hồ sơ, chuyển hồ sơ sang account khác** — ghi ở D-01.
- **Passkey** — .NET 10 có sẵn; làm sau khi có HTTPS ở nơi cần thử (D-15).
- **Facebook, Zalo** — không thuộc v1; đường "provider không có email" của D-03 đã chừa sẵn.
- **UAT chạy bằng chart trên k3s homelab** — đổi ADR 0010; cân nhắc khi chart đã ổn.
- **Thử thách hôm nay (seed chung)** — khả năng mở ra sau D-10, không phải yêu cầu.
