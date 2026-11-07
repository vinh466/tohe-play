# D-08 — The UI/UX pass

Status: open (blocked by D-02, D-04, D-05). Kind: decision.

## Question

How do the Orders, the Workshop, the Daily and the game-over story fit the existing HUD and the
family's constraints (320 px, one hand, light/dark, a11y) without crowding the machine?

## The pieces

- **Orders rail**: one line on the top beam (the order value + progress + reward + the next dot);
  a completion stamp over the board; a 1-of-3 choice sheet over the panel; a small part strip beside
  the gauge (the parts' effects are visible in the machine). The classic has no rail.
- **Workshop**: the machine at the top, three blueprint slots in a row, the scrap/level pills, a
  tab for the cosmetics; the part card on tap; the stat parts labelled "chỉ trong Ca làm"; no
  timers.
- **Daily**: the title card (the date stamp, the streak, the best, the play/share); the game-over
  line with the date/streak; no countdown; no streak-shaming.
- **Game over**: the ticket (today's shape) + the run story: the mode, the orders, the shipped, the
  biggest, the scrap, the XP/level, the parts; one primary ("Chơi lại"), the Workshop (if scrap),
  the challenge/daily, the menu.
- **Onboarding**: the four beats (D-07) with the existing hand/aim/ring; a skip; the "Cách chơi".
- **A11y**: the order/daily/parts use a value + a shape/word, not colour only; the canvas HUD gets
  ARIA labels/roles; the large text; the reduced motion (the rows still slide; the jolt flashes);
  the sound/haptics settings; the 320/360/390/tablet/landscape screenshots.

## Recommendation

The pieces above, with the **classic HUD unchanged** and the new elements only in their modes. The
Orders rail is one line; the Workshop is one screen; the Daily is a card, not a calendar; the game
over is the ticket + the story. The a11y and 320 are in the slice. The UI uses the kit's tokens/
components; no new visual language.

## Cost and risks

The layout work, the new screens, the empty/loading/error states, the a11y, the screenshots, the
tests. The risk is the HUD/title becoming a dashboard; the "one line/one screen/one card" rules
keep it honest.

## What would change my mind

- The Orders rail does not fit the top beam at 320: move it into the HUD's middle (the kit's center)
  or a collapsible strip under the score.
- The Workshop is too much for the first slice: ship the "blueprints only" (a list) and the full
  screen in 2.2.
