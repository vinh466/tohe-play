# D-05 — Khi công khai: ai được tạo tài khoản, và đường vào nhanh nhất là gì?

- Status: **proposed** (2026-10-19) — sửa lại E-09 Q1 của `public-launch` ("ra mắt bằng mã mời") nếu owner chọn khác
- Kind: decision
- Blocks: E-03 (luồng link bàn, nút đăng ký), E-05 · Blocked by: D-03
- Decided: —

## Vì sao

Phase 1 muốn người lạ tìm thấy Tò He (SEO/GEO) và được bạn rủ vào bàn. Hai điều đó va với chế độ "chỉ theo lời mời" đã
chốt ở `public-launch` E-09 Q1, và với luồng đăng ký hiện tại (email → chờ mã → mới ngồi được vào bàn).

## Sự thật

- Prod: `registration: open`, `proofOfWork: false` (`/api/config`, 2026-10-19). Console có ba chế độ: mở / theo lời mời
  (mã cộng đồng) / đóng (ADR 0028), và proof-of-work trước khi gửi mã (ADR 0037).
- Link bàn `/r/<code>` khi chưa có account → `/register` (`apps/hub/src/pages/JoinPage.tsx`). Ở chế độ "theo lời mời",
  link bàn **không mang mã cộng đồng** → người được rủ không vào được.
- Khách (không account) chơi được mọi game một mình; không vào được bàn online.
- Google/GitHub đã xây (#50, ADR 0026), tắt ở prod vì owner chọn "email + mật khẩu trước, providers sau" (2026-10-18).
  Bật Google = owner tạo OAuth client + secret ở Infisical `/tohe` (`delivery.md` của `public-launch`).
- Resend Free: 100 thư/ngày cho cả account.

## Phương án

| | Ai được tạo account | Được | Mất |
|---|---|---|---|
| **A** | Theo lời mời (mã cộng đồng) — như E-09 Q1 | ít lạm dụng nhất | người đến từ tìm kiếm chỉ chơi được như khách; **link bàn gãy** với người mới |
| **B** | Mở + proof-of-work + giới hạn sẵn có | SEO/GEO chuyển thành người dùng thật | lạm dụng dễ hơn; tốn quota thư |
| **C** ⭐ | Theo lời mời, **và** link bàn / link mời của một người đã có account cũng mở cửa đăng ký (người rủ "bảo lãnh"; giới hạn theo người rủ) | giữ được vòng lan truyền, vẫn kiểm soát | thêm một luật ở API + một ADR nhỏ (sửa 0028) |

Đường vào nhanh, độc lập với chế độ trên:

| | Cách | Giá |
|---|---|---|
| **G** ⭐ | Bật **Google** trên prod (đã xây) — một chạm, không chờ mã | owner tạo OAuth client; agent chỉ kiểm |
| **L** | Đăng ký xong ngồi vào bàn ngay, xác minh email sau | đổi ADR 0024 (xác minh trước) — để Phase 2 nếu cần |
| **K** | Khách ngồi bàn không cần account | danh tính ẩn danh ở server, đổi rooms/identity — Phase 2 |

## Đề xuất của agent

**C + G** cho lúc mời cộng đồng đầu tiên; **B** khi owner muốn người lạ từ tìm kiếm tự tạo account. Ngay hôm nay (chưa
mời ai): bật proof-of-work trên prod (R-01 A2).

## Câu hỏi cho owner

- Q1: A, B hay C khi mời cộng đồng đầu tiên?
- Q2: Bật Google trên prod trong Phase 1 (đảo lại quyết định "providers sau")?
