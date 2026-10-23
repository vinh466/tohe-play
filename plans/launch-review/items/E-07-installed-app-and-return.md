# E-07 — App đã cài và lúc quay lại: thoải mái

- Status: **decided** (F1, F2 trên prod; Q2, Q3 build 2026-10-24)
- Kind: enhancement
- Blocks: G7 lượt thử máy thật của owner · Blocked by: —
- Decided: owner, 2026-10-24, chat: "chốt theo đề xuất nha"

## Why it matters

Owner 2026-10-23: "đánh giá lại luồng khi người chơi quay lại và PWA có thoải mái cho user chưa". Quay lại đã đúng thiết
kế (*Chơi tiếp*, *Gần đây*, "Ai đang chơi?", cập nhật không cắt ván), nhưng quanh nó có chỗ làm người chơi kẹt: xoay
ngang, màn không lối ra trên iPhone, mất mạng, mạng yếu ([R-08](../research/R-08-installed-app-and-return.md)).

## What is true today

Bảng 14 mục ở [R-08 §2](../research/R-08-installed-app-and-return.md#2-tò-he-hôm-nay), mỗi mục ghi PR sửa:

- **F1** (đang build): sảnh phòng và màn con có ←, "Chơi trên máy này" → `/play`, game chưa mở khi mất mạng, nhấn giữ
  và kéo-tải-lại, theme-color sáng/tối, tên khớp hình, dải mất mạng theo sự kiện, `?lang=vi`, header *Chơi ngay*.
- **F2** (đang build): menu game vừa chiều cao, lớp "Xoay dọc máy để chơi" cho game dọc trên điện thoại nằm ngang, khung
  dùng rail khi màn thấp, icon đặc + maskable, shortcuts "Chơi cùng" và "Nhập mã", skeleton + timeout 3 s cho
  `/api/auth/me`, hướng dẫn cài iOS đúng cả iPad.

## Questions for the owner

| Q | Câu hỏi | Agent đề xuất |
|---|---|---|
| Q1 | Xoay ngang: giữ không khoá + lớp "xoay dọc" cho game dọc (F2), hay khoá dọc lại trên điện thoại? | Giữ không khoá + lớp (tablet, máy tính, game ngang được lợi) |
| Q2 | Cập nhật: hôm nay "Có bản mới — Tải lại" hiện ngay lần mở đầu sau deploy. Áp dụng im lặng khi app vào nền lúc đang ở màn của khung (không trong ván), còn lại vẫn báo, "Để sau" có chữ? (sửa ADR 0046) | Có |
| Q3 | Màu splash (Android) và ảnh khởi động iOS | Màu thương hiệu cho cả sáng và tối; ảnh khởi động iOS làm ở D-07 S3 khi có tranh |
| Q4 | "Ai đang chơi?" | Người chơi lần trước ở đầu, to: "Vẫn là An? Chơi tiếp", các hồ sơ khác bên dưới (làm ở D-07 S1) |

## Decision

**Theo đề xuất, Q1–Q4** — owner, 2026-10-24. Q1: giữ không khoá xoay + lớp "Xoay dọc máy để chơi" (F2, đã có). Q2: bản mới
áp dụng khi app khuất (vào nền) lúc đang ở màn của khung, không bao giờ trong ván, ở bàn hay khi xem lại; còn lại vẫn báo,
"Để sau" có chữ — ADR 0046 sửa theo. Q3: màn khởi động (splash) màu thương hiệu cho cả sáng và tối; ảnh khởi động iOS làm
ở D-07 S3. Q4: "Vẫn là An? Chơi tiếp" (S1a, đã có).

## Discussion

**agent** (2026-10-23): F1/F2 sửa phần chức năng không cần quyết; bốn câu trên là phần owner chọn. Danh sách thử máy
thật ở R-08 §3 dùng cho G7.
