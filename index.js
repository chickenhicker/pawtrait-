// Pawtrait × Printify backend
// This is the piece that actually talks to YOUR Printify account.
// The front-end (pawtrait.html) never sees your API token — it only ever
// calls these routes, and this server calls Printify on your behalf.

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' })); // pet photos arrive as base64, so allow a generous body size

const PRINTIFY_BASE = 'https://api.printify.com/v1';
const TOKEN = process.env.PRINTIFY_API_TOKEN;
const SHOP_ID = process.env.PRINTIFY_SHOP_ID;

if (!TOKEN) console.warn('⚠️  PRINTIFY_API_TOKEN is missing — set it in your .env file.');
if (!SHOP_ID) console.warn('⚠️  PRINTIFY_SHOP_ID is missing — call GET /api/shops once to find it, then set it in your .env file.');

async function printify(path, options = {}) {
  const res = await fetch(`${PRINTIFY_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.errors ? JSON.stringify(data.errors) : `Printify responded ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const handle = (fn) => async (req, res) => {
  try {
    res.json(await fn(req));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
};

// ---- Setup helper: run this once to find your shop_id ----
app.get('/api/shops', handle(() => printify('/shops.json')));

// ---- Catalog: browse product types (blueprints), their print providers, and variants (sizes/colors) ----
app.get('/api/catalog/blueprints', handle(() => printify('/catalog/blueprints.json')));
app.get('/api/catalog/blueprints/:id/providers', handle((req) =>
  printify(`/catalog/blueprints/${req.params.id}/print_providers.json`)));
app.get('/api/catalog/blueprints/:id/providers/:providerId/variants', handle((req) =>
  printify(`/catalog/blueprints/${req.params.id}/print_providers/${req.params.providerId}/variants.json`)));

// ---- Products already living in your shop ----
app.get('/api/products', handle(() => printify(`/shops/${SHOP_ID}/products.json`)));
app.get('/api/products/:id', handle((req) => printify(`/shops/${SHOP_ID}/products/${req.params.id}.json`)));

// ---- Step 1 of "upload to Printify": send an image into your Printify media library ----
// body: { fileName: 'biscuit.png', base64: '<raw base64, no "data:image/..." prefix>' }
app.post('/api/upload-image', handle((req) => {
  const { fileName, base64 } = req.body;
  if (!fileName || !base64) { const e = new Error('fileName and base64 are required'); e.status = 400; throw e; }
  return printify('/uploads/images.json', {
    method: 'POST',
    body: JSON.stringify({ file_name: fileName, contents: base64 }),
  });
}));

// ---- Step 2: create the actual product in your shop, placing that image on it ----
// body: { title, description, blueprintId, printProviderId, imageId, variantIds: [111, 112, ...] }
app.post('/api/create-product', handle((req) => {
  const { title, description, blueprintId, printProviderId, imageId, variantIds } = req.body;
  const payload = {
    title,
    description: description || '',
    blueprint_id: blueprintId,
    print_provider_id: printProviderId,
    variants: variantIds.map((id) => ({ id, price: 2000, is_enabled: true })), // price is in cents — set per product
    print_areas: [
      {
        variant_ids: variantIds,
        placeholders: [
          { position: 'front', images: [{ id: imageId, x: 0.5, y: 0.5, scale: 1, angle: 0 }] },
        ],
      },
    ],
  };
  return printify(`/shops/${SHOP_ID}/products.json`, { method: 'POST', body: JSON.stringify(payload) });
}));

// ---- Publish a product (needed for storefront-connected shops like Shopify/Etsy) ----
app.post('/api/products/:id/publish', handle((req) =>
  printify(`/shops/${SHOP_ID}/products/${req.params.id}/publish.json`, {
    method: 'POST',
    body: JSON.stringify({ title: true, description: true, images: true, variants: true }),
  })));

// ---- Send a completed order to production ----
// body: standard Printify order payload — see developers.printify.com "Submit order"
app.post('/api/orders', handle((req) =>
  printify(`/shops/${SHOP_ID}/orders.json`, { method: 'POST', body: JSON.stringify(req.body) })));

// No app.listen() here — Vercel calls this exported app directly as a serverless function.
export default app;
