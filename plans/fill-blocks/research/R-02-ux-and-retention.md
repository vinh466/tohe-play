# R-02 — UX, game feel and ethical retention

What makes a calm casual puzzle feel good on a phone, and which progression patterns respect the player. Facts
from UX research and platform guidelines; inference is marked.

## Onboarding

- **Do not open with a deck of tutorial cards.** NN/g tested 70 people: a card deck did not make people faster or
  more successful, and made the task feel harder; contextual help worked better. Short, optional onboarding is
  enough; many apps need none. <https://www.nngroup.com/articles/mobile-tutorials>,
  <https://www.nngroup.com/articles/mobile-app-onboarding>
- Children learn by doing, not by reading: teach at the moment, let them fail, let them retry.
  <https://www.bbc.co.uk/gel/features/how-to-design-onboarding-for-games>
- Block Blast succeeds by putting the board first; 1010! is criticised for not explaining why points happen.
  <https://appwesome.com/blog/block-blast-review-clean-puzzle-loop-weak-recovery-design>,
  <https://www.commonsensemedia.org/app-reviews/1010-color>
- **Lấp Ô**: board-first; a 3-step interactive first run (place, clear, two-line clear); the shell's "Cách chơi"
  remains available with three picture hints; the first move pulses a legal cell.

## Input and feedback

- **Tap-to-place is mandatory**, not a nice-to-have: WCAG 2.5.7 requires every drag function to have a
  single-pointer alternative. <https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html>
- Drag should lift, show a ghost/preview, snap and give a clear drop target; the ghost above the finger avoids
  the hand hiding the target. <https://www.nngroup.com/articles/drag-drop>
- **Touch targets**: Apple 44 × 44 pt, Material 48 × 48 dp, WCAG AA 24 × 24, AAA 44 × 44. An 8 × 8 board on a
  360 px screen gives ~40 px cells after gaps, so snap to the nearest cell and enlarge the hit area.
  <https://developer.apple.com/design/human-interface-guidelines/buttons>,
  <https://m3.material.io/foundations/designing/structure>,
  <https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html>
- **One-handed**: about half of users hold a phone one-handed and most interact with the thumb; comfortable
  reach is at the bottom. Tray at the bottom is right; top-corner menus are hard for a thumb.
  <https://www.uxmatters.com/mt/archives/2013/02/how-do-users-really-hold-mobile-devices.php>,
  <https://alistapart.com/article/how-we-hold-our-gadgets>
- **Feedback timing**: 0.1 s feels instant, 1 s keeps flow. <https://www.nngroup.com/articles/response-times-3-important-limits>
- **Error prevention and undo**: prevent invalid placements, explain why, and allow a step back (NN/g heuristic
  #3/#5). <https://www.nngroup.com/articles/ten-usability-heuristics>
- **Haptics/sound** should match the animation and be optional. <https://developer.apple.com/design/human-interface-guidelines/playing-haptics>,
  <https://developer.android.com/develop/ui/views/haptics/haptics-principles>
- **Reduced motion**: disable non-essential animation with `prefers-reduced-motion`.
  <https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html>
- **Colour is not a channel on its own**; use shape, pattern or text/icon too. 1 in 12 men has a colour-vision
  deficiency. <https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html>,
  <https://www.colourblindawareness.org/colour-blindness/>

## Session shape

- Median mobile session in 2025 was **3.1–3.5 minutes**; top quartile ~5.2; casual/hyper-casual often 5–6.
  <https://www.gameanalytics.com/reports/2026-mobile-pc-gaming-benchmarks>,
  <https://www.gameanalytics.com/reports/2025-mobile-gaming-benchmarks>
- A casual loop should be **under 30 seconds**, with a clear end and a "one more" hook.
  <https://gdevelop.io/blog/casual-game-loops>
- The **end card** should be short, retry prominent, and back in control in under 3 seconds.
  <https://bugnet.io/blog/how-to-design-a-game-over-screen-that-encourages-retry>
- **Resume** after every placement; the shell already has "Chơi tiếp".
- **Personal best** is performance progression; it feeds mastery without pressure.
- **Do not sell a continue**: Block Blast is criticised for "lose → watch ad to continue".
  <https://play.google.com/store/apps/details?id=com.block.juggle>
- **Lấp Ô**: a run 1–5 minutes; journey levels 1–3; end card with retry/next; resume exact.

## Ethical retention

- **Self-Determination Theory**: autonomy, competence and relatedness. A game is fun when it supports these,
  not when it exploits loss aversion. <https://link.springer.com/article/10.1007/s11031-006-9051-8>
- **Mastery** (high score, levels, optional harder goals) is the healthiest long-term driver; it needs no
  currency or power. <https://dl.acm.org/doi/10.1145/3725892>
- **Daily challenge** works like Wordle: one puzzle a day, same for everyone, a clear end, no ads, no grind.
  <https://techcrunch.com/2022/01/12/josh-wardle-interview-wordle>,
  <https://www.gamedeveloper.com/design/the-rise-of-once-a-day-games-lessons-learned-from-wordle-s-legacy>
- **Streaks** exploit loss aversion and can become anxiety; do not punish a missed day and never sell a "streak
  freeze". <https://www.smashingmagazine.com/2026/02/designing-streak-system-ux-psychology/>
- **Unlockable looks/boards** support expression and are safe when earned by play, not random or purchased.
  <https://journals.sagepub.com/doi/10.1177/15554120241242332>
- **Leaderboards** can motivate or pressure; use them as information, not as a gate to content.
  <https://dl.acm.org/doi/epdf/10.1145/2583008.2583017>
- Tò He forbids ads, IAP and tracking. [Vision](../../../docs/vision.md)
- Avoid: energy, countdown/FOMO, loot boxes, pay-to-continue, streak loss. The German consumer advice centre's
  paper on manipulative game design is a useful checklist.
  <https://www.vzbv.de/sites/default/files/2025-04/25-03-11_Additional_information_vzbv_manipulative_design_online-games.pdf>

## UI patterns

- **Visual hierarchy**: contrast, scale, grouping; at most a few sizes/weights.
  <https://www.nngroup.com/articles/visual-hierarchy-ux-definition/>
- **Progressive disclosure**: show the core first; menus one level deep.
  <https://www.nngroup.com/articles/progressive-disclosure>,
  <https://developer.apple.com/design/human-interface-guidelines/menus>
- **Icon + word**: icons are ambiguous alone; label them. The kit already does this.
  <https://www.nngroup.com/articles/icon-usability/>
- **Recognition over recall**: keep the board, tray, score and best visible.
  <https://www.nngroup.com/articles/ten-usability-heuristics>
- **Animation**: 0.1 s to connect cause and effect; repeated animation becomes noise.
  <https://www.nngroup.com/articles/animation-usability/>

## Accessibility

- Text contrast 4.5:1; large text 3:1; non-text UI 3:1.
  <https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html>,
  <https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html>
- Use shape + colour + text/icon; follow the Game Accessibility Guidelines.
  <https://gameaccessibilityguidelines.com/basic/>
- Reduce motion; support sound/haptics off; no reading required for a young child.
  <https://developers.google.com/building-for-kids/designing-engaging-apps>

## What players criticise

- Block Blast: ads mid-placement, unskippable ads, a piece that "cannot fit" then an ad offer, no undo, weak
  recovery feedback, little progression/leaderboard.
- Woodoku: ads after each win/loss, lost progress on crash, no rotation, daily challenge becoming a chore,
  "rigged" draws.
- 1010!: no explanation of scoring, heavy ads even after paying, Adventure Mode breaking the calm.
- Block Blast's good parts: no IAP, no energy, streak with no reward/punishment.

## Implications for Lấp Ô

1. Board first; 3 interactive hints, not a deck.
2. Tap-to-place mandatory; drag optional; ghost above the finger; snap; 44 px targets.
3. End card < 3 s to retry; resume exact; no "continue for ad".
4. Soft combo + undo/rescue instead of a punishing reset; explain the score in the how-to.
5. Journey levels, daily calendar, mastery rank, unlockable skins; no energy/streak/FOMO.
6. Colour + shape; reduced motion; sound/haptics optional; no reading for a 3-year-old.
7. Keep the tray at the bottom; keep menus one level deep; icon + word.

## Sources

The inline links above, plus:
- <https://www.nngroup.com/articles/deceptive-patterns/>
- <https://developer.apple.com/design/human-interface-guidelines/accessibility>
- <https://m1.material.io/usability/accessibility.html>
- <https://joanganzcooneycenter.org/wp-content/uploads/2020/02/SesameWorkshop-2012.pdf>
