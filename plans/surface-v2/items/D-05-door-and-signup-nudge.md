# D-05 — Cửa vào: giữ cửa, "Chơi ngay" trước, gợi ý đăng ký sau khi chơi

- Status: **decided** — owner, 2026-10-31, chat: "3. giữ nhưng choi ngay lên trước … cũng cần quan tâm luồng gợi ý người
  mới đăng ký đang nhập nhé"
- Kind: decision
- Blocks: — · Blocked by: D-01
- Decided: owner, 2026-10-31

## Why it matters

Người 16+ muốn chơi trước. Cửa hiện tại đặt đăng nhập lên trước, "Chơi thử trên máy này" là nút phụ, và thanh tab dưới
vẫn hiện trên màn đăng nhập. Nhưng bỏ hẳn cửa sẽ mất lối quay lại cho người đã có tài khoản và mất chỗ giải thích tiến
độ lưu ở đâu.

## Decision

**Giữ cửa**, đổi thứ tự và thêm luồng gợi ý:

### Màn cửa `/account/sign-in`

1. **Chơi ngay** — nút chính, to, vào sạp với hồ sơ máy. Không hỏi tên trước; tên gợi ý hiện trong chip.
2. **Đăng nhập** — nút phụ (Google, email).
3. **Tạo tài khoản** — link.
4. Câu một dòng: "Chơi không cần tài khoản. Đăng nhập nếu muốn giữ điểm trên mọi máy."
5. **Không thanh tab dưới** ở màn cửa; chỉ một "←" về.
6. Người đã có phiên/phiên máy: thấy **"Chơi tiếp [game]"** hoặc **"Chào lại, [tên]"** ở đầu, kèm "Không phải [tên]?".
7. Không hiện "Dữ liệu kỹ thuật" trên màn chính; để ở footer.

### Luồng gợi ý người mới (sau khi chơi, không chặn)

| Lúc | Gợi ý | Cách |
|---|---|---|
| Kết thúc ván đầu | "Giữ điểm này? Tạo tài khoản." | Card nhỏ ở màn kết quả/thoát game; `Để sau` |
| Lần mở thứ 2 hoặc game thứ 2 | "Điểm đang ở máy này. Đăng nhập để mang theo." | Banner mềm ở Sạp/Tôi; tối đa 1 lần/phiên |
| Người đã đăng nhập | Không gợi ý | — |
| Người vừa bấm "Để sau" | Không hiện lại 7 ngày | Lưu local |
| Đang chơi | Không hiện | Không cắt ngang ván |

- Đăng ký/đăng nhập **mang theo hồ sơ máy và tiến độ** (đã có `signingUpDevice`); không mất điểm.
- Nếu người dùng bỏ qua, tiếp tục chơi khách; không nhắc lại mỗi lần mở.
- Link bàn `/r/…`, link chia sẻ `/s/…`, `/play/<id>` vẫn chơi ngay, không qua cửa.

## Consequences

- `WelcomePage.tsx` đổi thứ tự; `AppFrame` ẩn nav ở auth; `RequireSession` giữ nguyên gate cho tab Sạp.
- Thêm component `SaveProgressCard`/`SignInNudge` (một chỗ, dùng lại).
- Copy vi/en; e2e: người mới chơi ngay, người cũ "Chơi tiếp", gợi ý không chặn.
- Không đổi ADR 0055 về "hỏi một lần"; chỉ đổi thứ tự và thêm gợi ý sau giá trị.

## Discussion

**owner** (2026-10-31): "3. giữ nhưng choi ngay lên trước, sẽ cân bằng viêc người chơi cũ vào lại hay lẫn người mới
muốn thử ngay, ngoài ra cũng cần quan tâm luồng gợi ý người mới đăng ký đang nhập nhé"
