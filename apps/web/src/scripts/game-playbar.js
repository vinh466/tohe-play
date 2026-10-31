// A game page's play bar on a phone: hidden over the hero (which already has a Play button), then fixed at the bottom
// once the hero has scrolled past. A file, not an inline script, because the public pages' CSP forbids inline code.
(() => {
  const bar = document.querySelector('.game-playbar');
  const hero = document.querySelector('.game-hero');
  if (!bar || !hero || !('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver(
    ([entry]) => {
      bar.toggleAttribute('data-shown', !entry.isIntersecting);
    },
    { rootMargin: '0px 0px -40% 0px' },
  );
  observer.observe(hero);
})();
