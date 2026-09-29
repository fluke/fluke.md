---
title: "Storefront API in a theme extension: reading live data from the buyer's browser"
short: Storefront API reads in a theme extension
description: Why a Shopify theme app extension should read stock and pre-order state from the Storefront API in the buyer's browser instead of baking it into cached pages.
date: 2026-09-29
tags: [shopify, storefront-api, javascript]
draft: true
---

At [Artos Software](https://artossoftware.com) we build [STOQ](https://www.stoqapp.com), which puts pre-order and back-in-stock buttons on Shopify storefronts through a theme app extension. For years the extension baked our data straight into the page. Shopify caches those pages, sometimes for days, so buyers saw stale stock and pre-order state, and merchants paid for the page weight. So we moved the reads to the Storefront API, called from the buyer's browser.

## Why was the storefront showing stale stock?

Three caches stacked up. Rails cached our embed endpoints, Liquid inlined shop metafields into the page and Shopify edge-cached that HTML, and the browser trusted the inlined value for another 15 minutes.

Most pages are fresh: 92.5% of button renders came from pages under 15 minutes old. But over a week, about 2% of renders came from pages more than an hour old, and a few from pages over two weeks old. You can't purge Shopify's page cache, and a metafield write doesn't bust it. For those buyers the button was simply wrong: a setting that didn't show up, a back-in-stock button hidden on an out-of-stock product, or an add-to-cart decision made from an old snapshot.

## So why read from the buyer's browser?

Because that's where the Storefront API's limits are generous. Storefront traffic from real buyers has no fixed per-app bucket. Calling it from our servers would put every shop's traffic behind our own IPs, which defeats the purpose. One read for 16 products with `variants(first: 250)` cost almost 4,000 points and still succeeded.

What stays on Rails is everything that writes: sign-ups for alerts, notifications, pre-order settings, webhooks.

One correction we made along the way: page weight is an unused-data problem, not an inlining problem. One store inlined 3.6 MB on every page, mostly lists nobody read. A plain Liquid trim fixed most of that before any API call. Storefront reads fix *staleness*, and shops with more than 250 variants.

## How do you call the Storefront API from a theme extension?

With a public token per shop. The server mints one with `storefrontAccessTokenCreate` and publishes it in a shop metafield that Liquid inlines. The metafield's own Storefront access is `NONE`, so Liquid can read it but the API can't list it. The client is just `fetch`:

```js
const STOREFRONT_API_VERSION = '2026-07'

const response = await fetch(`https://${config.shop}/api/${STOREFRONT_API_VERSION}/graphql.json`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Shopify-Storefront-Access-Token': config.storefrontAccessToken,
  },
  body: JSON.stringify({ query, variables }),
})
```

## How do you get the buyer's market right?

Without `@inContext`, a public-token query answers for the shop's primary market; a US visitor to an Indian store got rupees. We take the buyer's country and language from Liquid's `localization` and add the directive:

```js
export const inContextDirective = () => {
  const parts = []
  const country = buyerCountryCode()
  const language = buyerLanguageCode()
  if (country) parts.push(`country: ${country}`)
  if (language) parts.push(`language: ${language}`)
  return parts.length ? ` @inContext(${parts.join(', ')})` : ''
}
```

The language has to be a valid enum. Only a handful keep a region (`PT_BR`, `ZH_TW`…); `EN_GB` is a GraphQL error that quietly killed the read for British buyers. We also check the country Shopify echoes back in `extensions.context` and discard the answer if it doesn't match.

## How do you keep add-to-cart fast?

Two things. On collection pages, card components ask for products one at a time, so a 20 ms window gathers the calls and sends them as aliased `product(handle:)` queries, 25 per request.

At add-to-cart we read live stock, with a hard deadline:

```js
export const LIVE_INVENTORY_READ_TIMEOUT_MS = 1000
export const LIVE_INVENTORY_FAILURE_LIMIT = 2 // consecutive failures open the breaker for the page

return Promise.race([read, timeout])
```

A late answer is thrown away and the decision falls back to the cached data. It fails open. The live read first added about 700 ms to an add-to-cart, so we reuse fresh readings, join reads already in flight, and prefetch on hover and focus.

## What bit us?

Most failures were silent: a `null` instead of an error.

**Metafields read as `null` without public access.** Every metafield definition needs Storefront access `PUBLIC_READ`, or the read returns `null` with no error. Our setup job was all-or-nothing and failed thousands of times, so we replaced it with a per-key audit and repair.

**"In stock" isn't `availableForSale`.** A variant set to keep selling when it's out of stock is still `availableForSale: true`. We treat in stock as quantity above zero, and `quantityAvailable` is `null` when tracking is off.

**Rollback isn't instant.** Flags inlined into the page only reach *future* renders, and Shopify caches pages. Build a client-side kill switch before you need it.

## Did it work?

On one collection page, 38 separate product fetches (almost 10 seconds cumulative, enough to freeze the tab on a fast scroll) became two batched calls with about 14× less data. <span class="todo">TODO: product-page load before/after and support-ticket numbers, once measured.</span>

And that covers moving a theme extension's reads to the Storefront API. If you're doing something similar, or want to compare notes, say hi on [X](https://x.com/0xfluke).
