# D-04 — Biết luồng người mới chạy tốt hay không bằng cách nào, khi Tò He hứa không theo dõi?

- Status: **decided** (2026-10-19, chat) — **B**: Search Console + Bing + bộ đếm tổng hợp, không theo dõi
- Kind: decision — nếu thêm đo lường trên trang thì đụng lời hứa "no tracking" của vision → ADR
- Blocks: — (E-03 xây được mà không cần; chỉ là không biết nó tốt tới đâu) · Blocked by: —
- Decided: owner, 2026-10-19, chat — xem *Decision*

## Vì sao

Phase 1 làm lại landing và màn đầu tiên. Không đo gì thì chỉ biết qua cảm giác của owner và vài người thân.

## Sự thật

- Vision: "no ads, no tracking". Telemetry (ADR 0015) chỉ là dữ liệu kỹ thuật (lỗi, khung hình, thời gian tải,
  `displayMode` standalone/browser), có công tắc và trang minh bạch `/data`.
- Metrics Prometheus của API (ADR 0036, `tohe_*`) đếm phía server, không gắn với người.
- Server **không thấy** khách chơi (save của khách ở IndexedDB); chỉ thấy account, phòng, đăng ký.
- Cloudflare có thống kê lưu lượng ở tầng proxy (không cần script trên trang).

## Phương án

| | Cách | Thấy được | Giá |
|---|---|---|---|
| **A** | Không đo trên trang. Google Search Console + Bing Webmaster Tools (owner xác minh bằng TXT ở DNS) + thống kê Cloudflare | hiển thị/nhấp từ tìm kiếm, lượt truy cập thô | 0 code |
| **B** ⭐ | A + vài bộ đếm tổng hợp phía server, thêm vào metrics sẵn có: bắt đầu/xong đăng ký, ván đầu của account mới, vào bàn qua link, mở app ở chế độ standalone (từ telemetry, nếu thiết bị bật) | phễu thô: tìm thấy → đăng ký → chơi → cài | nhỏ; không cookie, không định danh người |
| **C** | Analytics tự host không cookie (Umami, Plausible) | từng trang, nguồn truy cập | thêm một service + script trên trang; phải sửa lời hứa của vision bằng ADR |

## Đề xuất của agent

**B.** Giữ đúng lời hứa (không script theo dõi, không bên thứ ba trên trang), vẫn có một phễu đủ để biết sửa chỗ nào.
Bing Webmaster Tools đáng làm vì Bing là nguồn của nhiều công cụ trả lời bằng AI (giả định — chưa có nguồn chính thức
trong R-02).

## Câu hỏi cho owner

- Q1: A, B hay C?
- Q2: Owner xác minh `toheplay.io.vn` ở Google Search Console và Bing Webmaster Tools khi trang công khai lên (P1)?

## Decision

**owner** (2026-10-19, chat): "ổn nha, theo đề xuất" — trả lời lượt gom câu hỏi ở PLAN → *Waiting on the owner*.

Q1 = **B**. Q2: owner xác minh Search Console và Bing khi trang công khai lên (sau P1-2).
