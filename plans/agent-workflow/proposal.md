# Proposal — Quy trình làm việc cho agent opencode

Status: **locked** — owner chốt toàn bộ [L-01…L-10](#bảng-quyết-định) ngày 2026-10-31 ("chốt nha"). Luật có hiệu
lực cho các phiên của agent opencode từ Phase A; trước khi PR Phase A merge, phần `docs/` và `.opencode/` vẫn là đề
xuất, chưa phải spec.

## 0. Mục tiêu và giới hạn thật

Mục tiêu: owner nhìn vào là biết tôi đang ở đâu, cái gì đã được kiểm, cái gì chưa; spec và code không lệch; không có
PR rác; mọi thứ lên UAT/prod đều có lời owner và có bằng chứng.

Giới hạn thật: tôi chạy **DeepSeek V4.1 Flash**, cùng model cho master và reviewer. Không có worker Opus, không có
"second opinion" khác model. Vì vậy quy trình này bù bằng: diff nhỏ, checklist cơ học, test đỏ→xanh, reviewer
fresh context, owner review ở T3, và đo lỗi lọt qua review. Không tuyên bố nào dưới đây thay được việc owner đọc diff.

Mỗi mong muốn của owner thành một cơ chế, không phải một lời hứa:

| Owner muốn | Cơ chế trong trang này |
|---|---|
| Chất lượng ổn định | Gate V0–V4, luật dừng, 6 chỉ số đo mỗi 10 PR |
| Không rác | Một PR một mục đích, trần kích thước, định nghĩa "rác", không drive-by |
| Kế hoạch rõ | Research R0–R3, Definition of Ready, work packet, plan space |
| Spec ↔ impl khớp | Mỗi PR một dòng "Docs:", docs sửa cùng PR, audit drift mỗi 10 PR |

## 1. Sáu nguyên tắc

1. **Bằng chứng thay cho lời nói.** Không có câu "chắc là chạy"; mọi tuyên bố "xong" phải kèm lệnh và kết quả.
2. **Spec trước.** Thay đổi hành vi thì trang docs đổi trong cùng PR. Quyết định khó đảo ngược thì có ADR.
3. **Một PR một mục đích.** Không gộp dọn dẹp, không drive-by refactor, không đổi format file không liên quan.
4. **Không bao giờ nới check để cho pass.** Test, conformance, CSP, pnpm minimum release age, lint config. Nếu check
   sai thì sửa nó trong PR riêng, có lý do, owner duyệt.
5. **Dừng khi không chắc.** Luật dừng ở [§7](#7-luật-dừng). Không đoán spec, không đoán ý owner.
6. **Nói thật cả khi xấu.** Check fail thì đưa log; bỏ qua check thì nói rõ bỏ qua cái gì và vì sao; không biết thì nói
   không biết.

## 2. Ba lớp và một vòng

| Lớp | Ở đâu | Vai trò |
|---|---|---|
| Spec | `docs/` | Cái gì đúng. Tôi không tự đặt ra; sửa cùng PR. |
| Process | `plans/` + work packet trong PR | Vì sao, theo thứ tự nào. Nhỏ, viết ra, owner đọc được. |
| Gate | lệnh trong repo + CI | Bằng chứng máy kiểm. Tự động tối đa. |

Một vòng việc:

```text
sync → phân loại → research → spec/plan → packet → build → verify → review → PR → merge (lời owner)
                                                                              → deploy (lời owner) → check → log
```

## 3. Phân loại việc và độ sâu research

**Hạng rủi ro** quyết định gate, review và quyền tự quyết:

| Hạng | Ví dụ | Ai duyệt thiết kế |
|---|---|---|
| **T1** | sửa bug rõ, copy, docs, UI nhỏ, chore | tôi, sau đó owner review diff |
| **T2** | feature trong một package, endpoint, màn hình, game | owner đọc packet trước khi build |
| **T3** | Game Contract, identity/auth, security, schema/migration, origin/service mới, dependency mới, refactor xuyên tầng, release tooling | owner chốt thiết kế **trước** khi viết code; ADR nếu khó đảo ngược |

**Research** theo bậc, không phải lúc nào cũng viết bài dài:

| Bậc | Khi nào | Sản phẩm |
|---|---|---|
| R0 | typo, copy, bug đã rõ nguyên nhân | không cần note |
| R1 | bug/feature trong repo | đọc code + docs; 3 dòng trong packet (đã biết gì, còn thiếu gì) |
| R2 | T3, dependency mới, contract, security, UX mới | `research/R-NN.md`: câu hỏi, facts có nguồn + ngày + version, options, "what would change my mind" |
| R3 | chưa biết có khả thi | spike trong worktree, time-box 1 session; không đi tiếp thì bỏ code, giữ note |

Note R2 tách rõ **fact** và **giả định**; mỗi lựa chọn ghi chi phí, license, bảo trì, rủi ro, độ hợp với repo. Không có
"theo tôi là tốt" mà không có nguồn hoặc thử nghiệm.

## 4. Definition of Ready và work packet

Một việc chỉ bắt đầu khi packet trả lời được:

- **Mục đích** một câu, và **vì sao bây giờ**.
- **Spec**: docs/ADR/plan item nào nó hiện thực; nếu chưa có thì đó là việc đầu tiên.
- **Trong / ngoài phạm vi** rõ ràng.
- **Done-when** đo được: test nào, lệnh nào, ảnh nào.
- **Claims**: đường dẫn hẹp nhất được sửa.
- **Gate**: V0–V4 nào bắt buộc (theo [§5](#5-kiểm-tra-bốn-mức-và-ma-trận)).
- **Rollback** với T2/T3.
- **Câu hỏi mở**: đã trả lời, hoặc hoãn có ghi rõ.

Không có packet thì không mở worktree. Packet nằm trong PR description (T1) hoặc trong plan item (T2/T3).

## 5. Kiểm tra: năm mức và ma trận

| Mức | Làm gì | Khi nào |
|---|---|---|
| **V0** | `pnpm exec biome check <paths>` | mọi thay đổi, sau mỗi lần sửa |
| **V1** | `pnpm exec turbo run typecheck test --filter=<package>` | trong lúc build, package bị đụng |
| **V2** | `pnpm verify` (Biome, assets check, typecheck, test, build, conformance) | **bắt buộc trước mọi PR** |
| **V3** | kiểm chuyên biệt theo loại thay đổi (bảng dưới) | trước PR, cùng V2 |
| **V4** | `pnpm release:check <ref> --for uat\|prod`, rồi `pnpm check:uat` / `check:prod` | trước/sau deploy |

| Loại thay đổi | V3 bắt buộc thêm |
|---|---|
| docs/plan only | `pnpm exec turbo run build --filter=@tohe/docs` (link check) |
| hub / web / studio UI | e2e smoke `pnpm --filter @tohe/e2e smoke`; screenshot light + dark ở 360 px theo Voice and look |
| API | test API trên PostgreSQL (Testcontainers); `git status` sạch sau build (OpenAPI + types) |
| Game Contract | conformance tất cả game; schema regenerate; ADR + docs cùng PR |
| game | conformance + screenshot đã xem + `SPEC.md` + `page/` + OG + sitemap regenerate |
| assets | `pnpm assets:check`; lock + `assets.gen.ts` regenerate |
| routes / infra | `pnpm --filter @tohe/routes build`; diff Caddy/robots/HubPaths sạch |
| dependency | `docs/roadmap/upgrade-watchlist.md`; generated API diff nếu đụng codegen |

**Bằng chứng trong PR** (bắt buộc):

```text
## Checks
- pnpm verify — PASS (local, <thời gian>)
- <V3> — PASS/FAIL + log
## Docs
- docs/<page> — updated / no change because <lý do>
## Workers
- <agent>, <model>, <số vòng>
## Deviations
- <khác packet ở đâu, vì sao> hoặc "none"
```

## 6. Review khi chỉ có một model

Cùng model tự review là điểm yếu thật; tôi không giả vờ nó tương đương reviewer độc lập. Bù bằng bốn lớp:

1. **Diff nhỏ** (L-05) — review 400 dòng khác hẳn review 1.500 dòng.
2. **Reviewer subagent fresh context**: chỉ nhận diff + đoạn spec liên quan + checklist; không thấy lý do của tôi,
   để không bị neo. Trả findings theo mức: blocking / should-fix / nit, kèm `file:line`.
3. **Checklist cơ học** cho mọi diff: test có thật sự kiểm hành vi mới? có generated file bị sửa tay? docs có khớp?
   có secret/log debug? có code chết? có nới check? có làm đổi hành vi ngoài phạm vi?
4. **Owner review**: bắt buộc với T3; với T1/T2 owner có thể đọc nhanh, nhưng diff và bằng chứng luôn có sẵn.

Reviewer được phép nói "không thấy vấn đề", nhưng phải nói **đã kiểm gì**. Không chấp nhận "LGTM" trống.

## 7. Luật dừng

Dừng và hỏi owner (ghi: việc gì, vì sao dừng, 2–3 lựa chọn, đề xuất) khi:

1. Đụng Game Contract, identity/auth, security, schema/migration.
2. Thêm dependency, công nghệ, origin, service, hoặc biến môi trường mới.
3. Cần lệnh phá hủy dữ liệu, hoặc chạm UAT/prod ngoài `studio.draft` và các lệnh check read-only.
4. Spec mơ hồ, hoặc hai trang docs nói khác nhau.
5. Cùng một lỗi đã thử sửa hai lần mà vẫn fail.
6. Diff vượt trần kích thước (L-05).
7. Muốn nới một check để cho pass.
8. Không giải thích được một check fail, hoặc kết quả lạ.

Không có "chắc ổn rồi". Dừng rẻ hơn sửa sai trên prod.

## 8. Định nghĩa "rác"

Một PR bị coi là rác nếu có bất kỳ điều nào:

- Code chết, code comment-out, import/dependency không dùng.
- TODO/FIXME không trỏ tới plan item hoặc issue.
- Drive-by: đổi format, rename, refactor file không liên quan mục đích.
- Helper trùng với helper đã có.
- Sửa tay file generated (schema, OpenAPI, `schema.gen.ts`, `assets.lock.json`, routes, robots).
- Log debug, secret, dữ liệu cá nhân.
- Docs nói một đằng, code làm một nẻo.
- Test chỉ để tăng coverage, không kiểm hành vi.

## 9. Spec ↔ impl

- Mỗi PR có dòng `Docs:` như trên. "Không đổi docs" cũng phải có lý do.
- Thay đổi hành vi → docs sửa **trong cùng PR**; docs build + link check là gate.
- Quyết định khó đảo ngược → ADR trước hoặc cùng PR (số kế tiếp: **0056** (0055 đã dùng cho front page)).
- Sau merge: plan `log.md` một mục ≤ 5 dòng; backlog row chuyển `done` nếu có.
- Mỗi 10 PR: audit 15 phút, chọn 3 trang docs đối chiếu code; lệch thì mở PR sửa. Ghi kết quả vào log.

## 10. Phiên làm việc

**Bắt đầu:** `git fetch --prune`; `git status`; `pnpm claims status`; đọc mục mới nhất `plans/<active>/log.md` và
`PLAN.md` → Next; xem PR/CI gần nhất. Nếu baseline đỏ thì báo trước, không xây tiếp trên nền hỏng.

**Trong phiên:** một branch/worktree cho một PR; checkout chính luôn sạch; không để việc dở trong checkout chính.
Context: đọc dài và tìm kiếm giao cho `scout`; master chỉ giữ kết luận.

**Kết thúc:** log ≤ 5 dòng (đã làm, đang chờ ai, việc kế tiếp); checkout chính sạch; nêu đúng một việc cho phiên sau.

## 11. Deploy

Chỉ khi owner nói "deploy" / "lên prod":

1. `pnpm release:check <ref> --for uat|prod` — phải xanh.
2. Tag `uat-…` trên `main` (chỉ khi owner nói "deploy"), push tag.
3. `deploy/uat/deploy.sh <tag>` cho UAT; prod qua tag `prod-…` + PR `targetRevision` của `apps/tohe` trong
   `platform-infra` (agent chỉ merge đúng PR đó, khi owner nói "lên prod").
4. `pnpm check:uat` / `pnpm check:prod`; báo số pass/fail.
5. Ghi log + release note.

Không bao giờ: `kubectl apply`, `helm upgrade` tay, migration tay, xóa volume, ghi trực tiếp vào prod (ngoại lệ duy nhất
`studio.draft`).

## 12. Cưỡng chế trong opencode

Ba mức, nói rõ mức nào là thật:

| Mức | File | Chặn được gì | Giới hạn |
|---|---|---|---|
| Luật viết | `docs/guides/opencode-workflow.md` + block ngắn trong `AGENTS.md` | định hướng, owner đọc được | không tự chặn |
| Quyền tool | `.opencode/opencode.jsonc` (`permissions` + `policies`) | lệnh nguy hiểm, push thẳng `main`, force push, merge/tag/deploy khi chưa được phép | shell vẫn có quyền của user; pattern chỉ là guardrail |
| Agent | `.opencode/agents/{scout,builder,reviewer,chore}.md` | scout/reviewer không sửa file; builder chỉ sửa trong worktree | không phải sandbox |

Đề xuất cụ thể (Phase A):

- `policies` (deny cứng trong phạm vi project: không prompt, "allow always" không đè được; config global vẫn có
  quyền cao hơn nên đây là guardrail, không phải bất biến): `git push --force*`, `git push * --force*`, `kubectl *`,
  `helm *`, `psql *`, `dropdb *`, `docker volume rm *`, `docker compose down -v*`, `sudo *`, `edit:*.env`,
  `read:*/.ssh/*`, rồi `allow` lại `edit:*.env.example`.
- `permissions` `ask`: `gh pr merge *`, `git tag *`, `git push origin main*`,
  `git push * --tags*`, `bash deploy/uat/deploy.sh *`.
- `permissions` `deny`: đọc `~/.config/tohe-studio/env` bằng tool `read` (CLI vẫn `source` file trong shell, không in ra).
- `scout`: `mode: subagent`, deny `edit`, deny `subagent`, `steps: 40`.
- `builder`: `mode: subagent`, edit chỉ `.claude/worktrees/*/**`, deny `subagent`, `steps: 150`, cấm commit/push.
- `reviewer`: `mode: subagent`, deny `edit`, chỉ đọc + `git diff/log/show`, `steps: 60`.
- `chore`: như builder, `steps: 60`, chỉ việc cơ học.
- Master vẫn là agent `build`; không thay system prompt gốc, để không mất hành vi mặc định của opencode.

**Phase C (chỉ nếu pilot lộ lỗi):** plugin `.opencode/plugins/claims-guard.ts` đọc `.agent-claims` và chặn edit ngoài
claims + commit/push/merge/deploy của worker — thay hook `tools/claims` của Claude Code. Plugin phải có test riêng.

Nói thật: không mức nào ở trên là security boundary. Bảo đảm thật là diff nhỏ + review + check + owner đọc.

## 13. Sáu chỉ số, đo mỗi 10 PR

| Chỉ số | Mục tiêu | Lấy từ |
|---|---|---|
| Số vòng review / PR | ≤ 1 lần sửa lớn | PR body |
| Fail chỉ trên CI (không fail local) | 0, trừ lỗi hạ tầng | so V2 local với CI |
| Lỗi lọt sau merge / 10 PR | 0 | issue/incident |
| Kích thước PR | median ≤ 8 file, ≤ 250 dòng (trần: L-05) | `gh pr view` |
| Docs drift / 10 PR | 0 | dòng `Docs:` + audit |
| Vi phạm luật dừng | 0 | tự báo |

Sau mỗi 10 PR: xem số, sửa luật trong một PR riêng, ghi vào log. Luật không được sửa lặng lẽ.

## 14. Lộ trình áp dụng

- **Phase 0 — baseline:** `pnpm install`, `dotnet tool restore`, `docker compose up -d postgres mailpit`,
  `pnpm verify`. Không sửa gì. Nếu đỏ, báo trước khi nhận việc.
- **Phase A — luật + cưỡng chế:** ADR 0056, `docs/guides/opencode-workflow.md`, sửa
  `docs/guides/working-with-agents.md` (bỏ bảng gắn cứng Claude), block ngắn trong `AGENTS.md`, `.opencode/` config +
  4 agent. Không code sản phẩm. Một PR. Thử guard bằng lệnh bị chặn thật.
- **Phase B — pilot:** một PR nhỏ (docs hoặc bug T1) chạy đúng luật; đo 6 chỉ số; báo owner.
- **Phase C — siết:** chỉ thêm plugin claims-guard hoặc CI drift check nếu pilot chứng minh cần.

Mỗi phase xong phải có báo cáo; phase sau không bắt đầu khi phase trước chưa được owner chấp nhận.

## Bảng quyết định

**Đã chốt toàn bộ 2026-10-31.** Muốn đổi một dòng thì mở lại đúng dòng đó, ghi ngày và lý do, và coi như một sửa đổi
luật — không sửa lặng lẽ.

| ID | Quyết định | Đề xuất | Nếu OK thì đổi gì |
|---|---|---|---|
| **L-01** | Phạm vi | Luật chung cho mọi agent; `.claude/` giữ nguyên, `.opencode/` là adapter | docs nói "agent", không nói riêng tool |
| **L-02** | Model & effort | Bỏ bảng `claude-opus-5-5`; ghi thật: master = reviewer = DeepSeek V4.1 Flash; không worker Opus; bù bằng L-03 | sửa `working-with-agents.md` + ADR 0056 |
| **L-03** | Review độc lập | Reviewer fresh context + checklist + owner bắt buộc ở T3 | thêm mục review vào docs |
| **L-04** | Merge/tag/deploy | `ask` cho merge/tag/push main/deploy; `deny` cho kubectl/helm/force/volume | `.opencode/opencode.jsonc` |
| **L-05** | Trần PR | ≤ 12 file, ≤ 400 dòng (trừ generated/lock/ảnh); vượt thì tách hoặc giải trình trong packet | Definition of Ready |
| **L-06** | Research | R2 bắt buộc cho T3 + dependency mới; note có nguồn/ngày/version; time-box 1 session | mục research trong docs |
| **L-07** | Plan space | Mở khi ≥ 3 quyết định hoặc đụng ≥ 2 trong {contract, API, hub, games, infra}; dưới đó doc/ADR + packet | docs |
| **L-08** | Claims | 1 worker/PR; hot zone tuần tự; worktree dưới `.claude/worktrees/` (giữ đường dẫn đã có); `claims check` trước mỗi commit | sửa claims section |
| **L-09** | Docs drift | Mỗi PR dòng `Docs:`; audit mỗi 10 PR; chưa thêm CI check | docs + PR template mới |
| **L-10** | Deploy | Chỉ theo lời; `release:check` trước; `check:uat/prod` sau; không migration tay | docs environments |

## Việc tôi sẽ không làm khi chưa được chốt

- Không sửa `docs/`, `AGENTS.md`, `.claude/`, không thêm `.opencode/`.
- Không commit/push proposal này.
- Không merge, tag, deploy, không ghi UAT/prod.
- Không thêm dependency hay đổi contract.

## Nguồn

- Repo: `AGENTS.md`, `docs/guides/working-with-agents.md`, `docs/conventions/definition-of-done.md`,
  `docs/guides/environments.md`, `docs/roadmap/upgrade-watchlist.md`, `scripts/verify.sh`, `.github/workflows/ci.yml`,
  `tools/claims/src/cli.ts`, `tools/claims/src/zones.ts`.
- OpenCode V2: <https://opencode.ai/v2/docs/agents>, <https://opencode.ai/v2/docs/permissions>,
  <https://opencode.ai/v2/docs/policies>, <https://opencode.ai/v2/docs/build/plugins> (đọc 2026-10-31).
