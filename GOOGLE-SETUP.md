# Google setup for ilmkhona0.com.co

Three different Google products. They are easy to confuse, so:

| Product | What it does | Money |
|---|---|---|
| **AdSense** | Shows ads on **your** site | Google **pays you** |
| **Google Ads** | Shows **your** ad on other sites | **You pay** Google |
| **Analytics 4** | Shows who visits your site | Free |

The code for all three is already in the project. Nothing loads until you fill in
the matching environment variable, so the site stays clean while you wait.

| Env var | Looks like | Where to get it |
|---|---|---|
| `NEXT_PUBLIC_ADSENSE_CLIENT` | `ca-pub-1234567890123456` | adsense.google.com → Account → Account information |
| `NEXT_PUBLIC_GA_ID` | `G-XXXXXXXXXX` | analytics.google.com → Admin → Data streams |
| `NEXT_PUBLIC_GOOGLE_ADS_ID` | `AW-1234567890` | ads.google.com → Tools → Data manager → Google tag |

> **Important:** `NEXT_PUBLIC_*` values are baked in when you build. After editing
> them on the server you must run `npm run build` and restart — a restart alone
> does nothing.

---

## 1. Google Analytics 4 (do this first — it's instant)

1. Go to https://analytics.google.com and sign in with ilmkhona@gmail.com.
2. Admin (bottom left gear) → **Create** → **Property**. Name it `ilmkhona0`.
3. Pick your time zone and currency → Next → Create.
4. Choose platform **Web**. Website URL: `https://ilmkhona0.com.co`, stream name `ilmkhona0 web`.
5. Copy the **Measurement ID** (`G-…`).
6. On the server, put it in `.env.production`:
   `NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX`
7. Rebuild and restart. Open your site, then in Analytics go to
   **Reports → Realtime** — you should see yourself within a minute.

## 2. Google Ads tag

You already created a campaign in the Google Ads console. To know whether the
money is working, the site needs the tag.

1. https://ads.google.com → **Tools** → **Data manager** (older accounts: Tools → Conversions).
2. Find your **Google tag**. Copy the ID that starts with `AW-`.
3. Server `.env.production`: `NEXT_PUBLIC_GOOGLE_ADS_ID=AW-1234567890`
4. Rebuild, restart.
5. Back in Google Ads, use **"Check your tag"** / Tag diagnostics — it should
   go green within an hour.

Later, to count a real action (e.g. someone signs up), create a conversion
action in Google Ads and call it from the relevant button:

```js
window.gtag?.("event", "conversion", {
  send_to: "AW-1234567890/AbCdEfGhIjK",
});
```

## 3. AdSense — the one that pays you

### Sign up

1. Go to https://adsense.google.com → **Get started**, sign in with ilmkhona@gmail.com.
2. Enter your site: `ilmkhona0.com.co` (no `https://`, no `www`).
3. Country, accept terms, then fill in **Payments → your name and address**.
   The name must match your bank/ID, or payouts get stuck later.
4. AdSense gives you a **Publisher ID** (`ca-pub-…`) right away, even before approval.
5. Put it on the server: `NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-1234567890123456`
   → rebuild → restart.
   This automatically does two things AdSense checks for:
   - loads the AdSense script on every page,
   - serves `https://ilmkhona0.com.co/ads.txt` with the right line.
6. In AdSense click **Request review**.

### While you wait (usually a few days, sometimes 2–4 weeks)

Reviewers reject sites that look empty or unfinished. Before requesting review,
make sure:

- [ ] The site loads on the real domain over HTTPS (not localhost, not an IP).
- [ ] Privacy policy is reachable — `/privacy` exists and is linked from the home page. ✅ done
- [ ] Cookie consent banner works. ✅ done
- [ ] There is **real content** — a reviewer should find pages worth reading.
      A mostly-empty file hub is the most common rejection reason. Add a few
      pages of your own writing (about the project, guides, notes on what you
      are learning) before requesting review.
- [ ] No copyrighted movies/music/software uploaded for download. This is an
      instant, hard rejection — worth checking what is in your uploads.
- [ ] Contact info visible.
- [ ] `/ads.txt` returns the `google.com, pub-…` line in a browser.

### Ad units — DONE (2026-08-17)

Two responsive Display ad units were created in AdSense and wired into
`app/page.tsx`. No placeholders remain:

| Ad unit name    | Slot id      | Where it renders   |
| --------------- | ------------ | ------------------ |
| Home top banner | `5588020515` | top of home page   |
| Home in-feed    | `3890282698` | above Contact      |

Both use `data-ad-format="auto"` + full-width-responsive, which is what
`AdSlot.tsx` emits.

Nothing more to do in code. The boxes stay blank until Google finishes
reviewing the site — Sites → approval status is currently **"Getting ready"**.
Once it flips to **Ready**, ads start appearing within a few hours.

Add more ads anywhere with:

```tsx
import AdSlot from "./components/AdSlot";
<AdSlot slot="9876543210" />
```

Never click your own ads — that gets accounts banned permanently.

---

## Files involved

| File | Purpose |
|---|---|
| `app/components/GoogleTags.tsx` | Loads gtag.js for GA4 + Google Ads, sets Consent Mode defaults |
| `app/components/AdSlot.tsx` | Reusable AdSense ad unit |
| `app/components/CookieBanner.tsx` | Sends the visitor's consent choice to Google |
| `app/ads.txt/route.ts` | Serves `/ads.txt` from your publisher ID |
| `app/layout.tsx` | Mounts the tags site-wide |
| `app/privacy/page.tsx` | Privacy policy required by AdSense |
