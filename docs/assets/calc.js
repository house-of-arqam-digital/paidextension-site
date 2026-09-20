// Live rows of the comparison table: what you keep per month on each stack,
// from three sliders and a handful of editable assumptions. The defaults are
// the published figures at the time of writing (see the footnote in the HTML).
(function () {
  var root = document.getElementById('compare');
  if (!root) return;

  var inputs = {};
  var fields = root.querySelectorAll('[data-input]');
  for (var i = 0; i < fields.length; i++) inputs[fields[i].getAttribute('data-input')] = fields[i];

  var out = {};
  var outs = root.querySelectorAll('[data-out]');
  for (var j = 0; j < outs.length; j++) out[outs[j].getAttribute('data-out')] = outs[j];

  function num(name) {
    var v = parseFloat(inputs[name].value);
    return isFinite(v) ? v : 0;
  }
  function money(n) {
    var sign = n < 0 ? '−' : '';
    n = Math.abs(n);
    return sign + '$' + (n >= 1000 ? Math.round(n).toLocaleString('en-US') : n.toFixed(n < 10 && n !== Math.round(n) ? 2 : 0));
  }
  function setText(name, text) {
    if (out[name]) out[name].textContent = text;
  }

  function compute() {
    var price = num('price');
    var sales = num('sales');
    var users = num('users');
    var gross = price * sales;

    // PaidExtension: Paddle 5% + 50¢ per sale, $0 infra inside the free tiers.
    // Free tier: Workers 100k req/day; each active install renews its
    // entitlement every 3 days plus a status check → ~1 req/day/user.
    var paddle = sales * (price * 0.05 + 0.5);
    var usInfra = users > 90000 ? 5 : 0;
    var usKeep = gross - paddle - usInfra;

    // Without a merchant of record, sales tax is yours: a calculation tool
    // (Stripe Tax 0.5% per transaction) plus registrations/filings.
    var tax = gross * (num('taxRate') / 100) + num('tax');

    // Hosted payments SDK: their cut + Stripe processing, tax still yours.
    var sdkCut = sales * (price * (num('sdkRate') / 100));
    var stripe = sales * (price * 0.029 + 0.3);
    var sdkKeep = gross - sdkCut - stripe - tax;

    // DIY: Stripe + a hosted backend/db bill (Supabase Pro / Firebase Blaze…).
    var hosting = num('hosting');
    var diyKeep = gross - stripe - hosting - tax;

    setText('gross', money(gross));
    setText('usKeep', money(usKeep));
    setText('sdkKeep', money(sdkKeep));
    setText('diyKeep', money(diyKeep));
    setText('usCost', money(paddle) + ' fees · ' + money(usInfra) + ' infra · tax included');
    setText('sdkCost', money(sdkCut + stripe) + ' fees · $0 infra · ' + money(tax) + ' tax');
    setText('diyCost', money(stripe) + ' fees · ' + money(hosting) + ' infra · ' + money(tax) + ' tax');

    var delta = usKeep - Math.max(sdkKeep, diyKeep);
    var abs = Math.abs(delta);
    setText('delta', delta >= 0
      ? 'PaidExtension keeps ' + money(abs) + '/month more than the next best stack — ' + money(abs * 36) + ' over three years, and Paddle files the sales tax.'
      : 'On paper the next best stack keeps ' + money(abs) + '/month more — before your own hours registering and filing sales tax in every jurisdiction.');

    setText('priceEcho', money(price));
    setText('salesEcho', String(sales));
    setText('usersEcho', users >= 1000 ? (users / 1000).toFixed(users % 1000 ? 1 : 0) + 'k' : String(users));
    setText('freeTier', users > 90000 ? 'Your installs are above the Workers free tier, so the $5/month plan is counted.' : 'Your installs fit inside the Cloudflare Workers + KV free tier.');
  }

  root.addEventListener('input', compute);
  compute();
})();
