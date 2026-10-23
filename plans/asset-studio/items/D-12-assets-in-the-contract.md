# D-12 — Game khai báo, khoá và dùng asset ra sao trong Game Contract?

- Status: **decided** (open → researching → proposed → decided · deferred · dropped)
- Kind: decision
- Blocks: E-01, E-02, E-03 · Blocked by: D-01, D-02, D-05
- Decided: owner, chat 2026-10-24: "ok chốt theo đề xuất, hướng review đã ổn"

## Why it matters

"Game chỉ việc lựa và chọn" (owner) phải là một contract rõ ràng, máy kiểm được, agent viết đúng ngay lần đầu.

## What is true today

- `game.json` là một schema Zod strict (`packages/contract/src/manifest.ts:155`). Field mới, optional, thì không đổi số
  protocol (`docs/contracts/game-contract-v1.md`, *Versioning*).
- Game build bằng Vite với `base: './'`. Vite tự đặt chunk JS của nó vào `dist/assets/`
  (`games/merge-block/vite.config.ts`).
- `tools/games-host` copy `dist/` sang `/<id>/<version>/` (`tools/games-host/src/assemble.ts`).
- Module luật (`rooms`, `ranked`) thuần, không dùng API của trình duyệt, tối đa 256 KB.
- Có các file sinh tự động, không được sửa tay, và có máy kiểm drift (`AGENTS.md`, `/verify`).

## Options

### A — Game tự copy file vào `public/`

Không cần contract. Nhưng không có lock, không kiểm được license và hash, và không cập nhật version được.

### B — Khai báo trong `game.json`, khoá trong file lock, dùng qua key có type được sinh tự động

**1. Khai báo** (`game.json`, optional):

```jsonc
"assets": {
  "farm-crops": { "version": "1.0.0", "delivery": "bundle" },
  "farm-tiles": { "version": "2.1.0", "delivery": "bundle", "include": ["ground/*", "fence/*"] }
}
```

- Mặc định lấy cả pack. `include` (glob theo id asset) chỉ lấy một phần.
- P0 chỉ nhận `delivery: "bundle"`. `precache` và `on-demand` thêm sau (D-13), là thay đổi additive.

**2. Khoá** (`games/<id>/assets.lock.json`, commit cùng game, sinh bằng `pnpm assets:resolve`):

- Mỗi pack ghi version và hash của manifest.
- Mỗi file ghi id, đường dẫn, sha256, số byte, SPDX, ghi công.
- **Build chỉ đọc lock, không bao giờ resolve lại**, giống `--frozen-lockfile`. Muốn đổi thì chạy `assets:resolve` rồi
  PR.

**3. Dùng trong code** (`src/assets.gen.ts`, sinh từ lock, nằm trong danh sách file sinh của `AGENTS.md`):

```ts
import { assets } from './assets.gen';
await loadPack(scene, assets.farmCrops); // kit, E-03
scene.add.sprite(x, y, assets.farmCrops.carrot.key, 0);
```

- Key có type, nên sai tên là lỗi typecheck.
- Kích thước, frame và animation đi kèm từ metadata của pack.

**4. Trong build:**

- File đặt ở `dist/studio/<sha256>.<ext>`. Không dùng `dist/assets/` vì đó là chỗ của Vite. Vẫn nằm trong folder của
  game.
- Atlas do build đóng theo game, chỉ gồm file được dùng (E-02).
- Có thêm `dist/credits.json` sinh từ lock. Kit hiện nó trong menu (E-03).

**5. Luật:**

- Data ảnh hưởng luật chơi không lấy từ Studio. Module luật không được import `assets.gen.ts`; conformance kiểm việc này.
- Asset chỉ là hình, âm thanh và font.

**6. Conformance (E-01):**

- `game.json` khớp với lock.
- Mỗi file trong `dist/studio/` có đúng hash trong lock.
- SPDX nằm trong danh sách cho phép (D-07).
- Có `credits.json` khi có license cần ghi công.
- **Request chỉ được đi tới folder `/<id>/<version>/` của game**, không chỉ cùng origin. Luật trong `AGENTS.md:31` lần
  đầu có máy kiểm.

### C — Lock nằm trong `game.json`

Ít file hơn, nhưng `game.json` sẽ phình to và lẫn chuyện máy sinh với chuyện người khai báo.

## Recommendation

**B.** Tách đúng ba vai: người khai báo trong `game.json`, máy khoá trong `assets.lock.json`, code dùng
`assets.gen.ts`. Build tái lập được, và typecheck bắt lỗi sai key.

Chi phí chấp nhận:

- Thêm hai file sinh cho mỗi game dùng asset.
- Thêm một lệnh (`assets:resolve`) và một máy kiểm drift.
- Thêm một bài conformance cho đường dẫn request theo folder. Bài này có thể làm vài game hiện tại đỏ nếu chúng lỡ gọi ra
  ngoài folder; nếu có thì sửa game, không nới luật.

## Decision

**B**, owner (2026-10-24: "ok chốt theo đề xuất, hướng review đã ổn").
