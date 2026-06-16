import fs from "node:fs/promises";
import path from "node:path";

const plans = {
  basic: { name: "Basic", monthlyPrice: 7, yearlyPrice: 70 },
  pro: { name: "Pro", monthlyPrice: 15, yearlyPrice: 120 },
  advanced: { name: "Advanced", monthlyPrice: 25, yearlyPrice: 230 },
};

const stripeKey = process.env.STRIPE_SECRET_KEY;
if (!stripeKey) {
  console.error("Missing STRIPE_SECRET_KEY in environment.");
  process.exit(1);
}
if (!stripeKey.startsWith("sk_test_")) {
  console.error("Expected a test key (sk_test_...) for this run.");
  process.exit(1);
}

const stripeApi = "https://api.stripe.com/v1";
const stripeHeaders = {
  Authorization: `Bearer ${stripeKey}`,
  "Content-Type": "application/x-www-form-urlencoded",
};

const stripePost = async (path, body) => {
  const response = await fetch(`${stripeApi}${path}`, {
    method: "POST",
    headers: stripeHeaders,
    body: new URLSearchParams(body),
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.error?.message || `Stripe API error on ${path}`);
  }
  return json;
};

const stripeGet = async (path, query = {}) => {
  const url = new URL(`${stripeApi}${path}`);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v));
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${stripeKey}` },
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.error?.message || `Stripe API error on ${path}`);
  }
  return json;
};

const getOrCreateProduct = async (name, interval) => {
  const fullName = `${name} (${interval === "month" ? "Monthly" : "Yearly"})`;
  const lookupKey = `ytgp_${name.toLowerCase()}_${interval}`;
  const existing = await stripeGet("/products", { active: true, limit: 100 });
  const found = (existing.data ?? []).find((p) => p?.metadata?.lookup_key === lookupKey);
  if (found) return found;
  return stripePost("/products", {
    name: fullName,
    "metadata[lookup_key]": lookupKey,
  });
};

const getOrCreatePrice = async (productId, amountUsd, interval, planKey) => {
  const lookupKey = `ytgp_${planKey}_${interval}_${amountUsd}usd`;
  const existing = await stripeGet("/prices", { active: true, product: productId, limit: 100 });
  const targetAmount = Math.round(amountUsd * 100);
  const found = (existing.data ?? []).find(
    (p) => p?.lookup_key === lookupKey || (p?.unit_amount === targetAmount && p?.recurring?.interval === interval)
  );
  if (found) return found;
  return stripePost("/prices", {
    product: productId,
    currency: "usd",
    unit_amount: String(targetAmount),
    "recurring[interval]": interval,
    lookup_key: lookupKey,
  });
};

const out = {};
for (const [key, cfg] of Object.entries(plans)) {
  const monthlyProduct = await getOrCreateProduct(cfg.name, "month");
  const yearlyProduct = await getOrCreateProduct(cfg.name, "year");
  const monthlyPrice = await getOrCreatePrice(monthlyProduct.id, cfg.monthlyPrice, "month", key);
  const yearlyPrice = await getOrCreatePrice(yearlyProduct.id, cfg.yearlyPrice, "year", key);
  out[key] = {
    productId: monthlyProduct.id,
    yearlyProductId: yearlyProduct.id,
    monthlyPriceId: monthlyPrice.id,
    yearlyPriceId: yearlyPrice.id,
  };
}

const targetPath = path.resolve("src/lib/stripeConfig.ts");
let content = await fs.readFile(targetPath, "utf8");

for (const [planKey, ids] of Object.entries(out)) {
  const blockRegex = new RegExp(`${planKey}:\\s*\\{[\\s\\S]*?\\n\\s*\\},`, "m");
  const block = content.match(blockRegex)?.[0];
  if (!block) {
    console.error(`Could not locate block for plan: ${planKey}`);
    process.exit(1);
  }
  const nextBlock = block
    .replace(/productId:\s*"[^"]+"/, `productId: "${ids.productId}"`)
    .replace(/yearlyProductId:\s*"[^"]+"/, `yearlyProductId: "${ids.yearlyProductId}"`)
    .replace(/monthlyPriceId:\s*"[^"]+"/, `monthlyPriceId: "${ids.monthlyPriceId}"`)
    .replace(/yearlyPriceId:\s*"[^"]+"/, `yearlyPriceId: "${ids.yearlyPriceId}"`);
  content = content.replace(block, nextBlock);
}

await fs.writeFile(targetPath, content, "utf8");

console.log("Stripe plans synced (test mode) and stripeConfig.ts updated:");
console.log(JSON.stringify(out, null, 2));
