# D-02 — Game lấy asset từ Studio thế nào: lúc build hay lúc chạy, và giữ rào gì?

- Status: **decided** (open → researching → proposed → decided · deferred · dropped)
- Kind: decision
- Blocks: D-05, D-12, D-13 · Blocked by: D-01
- Decided: owner, chat 2026-10-22: "ok chốt" (sau đề xuất ba chế độ và bốn rào)

## Why it matters

Owner muốn "các game sẽ phải phụ thuộc chính vào đây [Studio]". Nếu game gọi Studio lúc chạy để lấy bản mới nhất thì
bốn ADR bị phá cùng lúc. Nếu chỉ cho bundle thì game lớn không chia nhỏ được.

## What is true today

- CSP: `connect-src 'self'`, `img-src 'self' data: blob:` (`packages/contract/src/csp.ts:13-16`). Game ở
  `games.toheplay.io.vn` (ADR 0040), nên mọi đường dẫn trên origin đó đều là `'self'`.
- Conformance chặn request **ra ngoài origin** của game (`tools/conformance/src/run.ts:148`, `:372`). Luật "không gọi mạng
  ra ngoài folder" (`AGENTS.md:31`) hôm nay chỉ là chữ, chưa có máy kiểm.
- Games origin phục vụ mọi thứ trừ `catalog.json` với `immutable` (`deploy/docker/Caddyfile.games:31`).
- Spike S1 (service worker của games origin trong iframe, iOS, PWA) **vẫn mở**. Hub và game nay cùng site
  (`toheplay.io.vn`), nên ít bị chặn storage kiểu third-party hơn, nhưng chưa được đo.

## Options

### A — Game gọi Studio lúc chạy, luôn lấy bản mới nhất

Linh hoạt nhất, nhưng phá ADR 0002 (nguồn tải), 0005 (offline) và 0007 (bất biến): bản đã duyệt tự đổi hình. Ranked
replay có thể lệch nếu data đổi. Roblox cấm đúng chuyện này (R-01).

### B — Chỉ bundle lúc build

An toàn và đơn giản, nhưng game lớn phải tải hết một lần, và không chia sẻ được cache giữa các game.

### C — Studio là nguồn, game khoá version lúc build, rồi chọn chế độ tải theo từng pack

| Chế độ | Là gì | Offline | Tính vào |
|---|---|---|---|
| `bundle` | Nằm trong build | Luôn chạy được | `sizeBudgetKb` |
| `precache` | File đánh hash trên games origin, tải về máy lần đầu | Chạy được sau lần tải đầu | Dung lượng chiếm trên máy |
| `on-demand` | Tải khi cần; game phải tự xử lý khi lỗi | Phần đó cần mạng | Không tính vào build |

**Bốn rào, không game nào đổi được:**

1. Chỉ tải từ origin của Tò He, không bao giờ từ URL bất kỳ.
2. Asset luôn khoá version bằng hash lúc build. "Động" là động về *thời điểm* tải, còn *tải cái gì* đã cố định.
3. Chỉ dùng asset **đã duyệt** (D-09). Version đã publish thì không xoá, chỉ ngừng dùng (giống ADR 0007).
4. Conformance kiểm đúng chế độ game khai báo.

Thêm một luật: data ảnh hưởng luật chơi (chỉ số, công thức) luôn để `bundle`, vì ADR 0030 cần luật cố định.

## Recommendation

C, xây theo bậc: `bundle` trước; `precache` sau spike S1 (E-06); `on-demand` khi có game đầu tiên cần (D-13).

## Decision

**C**, theo lời owner:

> "game muốn hỗ trợ office [offline] thì chốt là asset sẽ đc tải sẳn sàng cho thiết bị, game full office [offline] 1
> người thì tự vận hành k cần BE hay asset từ nền tảng cũng đc (build 1 cục, với game nhẹ, game muốn như vậy), game có
> thể chốt cần internet thì thoải mái muôn local asset hay load động gì đó [...] nói về game tiêu thụ asset ntn thì lúc
> này đã thoải mái mà contract đc thì có thể game sẽ quyết load động/load trước/bundle sẳn (với version cụ thể, khi
> build)"

Chốt: "ok chốt" (2026-10-22). Bậc xây dựng ở trên cũng được chốt cùng.

**Hệ quả:**

- D-12 đặt hình dạng contract.
- D-13 thiết kế chi tiết hai chế độ chạy, sau E-06.
- E-01 phải sửa câu "outside their folder" thành "folder của mình và `/assets/` của Tò He", và thêm một máy kiểm cho câu
  đó.
- Chọn theo từng pack, không bắt cả game một chế độ. Game không khai báo `assets` thì vẫn như hôm nay.

## Discussion

**agent** (2026-10-22): asset dùng chung giữa các game sẽ ở `games.toheplay.io.vn/assets/<hash>`. Với game đó là
`'self'`, nên CSP không phải nới. Nhưng đây là thay đổi Game Contract, nên cần ADR (E-01). Đầu cuộc trò chuyện, agent ghi
nhầm origin là `toheplay.io.vn`. Theo ADR 0040, đó là host của hub.
