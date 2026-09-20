#!/usr/bin/env node

// Refresh docs/launch.json from the Polar LAUNCH discount's redemption count.
// Run by .github/workflows/launch-counter.yml on a schedule; needs
// POLAR_ACCESS_TOKEN (read scope on discounts). Exits 0 without writing when
// the numbers have not changed so the workflow only commits real updates.

const fs = require('fs');
const path = require('path');

const DISCOUNT_ID = process.env.POLAR_DISCOUNT_ID || 'b13bde0f-ac56-4268-862b-c07494ffb76f';
const token = process.env.POLAR_ACCESS_TOKEN;
if (!token) {
  console.error('POLAR_ACCESS_TOKEN is not set');
  process.exit(1);
}

const file = path.resolve(__dirname, '..', 'docs', 'launch.json');

async function main() {
  const res = await fetch(`https://api.polar.sh/v1/discounts/${DISCOUNT_ID}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'User-Agent': 'paidextension-site/1.0' }
  });
  if (!res.ok) throw new Error(`Polar responded ${res.status}: ${await res.text()}`);
  const discount = await res.json();
  if (typeof discount.redemptions_count !== 'number' || typeof discount.max_redemptions !== 'number') {
    throw new Error(`Unexpected discount payload: ${JSON.stringify(discount).slice(0, 200)}`);
  }

  const previous = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const next = {
    code: discount.code,
    max: discount.max_redemptions,
    redeemed: Math.min(discount.redemptions_count, discount.max_redemptions),
    updatedAt: new Date().toISOString()
  };
  if (previous.max === next.max && previous.redeemed === next.redeemed && previous.code === next.code) {
    console.log(`launch.json unchanged (${next.redeemed}/${next.max})`);
    return;
  }
  fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`launch.json updated (${next.redeemed}/${next.max})`);
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
