// Motion: scroll reveal with staggered grids. Degrades to the static page
// when the visitor prefers reduced motion or the browser lacks IntersectionObserver.
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) {
    document.documentElement.classList.add('no-motion');
    return;
  }
  document.documentElement.classList.add('motion');

  // Scroll reveal: sections and their cards fade/slide in once.
  var targets = document.querySelectorAll('section > .wrap > *, .hero-copy > *, .hero-demo, .stats .stat, .grid > .card, .plans > .plan');
  var seen = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in');
      seen.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  var index = 0;
  for (var i = 0; i < targets.length; i++) {
    var t = targets[i];
    t.classList.add('reveal');
    // Stagger siblings inside the same grid.
    var parent = t.parentNode;
    if (parent && (parent.classList.contains('grid') || parent.classList.contains('plans') || parent.classList.contains('stats'))) {
      index = Array.prototype.indexOf.call(parent.children, t);
      t.style.transitionDelay = Math.min(index, 5) * 70 + 'ms';
    }
    seen.observe(t);
  }
})();
