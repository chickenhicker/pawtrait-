# Pawtrait × Printify backend

This is the piece that actually connects to **your own** Printify account. Your
API token lives here, on the server — never in the website's front-end code —
because anything shipped to a browser is visible to whoever opens dev tools.

## 1. Get a Printify store and API token

1. Create a Printify account at printify.com if you don't have one.
2. In Printify, open the menu in the top-left and choose **Add a new store**.
   You need at least one store on the account for products/orders to belong
   to — pick whichever sales channel option fits (this backend talks to
   Printify directly, so the site behind the "store" doesn't matter).
3. Go to **My Profile → Connections**, click **Generate**, name the token,
   and copy it somewhere safe. It's only shown once.

## 2. Configure this project

```bash
cd printify-backend
npm install
cp .env.example .env
```

To test locally before deploying, run `npm run dev` — this starts the same
app on `http://localhost:3001` via the small `server.js` runner. Vercel
itself never uses `server.js`; it calls `api/index.js` directly.

Open `.env` and paste in `PRINTIFY_API_TOKEN`. Leave `PRINTIFY_SHOP_ID` blank
for now.

## 3. Find your shop ID

```bash
npm start
# in another terminal:
curl http://localhost:3001/api/shops
```

You'll get back a list of your stores with their `id`. Copy the one you want
and put it in `.env` as `PRINTIFY_SHOP_ID`, then restart the server.

## 4. What each route does

| Route | Purpose |
|---|---|
| `GET /api/shops` | List your Printify stores (one-time setup) |
| `GET /api/catalog/blueprints` | Browse product types (mug, tee, tote, etc.) |
| `GET /api/catalog/blueprints/:id/providers` | Print providers for that product |
| `GET /api/catalog/blueprints/:id/providers/:providerId/variants` | Sizes/colors + Printify's base cost |
| `GET /api/products` | Products currently in your shop |
| `POST /api/upload-image` | Send a photo into your Printify media library — returns an `image_id` |
| `POST /api/create-product` | Create a real product in your shop using that image |
| `POST /api/products/:id/publish` | Mark a product published (for storefront-connected shops) |
| `POST /api/orders` | Submit a paid order to production |

The full request/response shape for each Printify endpoint is documented at
https://developers.printify.com/.

## 5. A typical "upload a pet photo → real product" flow

```
1. POST /api/upload-image        { fileName, base64 }        → { id: imageId }
2. GET  /api/catalog/blueprints   (once, to find blueprint_id + print_provider_id you want)
3. GET  /api/catalog/blueprints/:id/providers/:providerId/variants  (to get variant ids/prices)
4. POST /api/create-product      { title, blueprintId, printProviderId, imageId, variantIds }
```

Step 4 returns Printify-generated mockup images of the real product —
those are what you'd show the customer as the final preview, instead of the
illustrated SVG mockups in the demo site.

## 6. Deploying it — free, no card, on Vercel

This project is already set up as a Vercel serverless function
(`api/index.js` + `vercel.json`), which is genuinely free on Vercel's Hobby
plan — no card required, and no 15-minute sleep/spin-down like some other
free tiers have.

1. Push this folder to a GitHub repo (create one at github.com → New
   repository → upload these files, or `git init && git add . && git commit
   -m "init" && git push`).
2. Go to **vercel.com** → sign up with your GitHub account (free, no card).
3. **Add New… → Project** → import the repo.
4. Before clicking Deploy, open **Environment Variables** and add
   `PRINTIFY_API_TOKEN` (your token from step 1). Leave `PRINTIFY_SHOP_ID`
   blank for now → **Deploy**.
5. You'll get a URL like `https://your-app.vercel.app`. Visit
   `https://your-app.vercel.app/api/shops` in your browser to see your
   store(s) and their `id`.
6. Back in Vercel → your project → **Settings → Environment Variables**, add
   `PRINTIFY_SHOP_ID` with that value → **Deployments** tab → **Redeploy**.

That's it — your backend is live at no cost. Update the `fetch()` calls in
`pawtrait.html` to point at that `vercel.app` URL instead of the built-in
demo data.

**Other free options**, if you'd rather not use Vercel:
- **Render's free tier** (not the $7/mo Starter tier) works too — it's $0,
  but the service falls asleep after 15 minutes idle and takes ~30 seconds
  to wake up on the next request. Fine for testing, mildly annoying for a
  live storefront.
- **Fly.io** has a small free allowance and stays warm, but setup is a bit
  more involved (Dockerfile + CLI).

## Why this has to be a separate server

The Pawtrait site you have as a Claude-published page runs in a locked-down
sandbox that only allows a handful of script/font hosts — it can't call
`api.printify.com` (or any other external API) directly, and it has nowhere
safe to keep a secret token even if it could. A tiny server like this one,
hosted wherever you like, is what makes the real connection.
