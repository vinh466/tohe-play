# Log — Ghép Khối: the evolution

Newest first. One entry per working session: what moved, what is waiting on whom. ≤ 5 lines each.

## 2026-11-08 — pre-play navigation and looks

- Owner testing: the mode screen's Back and New game flows needed work. The mode screen is now a menu-stage
  screen (`prePlay` in the shell) shown from Chơi with no run, Ván mới and the panel's Ván mới; Back returns to the
  title or panel, hardware Back and Esc match, and choosing a mode starts play (in place from the panel).
- A first-run how-to comes before the modes; the Workshop opens over them with Back to the modes; the ticket's
  Đổi chế độ uses the same screen. Cards got the mode pictures, ranks and live/best lines; phone headers fit one line.
## 2026-11-08 — 3.0.0 shipped

- Owner: "ok làm tất" — the whole recommendation. Built on `feat/merge-block-evolution`.
- 3.0.0: modes (Cổ điển, Ca làm, Ca hôm nay, Thư giãn), orders + parts, Xưởng (scrap/XP/rank/blueprints),
  daily seed + streak + `v: 3` share, save v3 (v2 upgrades), mode select, order rail, choice sheet, tickets,
  the Máy Ghép mark, icon, page and OG refreshed.
- Cổ điển's logic, ranked run, verifier replay and contract are unchanged; only Cổ điển is ranked.
- Plan closed. Release: UAT then prod, per `docs/guides/uat.md`.

## 2026-11-08 — agent

- Owner: "MVP ổn"; dive research + brainstorm mechanics/modes/progression/UI/UX and a higher-quality,
  more pull-worthy logo.
- Wrote the brief, map, design, R-01 (modes/progression), R-02 (brand/logo), R-03 (UI/UX),
  R-04 (contract), R-05 (metrics) and D-01..D-13. No code; the classic stays the ranked game.
- Recommendation: 2.1 brand + title/mode select + Orders + light Workshop; 2.2 Daily + telemetry;
  2.3 mascot/cosmetics/Zen; 3.0 versus/server daily later.
- Waiting on the owner: confirm the brief; D-01 (the first slice), D-09 (the logo direction),
  D-13 (the phases).
