---
title: "Shopify Events: only hearing about the updates you care about"
short: Filtering Shopify Events to what you need
description: How we went from about 4.5 million orders/updated webhooks a day to under 300,000, by marking the orders we care about and letting a filtered Shopify Events subscription do the rest.
date: 2026-09-29
tags: [shopify, events, rails]
featured: true
---

At [Artos Software](https://artossoftware.com) we build [STOQ](https://www.stoqapp.com), a Shopify app for pre-orders and back-in-stock alerts. To keep pre-orders and alert-driven orders in sync, we listened to the `orders/updated` webhook. The trouble is that Shopify sends that webhook for every change to every order on a shop, and we only care about a sliver of them. So we moved to Shopify's Events subscriptions, which run a GraphQL query for each change and can filter deliveries based on the response, and let Shopify throw away the rest before it ever reaches us.

## Why were we getting 4 million webhooks a day?

A webhook subscription can't filter by order. Every edit, tag, fulfilment and refund on every order became a delivery, a queued job, and a database lookup that usually found nothing and returned. Roughly 350 of our largest shops sent over 60% of that traffic. A busy merchant working through orders all day generated millions of jobs that ended in "not ours".

What we actually need are the orders our app created or touched, mostly pre-orders. Those are already rows in our database.

## So how do you tell Shopify which updates you care about?

You mark them, so the marker shows up in the response you filter on. When a buyer adds one of our pre-orders to their cart, we set an attribute on the cart with the Storefront API:

```graphql
mutation markCart($cartId: ID!) {
  cartAttributesUpdate(
    cartId: $cartId
    attributes: [{ key: "_tracked_by_stoq", value: "true" }]
  ) {
    cart { id }
    userErrors { field message }
  }
}
```

Shopify copies cart attributes onto the order it creates, as the order's custom attributes, so every order that came through our flow arrives already marked.

## How do you subscribe to just those updates?

With an `[[events.subscription]]` block in `shopify.app.toml`. Shopify runs the GraphQL query for each order change, applies the `query_filter` to the response, and only delivers when it matches:

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
    customAttributes { key value }
  }
}
"""
query_filter = "order.customAttributes.key:'_tracked_by_stoq'"
```

Shopify evaluates the filter on its side, so an unmarked order never leaves Shopify. Deliveries come through Amazon EventBridge into SQS, and a small translator turns each one back into the shape `orders/updated` had, so the existing worker barely changed.

Two rules we learned the hard way:

- The filter only sees the response, so whatever you filter on has to be **selected** in the query.
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
  return false unless CUTOVER_TOPICS.include?(topic)

  # only skip the webhook once Events is already doing the work
  processing_events_for?(shop, topic)
rescue StandardError
  false # a duplicate is a no-op; a dropped update is unrecoverable
end
```

Leave a gap between steps 2 and 3. Requests already in flight need time to catch up, and if you flip both at once, an update can slip between the webhook you just stopped and the Events delivery that isn't being processed yet.

## What bit us?

The dangerous ones failed silently and looked like success until we compared counts.

**A search filter Shopify can't apply matches everything.** Our hourly reconciler finds marked orders through Admin API order search. When a shop wasn't set up for that filter, Shopify ignored the term and returned every order, with no error. The canary we use now: search for a value that can't exist, and expect 0.

**A query error drops the delivery.** If the query touches a field the shop's token can't read, Shopify sends a `query_errors` payload instead. In shadow we found we were dropping about 80% of order deliveries this way. Now we tolerate partial payloads, and shops missing the scope stay on webhooks.

## Did it work?

Order-update jobs fell from about 4.5 million a day to under 300,000, a drop of over 90%, and what's left is mostly orders we actually care about. The volume now scales with our pre-orders, not the merchant's whole order backlog. An hourly reconciler, searching for the same marker, catches the few changes Events has no trigger for yet.

And that covers moving `orders/updated` to Events. Inventory and product updates are next, with the same pattern. If you're doing something similar, or want to compare notes, say hi on [X](https://x.com/0xfluke).
