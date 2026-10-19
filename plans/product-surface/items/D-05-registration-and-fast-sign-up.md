# D-05 — Đường vào account nhanh nhất (OAuth), và ai được tạo account khi công khai

- Status: **proposed v2** (2026-10-19) — basis đổi: owner muốn OAuth; hồ sơ máy (D-06) gỡ việc link bàn bắt account
- Kind: decision — sửa E-09 Q1 của `public-launch` ("ra mắt bằng mã mời") nếu owner chọn khác; Zalo đụng ADR 0024
- Blocks: E-03, E-05 · Blocked by: D-06
- Research: [R-05](../research/R-05-identity-and-entry-prior-art.md#đăng-nhập-nhanh-ở-việt-nam)

## Vì sao

Owner (2026-10-19): "luồng mời là 1 luồng đánh giá, cần phân tích tốt để cho người chơi tiếp cận nhanh (tôi nghĩ phần auth
sẽ phải thêm oauth để user vào nhanh chơi)".

## Sự thật

- Google + GitHub + OIDC chung đã xây (#50, ADR 0026), tắt ở prod ("email + mật khẩu trước, providers sau", 2026-10-18).
  Bật Google = owner tạo OAuth client (*Web application*, redirect `https://toheplay.io.vn/api/auth/external/google/callback`)
  + secret ở Infisical `/tohe` (`delivery.md` của `public-launch`).
- Prod: `registration: open`, `proofOfWork: false`. Console có mở / theo lời mời / đóng (ADR 0028) và proof-of-work (ADR 0037).
- Với D-06, người được rủ vào bàn **không cần account** (hồ sơ máy `named`) → chế độ đăng ký chỉ còn quyết **ai được tạo
  account**, không còn chặn vòng rủ nhau. Phương án "bảo lãnh qua link bàn" của v1 không cần nữa.
- Account chỉ cần ở các tính năng bậc `account`: đồng bộ nhiều máy, ID 12 số, run xếp hạng, bảng công khai (D-06 §3).

## Phương án

**Nhà cung cấp OAuth**

| | Nhà cung cấp | Được | Giá / rủi ro |
|---|---|---|---|
| **G** ⭐ | **Google** | đã xây; đa số Android có sẵn; một chạm | owner tạo client + secret; agent kiểm trên prod |
| Z | Zalo | phổ biến nhất ở VN | **giả định: không trả email** → account không email, va ADR 0024 + luồng liên kết ADR 0026; đăng ký app ở developers.zalo.me chưa kiểm |
| F | Facebook | phổ biến | app Meta, URL quyền riêng tư + xoá dữ liệu; email có thể thiếu |
| A | Apple | — | web không bắt buộc; iPhone dùng Google/email được |

**Ai được tạo account**

| | Chế độ | Khi nào hợp |
|---|---|---|
| I | Theo lời mời (mã cộng đồng) | giai đoạn owner tự thử, hoặc khi bị lạm dụng |
| **O** ⭐ | Mở + proof-of-work + giới hạn sẵn có + Google | từ lúc qua Cổng (E-05): người tới từ kênh của owner, tìm kiếm, hay được rủ đều tự lên account được |

## Đề xuất của agent

- **Google trong Phase 1** (đảo "providers sau" theo ý owner). Zalo là một quyết định riêng ở Phase 2: phải thiết kế
  "account không email" trước.
- **Ngay hôm nay**: bật proof-of-work (R-01 A2). Giữ `open` hay chuyển `invite` trong lúc owner tự thử — tuỳ owner (prod
  chưa công khai link ở đâu); **mở + Google** khi qua Cổng.

## Câu hỏi cho owner

| Q | Câu hỏi | Đề xuất |
|---|---|---|
| Q1 | Bật Google trên prod trong Phase 1? | **Có** — owner tạo OAuth client, agent viết hướng dẫn từng bước |
| Q2 | Zalo: đưa vào Phase 2 như một item riêng (account không email)? | **Có** |
| Q3 | Chế độ đăng ký khi qua Cổng: mở + proof-of-work + Google? | **Có** |
