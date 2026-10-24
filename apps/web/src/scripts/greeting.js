// Greets a device that has played here, by the name of who played last and the game they opened (ADR 0055,
// docs/architecture/surfaces.md): the home page's hero shows "Chào lại, An!" with *Chơi tiếp Ghép Khối*, *Vào Tò He*
// and "Không phải An?" in place of its two buttons. returning.js has already marked the page (`data-returning` on
// <html>), so the stylesheet shows the card before the first paint; this file, a blocking classic script placed right
// after the card (the page's CSP forbids inline scripts), fills in its words before the card paints. It never
// navigates: `/` never redirects, a link to it always shows it.
//
// What the app keeps in this origin's localStorage, written where it notes "opened" (apps/hub/src/launcher/recent.ts):
//   tohe:greeting   {"id": the profile, "name", "avatar", "game": the game's id}
// The card carries the rest as data: the words with {name} and {game} (data-hello, data-play, data-not-you), and each
// game's name in the page's language and its address in the app (data-games). Without a greeting, or with one this
// page cannot read, the card keeps its plain words: "Chào lại!" and *Chơi tiếp* to the app.
(() => {
  try {
    const card = document.querySelector('[data-greeting-card]');
    if (!card) return;
    const kept = JSON.parse(localStorage.getItem('tohe:greeting') ?? 'null');
    if (
      !kept ||
      typeof kept.name !== 'string' ||
      typeof kept.avatar !== 'string' ||
      typeof kept.game !== 'string'
    )
      return;
    const games = JSON.parse(card.getAttribute('data-games') ?? '{}');
    const game = Object.hasOwn(games, kept.game) ? games[kept.game] : null;
    const fill = (template, values) => template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
    const part = (name) => card.querySelector(`[data-greeting="${name}"]`);

    part('avatar').textContent = kept.avatar;
    part('hello').textContent = fill(card.getAttribute('data-hello') ?? '', { name: kept.name });
    const notYou = part('not-you');
    notYou.textContent = fill(card.getAttribute('data-not-you') ?? '', { name: kept.name });
    if (game) {
      const play = part('play');
      play.textContent = fill(card.getAttribute('data-play') ?? '', { game: game.name });
      play.setAttribute('href', game.href);
    }
    // Named: the avatar, "Vào Tò He" (which differs from Chơi tiếp now) and "Không phải An?" show.
    card.setAttribute('data-named', '');
  } catch {
    // Storage blocked, or a greeting from another version: the plain card.
  }
})();
