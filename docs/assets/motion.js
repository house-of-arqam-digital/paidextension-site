// Motion: scroll reveal, a terminal that types itself, and a stepped
// "how licensing works" flow. Everything degrades to the static page when
// the visitor prefers reduced motion or the browser lacks IntersectionObserver.
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) {
    document.documentElement.classList.add('no-motion');
    return;
  }
  document.documentElement.classList.add('motion');

  // Scroll reveal: sections and their cards fade/slide in once.
  var targets = document.querySelectorAll('section > .wrap > *, .hero-copy > *, .hero-demo, .stats .stat, .grid > .card, .flow > .card, .plans > .plan');
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
    if (parent && (parent.classList.contains('grid') || parent.classList.contains('flow') || parent.classList.contains('plans') || parent.classList.contains('stats'))) {
      index = Array.prototype.indexOf.call(parent.children, t);
      t.style.transitionDelay = Math.min(index, 5) * 70 + 'ms';
    }
    seen.observe(t);
  }

  // Typing terminal: the <pre> types itself line by line the first time it
  // scrolls into view. Comment spans keep their color because we rebuild the
  // same nodes character by character.
  var terminals = document.querySelectorAll('[data-typing]');
  var typed = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      typed.unobserve(entry.target);
      typeOut(entry.target);
    });
  }, { threshold: 0.4 });
  for (var k = 0; k < terminals.length; k++) typed.observe(terminals[k]);

  function typeOut(pre) {
    var code = pre.querySelector('code') || pre;
    var source = Array.prototype.slice.call(code.childNodes);
    var plan = [];
    source.forEach(function (node) {
      if (node.nodeType === 3) {
        plan.push({ cls: null, text: node.textContent });
      } else if (node.nodeType === 1) {
        plan.push({ cls: node.className, text: node.textContent });
      }
    });
    code.textContent = '';
    var cursor = document.createElement('span');
    cursor.className = 'cursor';
    code.appendChild(cursor);
    pre.classList.add('typing');

    var chunk = 0;
    var pos = 0;
    var current = null;
    function step() {
      if (chunk >= plan.length) {
        pre.classList.remove('typing');
        pre.classList.add('typed');
        return;
      }
      var part = plan[chunk];
      if (!current) {
        current = part.cls ? document.createElement('span') : document.createTextNode('');
        if (part.cls) current.className = part.cls;
        code.insertBefore(current, cursor);
      }
      var ch = part.text.charAt(pos);
      current.textContent += ch;
      pos++;
      var delay = ch === '\n' ? 260 : part.cls ? 6 : 22;
      if (pos >= part.text.length) { chunk++; pos = 0; current = null; }
      setTimeout(step, delay);
    }
    step();
  }

  // Flow: light the four licensing steps up in sequence when the row appears.
  var flows = document.querySelectorAll('.flow');
  var flowSeen = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      flowSeen.unobserve(entry.target);
      var steps = entry.target.querySelectorAll('.card');
      for (var s = 0; s < steps.length; s++) {
        (function (card, n) { setTimeout(function () { card.classList.add('lit'); }, 350 + n * 450); })(steps[s], s);
      }
    });
  }, { threshold: 0.3 });
  for (var f = 0; f < flows.length; f++) flowSeen.observe(flows[f]);
})();
