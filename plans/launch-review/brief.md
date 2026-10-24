# Brief — Review trước launch: bề mặt sản phẩm hoàn chỉnh trước khi mở cho mọi người

Status: **confirmed** — owner, 2026-10-22, chat: "rất hợp lý, theo đề xuât tôi chốt nha, bạn review toàn bộ plan align lại
quyết định 1 cách sạch vè gọn rõ ràng giúp tôi nha". Trích dẫn là lời owner trong chat, giữ nguyên văn (có lúc gõ không
dấu), chỉ cắt bớt.

## Vì sao

Phase 1 ([`product-surface`](../product-surface/PLAN.md)) xong 2026-10-21: mọi PR chạy trên prod `prod-2026-10-21.2`,
owner thử thiết bị thật ("K2 ok r nha"). Owner đặt bước sau từ trước:

> "làm nốt những cái bạn đề xuất cho xong đi, sau đó tôi để đến phase review … làm 1 nền tảng hoàn chỉnh về các mặt
> trước khi launch chính thức" (2026-10-20)

Rồi đặt thứ tự:

> "… quay lại nhiệm vụ ưu tiên là chốt và nâng cấp bố cục sản phảm và các bề mặt tốt cho UX user, và bề mặt giới thiệu
> sản phẩm, SEO GEO, và scale bề mặt này tương lai nè, tôi muốn chốt được thiết kế này xong là có thể build tiếp chi tiết
> tiếp theo và sau đó có thể tập trung phát triển thêm đc game sau đó nè" (2026-10-22)

## Hai đợt

| Đợt | Gồm | Xong khi |
|---|---|---|
| **1 — Thiết kế bề mặt** | bố cục và UX của người chơi (D-02, D-04), hai ngôn ngữ (D-01), host và path (D-05), bề mặt giới thiệu, SEO, GEO, mở rộng (D-06) | các quyết định thành **ADR + spec**, rồi **build** xong theo spec |
| **2 — Trước launch** | rà từng màn (E-02), luồng đầu–cuối (E-03), câu chữ vi + en (E-04), Điều khoản + Quyền riêng tư (E-05), Cổng (E-01) | Cổng qua — owner chọn ngày launch |

Sau đó: tập trung làm thêm game. Ý hay ngoài phạm vi vào **backlog sản phẩm** (`docs/roadmap/product-backlog.md`), chọn ra
làm dần.

## Ràng buộc đang có hiệu lực

- **Không có ngày launch**: "chua chot ngay launch, khi nao on thi launch ne thoai mai nhe" (2026-10-22).
- **Tiếng Việt là mặt chính, tiếng Anh hỗ trợ**; tên riêng và thuật ngữ giữ tiếng Anh khi chính xác hơn (D-01).
- **Prod là nơi thử trước launch** (owner 2026-10-24: "tạm gỡ" UAT, "tất cả tôi và tester sẽ test trên prod cho tiện,
  prod vẫn còn đang dev chưa launch … đừng quan tâm user data"): agent vẫn chỉ đọc prod từ ngoài, lên prod khi owner nói
  (ADR 0041). Luồng release không qua UAT cần một ADR sửa 0010 và 0041 — chờ owner. Volume của UAT vẫn giữ.
- **Lời hứa của vision**: không quảng cáo, không theo dõi, không mua trong app — đổi thì cần ADR.
- **Quy tắc repo**: spec trước, ADR cho quyết định đắt; đổi Game Contract = ADR + docs + conformance; không làm yếu check;
  màu từ design token, sáng và tối.
- **Chi phí agent**: master Opus 5.5 · xhigh; worker Opus 5.5, effort tối đa high.
- **Agent không bịa yêu cầu**; câu chữ agent tự chọn được, owner soát ở đợt 2; Điều khoản: agent soạn, owner duyệt, agent
  không tư vấn pháp lý.

## Xong khi

**Đợt 1**

1. Bố cục hai vùng, khung app ba mục, màn đầu của người quay lại, cách chọn ngôn ngữ, mô hình mặt phẳng và luật leo thang
   của game, bề mặt giới thiệu "một nguồn cho mỗi game" — **viết thành ADR và một trang spec** có sơ đồ.
2. **Build xong theo spec**: trang công khai hai ngôn ngữ; thêm một game là có đủ trang vi + en và ảnh OG; khung app trên
   điện thoại và máy tính; người quay lại thấy việc đang dở; `pnpm verify` và e2e xanh; owner thử trên máy thật.

**Đợt 2**

3. Mỗi màn đã rà trên điện thoại và máy tính, sáng và tối, vi và en; lỗi đã sửa hoặc owner hoãn có ghi lại.
4. Các luồng đầu–cuối có e2e, không ngõ cụt.
5. Câu chữ vi + en đã soát; owner duyệt giọng văn.
6. Điều khoản + Quyền riêng tư nói đúng hôm nay, bản vi gốc + bản en; `TERMS_VERSION` mới.
7. Cổng (E-01) qua từng dòng.

## Không thuộc plan này

- Ngày launch và mời cộng đồng — quyết định riêng của owner.
- Tính năng mới ngoài bề mặt (thử thách hôm nay, bàn của gia đình, màn hình chung…) — backlog sản phẩm.
- Quảng cáo, marketing trả tiền; app trên store, app native; ngôn ngữ thứ ba cho hub và trang công khai.
- Đưa game lên L2/L3 — chỉ khi có game không do owner thêm (backlog PB-14).

## Câu hỏi còn mở

| Q | Câu hỏi | Ở đâu |
|---|---|---|
| Q3 | Rà UI/UX theo cách nào (agent chụp mọi màn rồi owner xem, hay owner tự đi)? | E-02, đợt 2 |
