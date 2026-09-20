// Polar appends ?customer_session_token=… when it redirects here after
// checkout. Passing it to the customer portal signs the buyer in directly, so
// "Connect GitHub" is one click instead of an email code round-trip. Without
// the token (page revisited later) the link falls back to the plain portal URL
// already in the markup.
(function () {
  var link = document.getElementById('portal-link');
  if (!link) return;
  var params = new URLSearchParams(window.location.search);
  var token = params.get('customer_session_token');
  if (!token || !/^[A-Za-z0-9_-]+$/.test(token)) return;
  link.setAttribute(
    'href',
    link.getAttribute('href') + '?customer_session_token=' + encodeURIComponent(token)
  );
  if (window.history && window.history.replaceState) {
    window.history.replaceState(null, '', window.location.pathname);
  }
})();
