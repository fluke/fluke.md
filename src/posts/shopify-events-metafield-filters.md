---
title: "Shopify Events and metafields: only hearing about the updates you care about"
short: Filtering Shopify Events with metafields
description: How we went from about 4.5 million orders/updated webhooks a day to under 300,000, by marking the orders we care about with a metafield and letting a filtered Shopify Events subscription do the rest.
date: 2026-09-29
tags: [shopify, events, rails]
featured: true
---

At [Artos Software](https://artossoftware.com) we build [STOQ](https://www.stoqapp.com), a Shopify app for pre-orders and back-in-stock alerts. To keep pre-orders and alert-driven orders in sync, we listened to the `orders/updated` webhook. The trouble is that Shopify sends that webhook for every change to every order on a shop, and we only care about a sliver of them. So we moved to Shopify's Events subscriptions, which can filter on a metafield, and let Shopify throw away the rest before it ever reaches us.

## Why were we getting 4 million webhooks a day?

A webhook subscription can't filter by order. Every edit, tag, fulfilment and refund on every order became a delivery, a queued job, and a database lookup that usually found nothing and returned. Roughly 350 of our largest shops sent over 60% of that traffic. A busy merchant working through orders all day generated millions of jobs that ended in "not ours".

What we actually need are the orders our app created or touched, mostly pre-orders. Those are already rows in our database.

## So how do you tell Shopify which updates you care about?

You label them. We write an order metafield, `tracked`, when we start caring about an order. First it needs a definition, and it has to be `adminFilterable`, or order search can't use it:

```ruby
{
  key: "tracked",
  name: "Tracked",
  type: "single_line_text_field",
  owner_type: "ORDER",
  admin_filterable: true,
}
```

Then a callback stamps the marker once and records that the write succeeded:

```ruby
TRACKED_METAFIELD_VALUE = '1'

after_commit :set_order_tracked_metafield, on: :create

def set_order_tracked_metafield
  return true if tracked_at.present?

  stamped = ShopifyEvents::StampOrderTracked
    .call(shop: shop, shopify_order_id: shopify_order_id).status == :stamped
  update_column(:tracked_at, Time.current) if stamped
  stamped
end
```

The value is always `"1"` because the Events filter is an exact string match, so the meaning lives in the key name. `tracked_at` is only set on a confirmed write, which makes `tracked_at IS NULL` exactly the set a scheduled sweep needs to retry.

## How do you subscribe to just those updates?

With an `[[events.subscription]]` block in `shopify.app.toml`. It runs a GraphQL query for each order change and delivers only when the `query_filter` matches:

```toml
[[events.subscription]]
handle = "order-tracked"
topic = "Order"
actions = [ "update" ]
triggers = [ "order.*" ]
uri = "<your EventBridge partner source ARN>"
query = """
query order_tracked($orderId: ID!) {
  order(id: $orderId) {
    id
    displayFinancialStatus
    displayFulfillmentStatus
    lineItems(first: 50) { nodes { id quantity } }
    metafield(namespace: "stoq", key: "tracked") { value }
  }
  shop {
    metafield(namespace: "stoq", key: "events_enabled") { value }
  }
}
"""
query_filter = "shop.metafield.value:'1' AND order.metafield.value:'1'"
```

The shop metafield is a second switch, so we could roll out one shop at a time. Shopify evaluates the filter on its side, so an untracked order never leaves Shopify. Deliveries come through Amazon EventBridge into SQS, and a small translator turns each one back into the shape `orders/updated` had, so the existing worker barely changed.

Two rules we learned the hard way:

- A filter can only reference fields the query **selects**, which is why both metafields are in the query.
- Subscription queries are capped at 100 complexity points, and nested connection sizes add up fast.

## How do you move 30,000 shops over without dropping an update?

In three switches per shop, always in this order:

1. **Shadow:** Events deliveries are recorded and compared with the webhook.
2. **Process:** Events deliveries are processed for real, alongside the webhook. Duplicates are harmless because the worker is idempotent.
3. **Cut over:** the router skips that shop's webhook, and later we delete the webhook subscription altogether.

The router check leans towards processing whenever it's unsure:

```ruby
def skip_webhook_for_events_cutover?(topic:, shop:)
  return false if events_disabled?
  return false unless shop&.events_enabled?
  return false unless Toggle.enabled_cached?(shop, CUTOVER_TOGGLES[topic])

  events_processing_enabled?(shop: shop)
rescue StandardError
  false # a duplicate is a no-op; a dropped update is unrecoverable
end
```

Steps 2 and 3 run at least five minutes apart, because our feature flags are cached for five minutes. Flip both at once and one worker can skip the webhook while another still ignores the Events delivery.

## How do you stamp the orders you already have?

The callback only covers new orders, so every shop's existing active orders needed the marker before it could switch. We backfill with a bulk operation instead of one `metafieldsSet` call per batch: each batch of inputs becomes a line in a JSONL file, and the whole file runs as a single mutation.

```graphql
mutation {
  bulkOperationRunMutation(
    mutation: "mutation call($metafields: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $metafields) { userErrors { message } } }"
    stagedUploadPath: "<path of the uploaded JSONL>"
  ) {
    bulkOperation { id status }
    userErrors { message }
  }
}
```

Bulk operations aren't rate-limited like ordinary Admin API calls, so stamping a shop doesn't burn its API budget at the exact moment you enrol it. We drained about 183,000 active orders across 366 shops in a day, and only confirmed a write from a success line in the results file.

## What bit us?

The dangerous ones failed silently and looked like success until we compared counts.

**A metafield filter without a definition matches everything.** In Admin API order search, `metafields.<namespace>.tracked:1` only filters if the shop has an `adminFilterable` definition. Without one, Shopify ignores the term and returns every order, with no error. Ours was missing across the fleet because the same run also asked for `adminFilterable` on a variant definition, which Shopify doesn't support, and that raised before it reached orders. The canary we use now: searching for `tracked:"__canary__"` must return 0.

**A query error drops the delivery.** If the query touches a field the shop's token can't read, Shopify sends a `query_errors` payload instead. In shadow we found we were dropping about 80% of order deliveries this way. Now we tolerate partial payloads, and shops missing the scope went last.

## Did it work?

Order-update jobs fell from about 4.5 million a day to under 300,000, a drop of over 90%, and what's left is mostly orders we actually care about. The volume now scales with our pre-orders, not the merchant's whole order backlog. An hourly reconciler, using the same `tracked` filter in order search, catches the few changes Events has no trigger for yet.

And that covers moving `orders/updated` to Events. Inventory and product updates are next, with the same pattern. If you're doing something similar, or want to compare notes, say hi on [X](https://x.com/0xfluke).
