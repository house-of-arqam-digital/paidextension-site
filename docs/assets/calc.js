// Cost calculator: what you keep per month on three stacks, from a handful of
// editable assumptions. Every rate is an input so the visitor can plug in the
// vendor's current pricing; the defaults are the published figures at the
// time of writing (see the footnote in the HTML).
(function () {
  var root = document.getElementById('calc');
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
    return sign + '$' + (n >= 1000 ? Math.round(n).toLocaleString('en-US') : n.toFixed(n < 10 ? 2 : 0));
  }
  function setText(name, text) {
    if (out[name]) out[name].textContent = text;
  }
  function setBar(name, value, max) {
    if (!out[name]) return;
    var pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
    out[name].style.width = pct.toFixed(1) + '%';
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
    var workersPaid = users > 90000 ? 5 : 0;
    var usInfra = workersPaid;
    var usKeep = gross - paddle - usInfra;

    // Without a merchant of record, sales tax is yours: a calculation tool
    // (Stripe Tax 0.5% per transaction) plus registrations/filings.
    var taxCalc = gross * (num('taxRate') / 100);
    var taxFixed = num('tax');
    var tax = taxCalc + taxFixed;

    // Hosted payments SDK: their cut + Stripe processing, tax still yours.
    var sdkRate = num('sdkRate') / 100;
    var sdkCut = sales * (price * sdkRate);
    var stripe1 = sales * (price * 0.029 + 0.3);
    var sdkKeep = gross - sdkCut - stripe1 - tax;

    // DIY: Stripe + a hosted backend/db bill (Supabase Pro / Firebase Blaze…).
    var hosting = num('hosting');
    var stripe2 = sales * (price * 0.029 + 0.3);
    var diyKeep = gross - stripe2 - hosting - tax;

    setText('gross', money(gross));
    setText('usFees', money(paddle));
    setText('usInfra', usInfra ? money(usInfra) : '$0');
    setText('usKeep', money(usKeep));
    setText('sdkFees', money(sdkCut + stripe1));
    setText('sdkTax', money(tax));
    setText('sdkKeep', money(sdkKeep));
    setText('diyFees', money(stripe2));
    setText('diyInfra', money(hosting));
    setText('diyTax', money(tax));
    setText('diyKeep', money(diyKeep));

    var max = Math.max(usKeep, sdkKeep, diyKeep, 1);
    setBar('usBar', usKeep, max);
    setBar('sdkBar', sdkKeep, max);
    setBar('diyBar', diyKeep, max);

    var best = Math.max(sdkKeep, diyKeep);
    var delta = usKeep - best;
    var abs = Math.abs(delta);
    setText('delta', delta >= 0
      ? 'PaidExtension keeps ' + money(abs) + '/month more than the next best stack — ' + money(abs * 36) + ' over three years, with no tax filings.'
      : 'On paper the next best stack keeps ' + money(abs) + '/month more — before your own hours registering and filing sales tax in every jurisdiction.');
    setText('taxNote', gross > 0 ? 'Paddle is the merchant of record: it collects and remits the sales tax on ' + money(gross) + ' of monthly revenue and issues the invoices. On the other two stacks that is your job, costed here at ' + money(tax) + '/month.' : '');

    // Echo slider values.
    setText('priceEcho', money(price));
    setText('salesEcho', String(sales));
    setText('usersEcho', users >= 1000 ? (users / 1000).toFixed(users % 1000 ? 1 : 0) + 'k' : String(users));
    setText('freeTier', users > 90000 ? 'Above the Workers free tier — the $5/month paid plan kicks in.' : 'Inside the Cloudflare Workers + KV free tier.');
  }

  root.addEventListener('input', compute);
  compute();
})();
