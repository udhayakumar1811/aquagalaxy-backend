# AquaGalaxy — Master Final Report

## Addendum 2 — mobile navigation, mobile hero, checkout UPI UX (latest session)

Three new, genuine, root-caused bugs — none were in the earlier reported list, all confirmed by tracing actual code, not guessed. **Note:** partway through this session the sandbox environment was reset (a fresh container, unrelated to anything in the project) and the live working copy was lost; it was recovered by re-extracting the previously-delivered zip and re-applying these three fixes identically on top of it, then re-verified from scratch (`node --check` + a full frontend `esbuild` bundle) rather than assumed to still be correct.

1. **Mobile hamburger menu opened but every link was unclickable.** Root cause: a CSS stacking-context trap, not a React/routing bug (the `NavLink`/`onClick` wiring in `Navbar.jsx` was already entirely correct). `.navbar` uses `position: sticky` + a `z-index`, which creates its own stacking context — every descendant's `z-index` (including `.menu`'s `1100`) is only ever compared against *other elements inside `.navbar`*. `.menu-backdrop`, however, was rendered as a **sibling of `<nav>`**, not a descendant — so it stacked at the *document* level (`1050`) against `.navbar`'s own document-level value (`1000`), and the whole navbar — drawer included — lost, silently absorbing every click meant for the menu links underneath. Fixed by moving `.menu-backdrop` to render **inside** `<nav>` (`Navbar.jsx`), so it now competes locally against `.menu` exactly as the z-index values (`1100` vs `1050`) were already authored to expect. Deliberately did *not* fix this by just raising `.navbar`'s z-index — surveyed every z-index in the frontend first and found a Gallery lightbox (`Gallery.css`, `z-index:1000`) and the Admin dashboard's own sidebar overlay (`z-index:1150`/`1200`) that could have collided with a blanket z-index bump, since `<Navbar>` renders globally on every route including `/admin`. The DOM-nesting fix is fully self-contained and touches nothing else. (Separately confirmed the Admin dashboard's own mobile sidebar does **not** have this bug — its backdrop and drawer are true siblings under a non-stacking-context parent, so their z-index values already compare correctly.)
2. **Mobile hero section consumed the entire screen.** `.hero`'s `@media (max-width: 768px)` block re-declared `min-height: 100vh`, forcing the section to fill the whole viewport on every phone regardless of how little content it holds. Reduced to `60vh`/`60dvh` with matching padding reduction, mobile-only — desktop (`>768px`) is completely unchanged.
3. **Checkout UPI payment was a dead end when unconfigured.** The UPI radio option was always selectable (and was the *default* selected method) regardless of whether `settings.payment.upiId`/`upiQrImage` were actually set, showing the literal string "UPI ID not configured yet" while still requiring a UTR to submit — exactly the reported "customer doesn't know how to pay" symptom. Fixed in `Checkout.jsx`: added `upiConfigured`/`bankConfigured` checks; both radios now disable (matching the pre-existing Razorpay-disabled visual pattern) when their method isn't configured, with a clear "UPI payment is currently unavailable. Please choose another payment method." message replacing the broken form; the UTR/screenshot fields only render for an actually-usable method; added a one-time effect that silently switches the default selection away from "UPI" to Razorpay/BankTransfer if UPI turns out to be unconfigured once settings load (never overrides an explicit customer choice); added a matching server-submission guard as defense in depth. The already-correct instruction→UTR→screenshot ordering was left alone; only added explicit "Step 1/Step 2" framing to the already-present UPI instructions.

Also ran a full routing audit: built the actual route map from `App.jsx` and cross-checked every `Link`/`navigate()` target referencing `/shop`, `/product`, `/category` against it — all consistent (`/shop/:id` is the real product-detail route, and every product card/link in `TopSelling.jsx`, `Search.jsx`, `Shop.jsx` already uses that exact pattern; no `/product/:id` mismatch exists anywhere). No routing bugs found.

Backend was untouched this session (all three fixes above are frontend-only).

## Addendum 1 — runtime crash fixes (prior session)

This session was triggered by a live crash report from the user's own local machine (`D:\wegrow\react\AquaGalaxy`, MongoDB Atlas already connected successfully). **Important scope note:** this working environment is an isolated sandbox with its own copy of the project — it has no access to the user's Windows machine, their local dev servers, or their live Atlas cluster. Everything below is a code-level fix and inspection, not something run against the user's actual running instance. The user needs to pull this updated code into their local checkout to get these fixes.

Three concrete, root-caused bugs, found by inspecting the actual reported files (not guessed):

1. **`TypeError: next is not a function` crashing every product create/update** — `backend/models/productModel.js`'s `pre("save")` hook was declared `async function (next) { ... next(); }`. In Mongoose 9.x (confirmed installed version), an async pre-hook is never passed a `next` callback — completion is signaled by the returned promise, so `next` was `undefined` and calling it threw on every single save. Fixed by removing the `next` parameter/call; the slug-generation logic itself is byte-for-byte unchanged. Checked every other model in the project for the same pattern (`grep -rn "\.pre(\|\.post("` across `models/`) — this was the only pre/post hook in the entire codebase, so no other model had this bug.
2. **`Duplicate schema index on {"code":1}` warning** — `backend/models/couponModel.js` had `code: { unique: true }` (which auto-creates a unique index) *and* a separate explicit `couponSchema.index({ code: 1 })` a few lines below — the same index declared twice. Removed the redundant explicit line; uniqueness is unaffected (still enforced by the field-level `unique: true`). Checked every `unique: true` field in every other model against every explicit `.index()` call in that file — no other duplicates found.
3. **Offer banner countdown appearing to "reset" on unrelated saves** — not a countdown-logic bug (`OfferBanner.jsx`'s timer correctly recomputes live from the stored `endDate` on every render, confirmed by reading it) and not a backend bug (`bannerController.js`'s `banner.endDate = endDate || banner.endDate` already correctly falls back to the stored value when none is sent). The actual root cause: the admin form (`Dashboard.jsx`) populated `bannerEndDate` via `bannerResult.endDate.substring(0, 10)` (date-only, discarding time) into a plain `<input type="date">`, and the update handler *always* re-sends this field on every save — so any admin save (even one only meant to change the banner image) silently snapped the stored time-of-day to midnight. Fixed by switching the input to `type="datetime-local"` and changing both `.substring(0, 10)` call sites to `.substring(0, 16)` (the `YYYY-MM-DDTHH:mm` format `datetime-local` expects), so the full stored timestamp round-trips correctly. No CSS changes needed — the existing input styling is generic (`.admin-input-group input`, not type-specific).

All three re-checked with `node --check` (backend) and a full `esbuild` bundle of the entire frontend (`main.jsx` → resolves every real import) — both clean after each fix.

---

This report reflects a fresh, current-code inspection (not carried over blindly from earlier sessions). Every claim below was either re-verified by reading the current file, re-run as an actual command, or is explicitly marked BLOCKED with the exact reason. Nothing here should be read as "production ready" — see §33/§41 for exactly what remains unverified and why.

**Environment constraint that shapes this whole report:** this working environment has no network egress to package registries (confirmed directly — a real `npm install` reaches `registry.npmjs.org` and gets `HTTP 403, x-deny-reason: host_not_allowed`). That means no `node_modules`, no real `npm run build`, no live MongoDB/Cloudinary/Razorpay/SMTP, and no browser. Every test below that needed one of those is marked BLOCKED, not PASS.

---

## 1. Project overview
AquaGalaxy is an aquarium/fish e-commerce site: product catalog with categories, cart, checkout with Razorpay (card/UPI/netbanking) or manual UPI + screenshot verification, coupons/offers, tiered delivery pricing, GST, order tracking, reviews, wishlist, and a role-based admin dashboard (6 roles) covering products, orders, payments, coupons, delivery rules, analytics, audit logs, and site content (banner/gallery).

## 2. Architecture
Classic two-tier SPA + REST API: React (Vite) SPA calling a separate Express/MongoDB API over HTTP, with Cloudinary as the media CDN and Razorpay as the payment gateway. No SSR, no monorepo tooling (just two sibling folders, `frontend/` and `backend/`) — deployed as two independently hosted services (frontend on Vercel, backend on Render or similar).

## 3. Frontend stack
React 19.2.7, React Router DOM 7.18.1 (Declarative Mode — `<BrowserRouter>`, confirmed in `main.jsx`), Vite 8.1.1, react-icons. No state management library beyond React context (`CartContext`, `ThemeContext`). No CSS framework — hand-written CSS per page/component.

## 4. Backend stack
Node/Express, Mongoose/MongoDB, JWT auth, bcryptjs, Helmet, express-rate-limit, Cloudinary SDK + multer-storage-cloudinary, Razorpay SDK, nodemailer (email abstraction), WhatsApp Cloud API (fetch-based), a courier-abstraction module (mock mode).

## 5. Database
MongoDB via Mongoose. Indexes confirmed present: unique constraints on user email, order number, product slug/SKU, coupon code, pending-Razorpay-order id; a text index for product search; lookup indexes on orders (user/status/paymentStatus/pincode/state/createdAt) and coupon redemptions (unique compound index on coupon+user, which is what makes the per-user coupon limit race-safe — see §19).

## 6. Authentication
JWT-based, `Authorization: Bearer <token>`. `generateToken.js` **refuses to start** without a real `JWT_SECRET` env var (no weak fallback — confirmed by reading the file, it throws rather than defaulting). Tokens carry a `v` (tokenVersion) claim; `authMiddleware.protect`/`optionalAuth` re-fetch the user from MongoDB on every request (already needed for the `isDisabled` check) and compare `tokenVersion`, so a password reset invalidates every previously issued token immediately, with no server-side session store needed. Old tokens minted before this field existed default to version 0, so this shipped without forcing a mass logout.

## 7. RBAC
Six roles: `admin`, `superadmin`, `order_manager`, `product_manager`, `support_manager`, `content_manager`. Permission map lives in `backend/middleware/rbac.js` (`requirePermission`, `hasPermission`) and is mirrored exactly in the frontend (`Dashboard.jsx`'s `can()` helper and sidebar visibility) — re-diffed this session, still identical. Backend is the actual enforcement boundary in every case checked (frontend hiding a tab is UX only).

## 8. Security
See §18 (the status table) for the itemized list. Summary: login rate limiting + account lockout + progressive delay (atomic Mongo aggregation-pipeline update, race-safe under concurrent failed attempts), generic errors that never reveal whether an email exists or why an account is locked, bcrypt hashing, NoSQL-injection sanitizer (recursively strips `$`-prefixed/dotted keys, mutates in place to work around an Express 5 `req.query` getter-only gotcha that breaks popular sanitizer packages), zero `dangerouslySetInnerHTML` anywhere in the frontend (React's default escaping is the real XSS boundary and it's never bypassed), Helmet, a real CORS allow-list (not `*`), IDOR checks on orders/payment screenshots (owner-or-permission checks in the controllers, not just route-level), and no hardcoded secrets anywhere in source (grepped for live-key patterns and PEM blocks — none found).

CSRF: not applicable in the traditional sense — this is a token-in-header (`Authorization: Bearer`) API, not cookie-session auth, so there's no ambient credential for a forged cross-site request to ride on.

## 9. Password security
bcrypt (`genSalt(10)` + `hash`), never logged. `JWT_SECRET` has no fallback (see §6).

## 10. Password reset
Implemented this engagement (previously entirely missing — no route, no page, confirmed by grep before building it). Flow: `POST /api/users/forgot-password` → generic response regardless of whether the account exists; if it does, a 32-byte random token is generated, only its SHA-256 hash is stored (`resetPasswordTokenHash`, `select:false` in the schema), with a 30-minute expiry. `POST /api/users/reset-password` atomically **claims** the token via `findOneAndUpdate` (clears the hash in the same query that matches it — the same atomic-claim pattern already used for pending Razorpay orders elsewhere in this codebase), so a second use of the same token can never succeed even under a race. On success: password rehashed, `failedLoginAttempts`/`lockUntil` reset, and `tokenVersion` incremented (invalidating every existing session — see §6). Both endpoints are rate-limited (5 requests / 15 min) separately from the login limiter. Frontend: `ForgotPassword.jsx` / `ResetPassword.jsx`, linked from `Login.jsx`, reusing the existing (already mobile-tuned) `Auth.css`.

**Tests:** `tests/passwordReset.test.js` — pure-logic assertions (token format, hash determinism, hash≠raw) **actually run and pass** (verified this session: `node tests/passwordReset.test.js` → 3/3 PASS). DB-dependent tests (expiry, single-use-under-concurrency, invalid token) are written but **BLOCKED** — `mongodb-memory-server`/`mongoose` aren't installed and can't be (no network).

## 11. Product management
CRUD with RBAC (`products.manage` permission), search/category/type/price/stock filters, sort, real backend pagination (page/limit/pages/total). `includeInactive=true` (used to view hidden/draft products) now requires `products.manage` — **this session's prior fix, re-confirmed present** in `productController.getProducts` and `productRoutes.js` (`optionalAuth` on the public GET route, so normal shopper traffic is unaffected).

## 12. Multi-image
Backend: `POST /api/upload/multiple` (up to 8 images, MIME+extension validated, size-capped). Model: `images: [String]`. Admin UI (`ProductMediaManager.jsx`): add, remove, **and reorder** via move-left/move-right buttons (`moveImage`) plus "set as main" (`makeMainImage`) — re-checked this session; my own earlier note that reordering didn't exist was wrong and is corrected here. Customer UI (`Product.jsx`): thumbnail row + click-to-swap main image.

## 13. Video
Backend: `POST /api/upload/video` (MIME+extension validated, 25MB cap; a code comment explicitly documents that video *duration* isn't server-verified, rather than silently pretending it is). Model: `video`, `videoThumbnail`. Admin UI: upload/replace/delete. Customer UI: real `<video>` element with `poster` (thumbnail), controls, and a text fallback for unsupported browsers. Both the admin preview and the customer player use `width:100%` + `max-width` (the admin preview's fixed `240px` was a real mobile bug, fixed this engagement — see §32).

## 14. Reviews
Verified-purchase only: `createProductReview` requires a `Delivered` order containing the product for that user (re-read the controller this session to confirm — `Order.findOne({user, status:"Delivered", "orderItems.product":product._id})`), one review per user per product, rating validated 1–5, comment required. Deletion recalculates `numReviews`/`rating` correctly, including the empty-reviews-array case (`? ... : 0`, no division-by-zero).

## 15. Cart
Client-side (`CartContext`), no backend cart persistence — standard for this kind of storefront. `Cart.css` traced for mobile: the base `min-width:320px`/`280px` two-column rule looked risky in isolation but is correctly overridden to `min-width:100%` inside the `max-width:768px` media query, so no actual mobile bug there (confirmed, not assumed).

## 16. Checkout
Server-side price recomputation from DB (product price, coupon, delivery, GST — client-submitted amounts are never trusted, confirmed by reading `orderPricing.js`). UPI-with-screenshot and Razorpay both supported.

## 17. Orders
See §19 for numbering/stock/coupons. Order detail/cancel endpoints check ownership (`getOrderById`, `cancelMyOrder`) or `payments.verify`/`orders.view` permission for staff — re-confirmed this session.

## 18. Stock
Decremented atomically at order confirmation, restored on cancellation (`for item of orderItems: Product.updateOne({_id}, {$inc:{qnt:item.quantity}})`).

## 19. Coupons
Global usage count and a **per-user** limit, the latter enforced via a genuinely race-safe pattern: a unique compound index on `(coupon, user)` in `couponRedemptionModel.js` plus an atomic upsert in `utils/couponRedemption.js` — re-read both files this session; a concurrent double-redemption attempt collides on the unique index and the second request's insert fails cleanly rather than double-counting. (An earlier report called this "blocked/narrower race condition" — that's stale; the current code already handles it correctly.) Release-on-cancellation (`releaseCouponUsage`) confirmed wired into `cancelMyOrder`.

## 20. Delivery pricing
Traced the actual tiered-pricing function (`utils/deliveryCalculator.js`) by hand across quantities 0–8 for both Tamil Nadu and other states this session:

| Qty | Tamil Nadu | Other states |
|---|---|---|
| 0 | *(blocked earlier — empty-cart guard, `!totalQuantity`)* | *(same)* |
| 1–3 | ₹100 | 1–2: ₹100 |
| 4–6 | ₹150 | — |
| 7 | ₹200 (rounds up to one ₹50 step per 2 pairs) | ₹350 (+₹50/pair beyond 2) |
| 8 | ₹200 | ₹400 |

Both match their documented slabs exactly — no pricing bug found, so nothing was changed in the pricing logic itself, per your instruction. **A real bug was found and fixed one level down**, though: `computeTieredCharge` had no guard against an empty `tiers` array. The admin UI prevents removing the last tier client-side, but `deliveryController.js` did zero server-side validation — a rule saved via a direct API call with `tiers:[]` would have thrown an unhandled `TypeError` (`lastTier.uptoQuantity` on `undefined`) on **every checkout** for that state/pincode, since `orderPricing.js` (the real checkout path, not just the `/check` preview endpoint) calls the same function. Fixed by failing closed (`isServiceable:false` with a clear message) in the calculator, plus a matching 400-response validation added to `createDeliveryRule`/`updateDeliveryRule`. Both files re-syntax-checked clean after the change.

Serviceability, pincode-then-state rule precedence, forced-free-delivery and free-delivery-threshold, and the empty-cart guard were all re-traced and are correct.

## 21. GST
`gstAmount = round((amountAfterDiscounts + deliveryCharge) * gstRate / 100)`, rate and enable/disable both admin-configurable via Settings, applied only server-side.

## 22. Razorpay
Order creation validates against DB-sourced price/discount/delivery/GST (client amount is cross-checked, not trusted). Signature verification is HMAC-SHA256 server-side. Duplicate-verification protection via an atomic `findOneAndDelete` claim of the pending-order record (only one of {client verify, webhook} can ever finalize a given payment).

## 23. Razorpay webhook
Real endpoint: `POST /api/payments/razorpay/webhook` (`routes/paymentRoutes.js`). Verified this session by reading the full handler: signature computed over the **raw** request body (`req.rawBody`, captured via an `express.json({verify:...})` callback in `server.js`) using a **separate** `RAZORPAY_WEBHOOK_SECRET` (not the client-verify secret). Idempotent two ways: an upfront `Order.findOne({"paymentDetails.razorpayPaymentId"})` check, then the same atomic pending-order claim used by the client-verify path. Filters to `payment.captured`; other event types get a `200` no-op so Razorpay stops retrying them; genuine failures return non-200 so Razorpay *does* retry.

## 24. Payment screenshot security
Upload (`uploadRoutes.js`) stores screenshots with Cloudinary `type:"private"`. Access (`GET /api/orders/:id/payment-screenshot` → `getPaymentScreenshotUrl`) checks the requester is the order's owner or holds `payments.verify`, then generates a signed, time-limited private URL (`cloudinary.url(..., {type:"private", sign_url:true})`). Re-verified both ends this session — genuinely not publicly reachable by URL guessing.

## 25. WhatsApp
Admin number is DB/Settings-driven, never hardcoded in sending logic (confirmed in `OrderSuccess.jsx`'s comment and fetch-from-settings pattern). Meta credentials optional — no-ops gracefully when unset (logs instead of sending).

## 26. Email
Abstracted through `emailService.js` with a `passwordReset` template added this engagement, matching the existing `orderConfirmed`/lockout template style. No-ops gracefully when SMTP env vars are unset.

## 27. Courier
`utils/courierService.js` runs in a clearly-labeled mock mode (mock tracking IDs) since Professional Courier's real API docs/credentials were never provided — this is intentional, not a gap, per your explicit "do not invent API endpoints" instruction across every session.

## 28. Admin dashboard
Six-role RBAC-gated tabs, matching frontend/backend permission maps (re-diffed this session). Products/orders/coupons/delivery/payments/analytics/audit-logs/users all present.

## 29. Pagination
Fixed this engagement (previously the exact "requests limit=1000, backend caps at 100, silently truncates" bug you asked me to specifically check for — confirmed it existed, confirmed it's now fixed):
- **Products (admin table):** genuine backend-driven pagination (`loadProductPage`), separate from a `fetchAllProducts()` loop (bounded, permission-aware) used only by the stat cards / low-stock alert / `AdminCouponsOffers` product picker, which legitimately need the complete catalog.
- **Orders:** `getOrders` now takes `page`/`limit` (capped 200) and returns `{orders,page,limit,pages,total}` — previously `Order.find(filter).sort(...)` with **no limit at all**. Frontend `fetchAllOrders()` loops bounded pages instead of one unbounded query; the orders table also got a client-side pager it never had (it used to render every search-matched row, unbounded).
- **Shop (public):** unaffected — confirmed no non-admin frontend code ever sends `includeInactive`, so the permission-gating change (§11) is invisible to normal shoppers.

## 30. Performance
No other unbounded queries found in this pass beyond the orders one already fixed. CSV export, revenue calculation, and the pending-verification badge all still read from the full (now-safely-paginated-loop) order list — traced each consumer individually before changing the fetch, specifically to avoid the "incomplete client-side computation over now-incomplete data" failure mode you flagged.

## 31. SEO
`Seo.jsx` component (title/description/canonical) used on Home and Product pages; `frontend/public/robots.txt` present; dynamic `sitemapController.js` builds URLs from `FRONTEND_URL` (falls back to localhost only in dev, clearly commented); product lookup supports slug-or-ObjectId fallback (`isObjectId ? {_id:id} : {slug:id}`).

## 32. Mobile responsiveness
**Code-level verified, NOT device/browser tested — this is stated plainly, not softened.** Three real bugs were found by tracing actual computed widths (not by eyeballing CSS) and fixed with the smallest safe change, across the whole engagement:
1. `OrderSuccess.css` — the only CSS file in the project with zero media queries; its two action buttons could overflow/wrap mid-word at 320–375px. Fixed with `flex-wrap: wrap`.
2. `AdminAnalytics.jsx` custom date-range row — no `flex-wrap` on a row with two native date inputs + a button. Fixed.
3. `ProductMediaManager.jsx` video preview — fixed `240px` width inside a modal whose real content width is ~220px at 320px viewport (traced through backdrop padding + `.panel-card` padding). Fixed with `width:100%; max-width:240px`, matching the customer-facing video's existing correct pattern.

Everything else audited (Navbar/hamburger, global.css, Admin Dashboard shell + sidebar, Cart, Product details, Checkout, Search, Wishlist, Profile, most Admin sub-components) traced out as already correctly handled — several looked risky in isolation (`min-width` rules in Cart.css/Product.css) but resolved correctly once the full cascade (including the `max-width:768px` overrides) was traced through. **No browser or physical device was used at any point in this engagement** — every finding above came from reading CSS/JSX and computing pixel math by hand.

## 33. Vercel readiness
`frontend/vercel.json` (SPA rewrite + sitemap rewrite) and `vite.config.js` are both structurally correct. `config.js`'s `API_URL` is a hardcoded literal (no `VITE_*` env var used anywhere in the frontend — confirmed, there's no `frontend/.env.example` either), which works but means changing the backend URL requires a code edit + redeploy, not a Vercel dashboard setting — documented, not changed, since changing it wasn't asked for and isn't a bug. Concrete setup requirement: **Vercel's Root Directory must be set to `frontend`** — there is no root-level `package.json` in this repo. A real `npm install`/`npm run build` was attempted this session and is genuinely **BLOCKED** (see the environment note at the top of this report) — not claimed as passing.

## 34. AWS readiness
Not assessed — explicitly out of scope until Vercel + live infrastructure testing is complete, per your repeated instruction across this engagement.

## 35. Environment variables
All on the **backend only** (frontend takes none): `PORT`, `MONGO_URI`, `JWT_SECRET` (no placeholder in production), `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS` (comma-separated exact origins — **must include the real Vercel URL** or the deployed frontend can't call the API at all), `RAZORPAY_KEY_ID/KEY_SECRET/WEBHOOK_SECRET`, `WHATSAPP_ACCESS_TOKEN/PHONE_NUMBER_ID`, `EMAIL_HOST/PORT/USER/PASSWORD`, `PROFESSIONAL_COURIER_API_BASE_URL/API_KEY/ACCOUNT_ID`. One dead documentation entry: `BACKEND_URL` is listed in `.env.example` but never actually read anywhere in the backend code (harmless, not removed per "no unnecessary changes").

## 36. Dependency audit
**Backend:** `cloudinary@^1.41.3` — real current advisory, CVE-2025-12613 (arbitrary argument injection via `&` in parameter values, CVSS 8.8), fixed in `2.7.0`. Exploitability here looks low (this codebase's Cloudinary calls use fixed folder/type params, not user-supplied strings), but it's real and current. Fix needs a major version bump; `multer-storage-cloudinary@^4.0.0` looks compatible on paper (it just needs a generic Cloudinary API object, and the code already imports via `.v2`), but per your explicit instruction this was **not forced** — it needs a real-account smoke test of every upload path (product image/video, banner, gallery, payment screenshot) in staging first.
**Frontend:** minimal dependency set (react, react-dom, react-icons, react-router-dom + standard dev tooling), no unused packages found. `react-router-dom@^7.18.1` checked against current CVEs (several exist for react-router, all either fixed by 7.18.0 or scoped to Framework/Data Mode or unstable RSC APIs) — this app uses classic `<BrowserRouter>` (Declarative Mode, confirmed in `main.jsx`) and is already on a version past every fix line. Clean.

## 37. Security audit
See §18 status table — every item re-verified against current code this session, not carried over from memory.

## 38. Tests executed (real commands, run this session)
- `node --check` on every backend `.js` file (post every change) — clean, zero errors, every time.
- `esbuild` (found bundled with a globally-installed `tsx` package) used to actually **bundle the entire frontend from `main.jsx`**, resolving every real local import across every page/component — clean, zero warnings, re-run after every frontend change.
- `node tests/passwordReset.test.js` — pure-logic section (3 assertions) genuinely passes.
- `npm install` (both dry-run and real) in `frontend/` — reached the real npm registry (confirmed via direct `curl -I https://registry.npmjs.org/react` → `403, x-deny-reason: host_not_allowed`), proving network truly is blocked rather than assuming it.
- Manual boundary-value tracing of delivery pricing (§20) and manual pixel-math tracing of mobile CSS (§32) — not "tests" in the executable sense, but genuine derivations, not guesses.

## 39. Tests blocked (exact reason each time)
- `tests/loginSecurity.test.js` and the DB-dependent half of `passwordReset.test.js` — need `mongoose`/`bcryptjs`/`mongodb-memory-server`; none installed, no network to install them.
- Any real `npm run build` — `npm install` itself fails partway (registry blocked).
- Live MongoDB, Razorpay test-mode, Cloudinary, SMTP — no credentials, no network.
- Any real browser/device rendering — no browser available in this environment.
- Live Vercel deployment — not performed.

## 40. Known limitations
- `isDisabled` is checked on every subsequent authenticated request but not at login time itself — a disabled account can still receive one valid token before it starts failing on the next call.
- No drag-and-drop image reordering (only move-left/move-right buttons) — functionally complete, just not drag-and-drop.
- `BACKEND_URL` env var is documented but dead code.
- Video upload has no server-side duration check (documented in-code, not silently pretended to work).

## 41. Remaining production risks
1. `cloudinary@1.41.3` CVE — needs a real-account staging smoke test before upgrading.
2. Zero real browser/device testing has occurred at any point in this engagement.
3. Zero real Razorpay/Cloudinary/SMTP/MongoDB testing has occurred — all verification is code-level.
4. The frontend↔backend domain wiring (`config.js`, `vercel.json`'s sitemap rewrite, backend's `FRONTEND_URL`/`CORS_ALLOWED_ORIGINS`) all currently point at literal strings that must be confirmed as the *actual* live domains once both sides are deployed.

## 42. Required manual tests (in priority order)
1. Real `npm install && npm run build` for both `frontend/` and `backend/` in an environment with network access.
2. Deploy `frontend/` to Vercel (Root Directory = `frontend`); confirm the site loads and API calls succeed once `CORS_ALLOWED_ORIGINS`/`FRONTEND_URL` are set on the backend to the real Vercel URL.
3. Full checkout flow on a real phone (cart → address → Razorpay test-mode payment → order success → WhatsApp prompt).
4. Password reset end-to-end on a real device, including the emailed link actually working against the deployed domain.
5. Admin dashboard on a real phone: hamburger menu, product/order tables + pagination, and specifically the `ProductMediaManager` modal (the exact bug fixed this session).
6. Register a real Razorpay webhook pointed at the deployed backend and confirm a test-mode payment triggers it correctly (both the "client verify arrives first" and "webhook arrives first" orderings, if you can simulate the race).
7. Cloudinary upgrade smoke test (all five upload paths) in a staging environment before touching the CVE.

## 43. Final deployment checklist
**Vercel (frontend):** Root Directory = `frontend`; build = `npm run build`; output = `dist`; no env vars needed.
**Backend host:** set every variable in §35 for real; `CORS_ALLOWED_ORIGINS` and `FRONTEND_URL` must both be updated to the real Vercel URL *after* first deploy (expect one redeploy cycle).
**MongoDB:** a real reachable instance (Atlas or equivalent).
**Cloudinary:** real account credentials; do the CVE upgrade separately with a staging smoke test.
**Razorpay:** test-mode keys first; register the webhook (`https://<backend-domain>/api/payments/razorpay/webhook`, event `payment.captured`) and copy its secret into `RAZORPAY_WEBHOOK_SECRET`.
**Do not deploy to AWS** until the above is live-verified on Vercel + a real backend host.

## 44. Final status table

| Area | Status | Tested | Issue | Action Required |
|---|---|---|---|---|
| Authentication | PASS | Code-level | — | — |
| Login security (rate limit, lockout, delay) | PASS | Code-level | — | — |
| Password hashing | PASS | Code-level | — | — |
| Password reset | PARTIAL | Pure-logic tests pass; DB tests BLOCKED | No `mongoose` installed here | Run `tests/passwordReset.test.js` in an environment with network/mongodb-memory-server |
| JWT (incl. tokenVersion invalidation) | PASS | Code-level | — | — |
| RBAC | PASS | Code-level | — | — |
| IDOR | PASS | Code-level | — | — |
| NoSQL injection | PASS | Code-level | — | — |
| XSS | PASS | Code-level (no `dangerouslySetInnerHTML` anywhere) | — | — |
| CSRF | N/A | — | Token-header auth, not cookie-session — not applicable | — |
| CORS | PASS (code) / ACTION NEEDED (config) | Code-level | Allow-list is correct, but must be populated with the real Vercel URL | Set `CORS_ALLOWED_ORIGINS` after first Vercel deploy |
| Helmet | PASS | Code-level | — | — |
| Rate limiting | PASS | Code-level | — | — |
| Account lockout | PASS | Code-level | — | — |
| Product management | PASS | Code-level | — | — |
| Multi-image (incl. reorder) | PASS | Code-level | — | — |
| Video | PASS | Code-level | Duration not server-verified (documented) | Optional: add duration check if it becomes a real problem |
| Reviews | PASS | Code-level | — | — |
| Cart | PASS | Code-level | — | — |
| Checkout | PASS | Code-level | — | — |
| Orders | PASS | Code-level | — | — |
| Stock | PASS | Code-level | — | — |
| Coupons (incl. concurrency) | PASS | Code-level | — | — |
| Delivery pricing | PASS (logic) / FIXED (crash bug) | Manually traced 0–8 qty both states | Found & fixed: empty-`tiers` crash risk | None — fixed and re-checked this session |
| GST | PASS | Code-level | — | — |
| Razorpay | PASS | Code-level | Never live-tested with real test-mode keys | Run a real Razorpay test-mode payment before go-live |
| Webhook | PASS | Code-level | Never received a real webhook call | Register real webhook, trigger a real test payment |
| Payment screenshots | PASS | Code-level | — | — |
| Cloudinary (upload/delivery) | PASS (functionality) / OPEN (CVE) | Code-level | CVE-2025-12613, needs major-version bump | Real-account staging smoke test, then upgrade |
| WhatsApp | PASS (code) / BLOCKED (send) | Code-level | No real Meta credentials used | Send a real test message once credentials exist |
| Email | PASS (code) / BLOCKED (send) | Code-level | No real SMTP used | Send a real test email once credentials exist |
| Courier | PASS (mock mode, intentional) | Code-level | Real API undocumented | Get official docs before replacing mock mode |
| Admin dashboard | PASS | Code-level | — | — |
| Pagination | PASS | Code-level | — | — |
| Performance | PASS | Code-level | — | — |
| SEO | PASS | Code-level | — | — |
| Mobile responsiveness | PARTIAL | Code-level tracing only, 3 real bugs found+fixed | No browser/device ever used | Real device pass at 320/360/375/390/414/768px |
| Vercel | PARTIAL | Config verified; build BLOCKED | No network to run real build | Run `npm install && npm run build` for real; deploy |
| AWS | NOT STARTED | — | Explicitly out of scope until Vercel is live-verified | — |
| Dependencies | PARTIAL | 1 documented CVE (cloudinary) | Needs real-account test | Staging smoke test before upgrading |
| Database | PASS | Code-level (indexes/uniques confirmed) | Never run against live Mongo here | Run against real Atlas instance |
| Testing (overall) | PARTIAL | Syntax + bundle + pure-logic tests pass | DB/browser/live-infra tests all BLOCKED (no network) | Re-run everything in an environment with network access |
| **Production readiness** | **NOT YET** | — | Code-level verified across the board; zero live infrastructure or device testing has occurred | Complete §42 before any AWS discussion |
