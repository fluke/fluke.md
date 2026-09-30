---
title: "Shopify Events: only hearing about the updates you care about"
short: Filtering Shopify Events to what you need
description: How we went from about 6 million orders/updated webhooks a day on average to under 500,000, by marking the orders we care about and letting a filtered Shopify Events subscription do the rest.
date: 2026-09-29
tags: [shopify, events, rails]
featured: true
---

At [Artos Software](https://artossoftware.com) we build [STOQ](https://www.stoqapp.com), a Shopify app for pre-orders and back-in-stock alerts. To keep pre-orders and alert-driven orders in sync, we listened to the `orders/updated` webhook. The trouble is that Shopify sends that webhook for every change to every order on a shop, and we only care about a sliver of them. So we moved to Shopify's Events subscriptions,[^events] which run a GraphQL query for each change and can filter deliveries based on the response, and let Shopify throw away the rest before it ever reaches us.

## Why were we getting 6 million webhooks a day?

A webhook subscription can't filter by order. Every edit, tag, fulfilment and refund on every order became a delivery, a queued job, and a database lookup that usually found nothing and returned. Roughly 350 of our largest shops sent over 60% of that traffic. A busy merchant working through orders all day generated millions of jobs that just got ignored. And that's just the average. Plenty of merchants use bulk-editing apps to tag or update thousands of orders at once, and every one of those edits is another webhook, so a single run can send the count spiking well past it.

What we actually need are the orders our app created or touched, mostly pre-orders. Those are already rows in our database.

## So how do you tell Shopify which updates you care about?

You mark them, so the marker shows up in the response you filter on. When a buyer adds one of our pre-orders to their cart, we set an attribute on the cart with the Storefront API:[^cart]

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

Shopify copies cart attributes onto the order it creates, as the order's custom attributes,[^attrs] so every order that came through our flow arrives already marked.

## How do you subscribe to just those updates?

With an `[[events.subscription]]` block in `shopify.app.toml`. Shopify runs the GraphQL query for each order change,[^structure] applies the `query_filter` to the response,[^filter] and only delivers when it matches:

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

<figure class="flow"><svg viewBox="0 0 700 270" role="img" aria-label="Before: every order change becomes a webhook, a queued job and a worker run that usually ignores it. After: Shopify runs the query and the filter for each order change, and only marked orders reach the worker; unmarked orders never leave Shopify."><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="ahead"/></marker></defs><text class="flow-l" x="25" y="26">BEFORE</text><rect class="node" x="25" y="40" width="110" height="40" rx="4"/><text class="flow-t" x="80.0" y="65" text-anchor="middle">order change</text><line class="arrow" x1="135" y1="60" x2="158" y2="60" marker-end="url(#ah)"/><rect class="node" x="160" y="40" width="110" height="40" rx="4"/><text class="flow-t" x="215.0" y="65" text-anchor="middle">webhook</text><line class="arrow" x1="270" y1="60" x2="293" y2="60" marker-end="url(#ah)"/><rect class="node" x="295" y="40" width="110" height="40" rx="4"/><text class="flow-t" x="350.0" y="65" text-anchor="middle">queue</text><line class="arrow" x1="405" y1="60" x2="428" y2="60" marker-end="url(#ah)"/><rect class="node" x="430" y="40" width="110" height="40" rx="4"/><text class="flow-t" x="485.0" y="65" text-anchor="middle">worker</text><line class="arrow" x1="540" y1="60" x2="563" y2="60" marker-end="url(#ah)"/><rect class="node dim" x="565" y="40" width="110" height="40" rx="4"/><text class="flow-t dim" x="620.0" y="65" text-anchor="middle">ignored</text><text class="flow-l" x="25" y="136">AFTER</text><rect class="group" x="188" y="146" width="297" height="72" rx="6"/><text class="flow-g" x="200" y="140">at Shopify</text><rect class="node" x="25" y="162" width="110" height="40" rx="4"/><text class="flow-t" x="80.0" y="187" text-anchor="middle">order change</text><line class="arrow" x1="135" y1="182" x2="203" y2="182" marker-end="url(#ah)"/><rect class="node" x="205" y="162" width="110" height="40" rx="4"/><text class="flow-t" x="260.0" y="187" text-anchor="middle">query</text><line class="arrow" x1="315" y1="182" x2="358" y2="182" marker-end="url(#ah)"/><rect class="node" x="360" y="162" width="110" height="40" rx="4"/><text class="flow-t" x="415.0" y="187" text-anchor="middle">filter</text><line class="arrow" x1="470" y1="182" x2="563" y2="182" marker-end="url(#ah)"/><rect class="node" x="565" y="162" width="110" height="40" rx="4"/><text class="flow-t" x="620.0" y="187" text-anchor="middle">worker</text><text class="flow-g" x="517" y="172" text-anchor="middle">marked</text><line class="arrow dim" x1="415" y1="202" x2="415" y2="238" marker-end="url(#ah)"/><text class="flow-t dim" x="415" y="258" text-anchor="middle">unmarked: never leaves Shopify</text></svg><figcaption>Before, every order change reached our workers. After, Shopify runs the query and the filter, and only marked orders get through.</figcaption></figure>

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

Order-update jobs fell from about 6 million a day on average to under 500,000, a drop of over 90%, and what's left is mostly orders we actually care about. The volume now scales with our pre-orders, not the merchant's whole order backlog. An hourly reconciler, searching for the same marker, catches the few changes Events has no trigger for yet.

<figure class="chart"><svg viewBox="0 0 700 322" role="img" aria-label="orders/updated per day, 16 to 30 September. Webhooks run 6.5 to 7.2 million on weekdays and dip at weekends, then fall from 6.48 million on 25 September to about 250 thousand by 29 and 30 September. Events processed rises from nearly zero to about 200 thousand."><rect class="wkend" x="174.8" y="50" width="44.3" height="240"/><rect class="wkend" x="219.0" y="50" width="44.3" height="240"/><rect class="wkend" x="484.8" y="50" width="44.3" height="240"/><rect class="wkend" x="529.0" y="50" width="44.3" height="240"/><line class="grid" x1="64" y1="290" x2="684" y2="290"/><text class="axis" x="54" y="294" text-anchor="end">0M</text><line class="grid" x1="64" y1="230" x2="684" y2="230"/><text class="axis" x="54" y="234" text-anchor="end">2M</text><line class="grid" x1="64" y1="170" x2="684" y2="170"/><text class="axis" x="54" y="174" text-anchor="end">4M</text><line class="grid" x1="64" y1="110" x2="684" y2="110"/><text class="axis" x="54" y="114" text-anchor="end">6M</text><line class="grid" x1="64" y1="50" x2="684" y2="50"/><text class="axis" x="54" y="54" text-anchor="end">8M</text><line class="mark" x1="196.9" y1="50" x2="196.9" y2="290"/><circle class="mark-dot" cx="196.9" cy="42" r="9"/><text class="mark-n" x="196.9" y="46" text-anchor="middle">1</text><line class="mark" x1="506.9" y1="50" x2="506.9" y2="290"/><circle class="mark-dot" cx="506.9" cy="42" r="9"/><text class="mark-n" x="506.9" y="46" text-anchor="middle">2</text><line class="mark" x1="595.4" y1="50" x2="595.4" y2="290"/><circle class="mark-dot" cx="595.4" cy="42" r="9"/><text class="mark-n" x="595.4" y="46" text-anchor="middle">3</text><polygon class="area" points="64.0,74.3 108.3,80.9 152.6,86.9 196.9,114.5 241.1,177.5 285.4,96.8 329.7,89.6 374.0,87.8 418.3,90.2 462.6,95.6 506.9,186.2 551.1,255.8 595.4,269.7 639.7,282.4 684.0,282.4 684.0,290 64.0,290"/><polyline class="line web" points="64.0,74.3 108.3,80.9 152.6,86.9 196.9,114.5 241.1,177.5 285.4,96.8 329.7,89.6 374.0,87.8 418.3,90.2 462.6,95.6 506.9,186.2 551.1,255.8 595.4,269.7 639.7,282.4 684.0,282.4"/><polyline class="line evp" points="64.0,290.0 108.3,290.0 152.6,290.0 196.9,290.0 241.1,290.0 285.4,289.8 329.7,289.8 374.0,289.7 418.3,289.7 462.6,289.4 506.9,288.9 551.1,287.7 595.4,284.8 639.7,283.8 684.0,283.8"/><text class="axis" x="64.0" y="312" text-anchor="middle">16</text><text class="axis" x="108.3" y="312" text-anchor="middle">17</text><text class="axis" x="152.6" y="312" text-anchor="middle">18</text><text class="axis" x="196.9" y="312" text-anchor="middle">19</text><text class="axis" x="241.1" y="312" text-anchor="middle">20</text><text class="axis" x="285.4" y="312" text-anchor="middle">21</text><text class="axis" x="329.7" y="312" text-anchor="middle">22</text><text class="axis" x="374.0" y="312" text-anchor="middle">23</text><text class="axis" x="418.3" y="312" text-anchor="middle">24</text><text class="axis" x="462.6" y="312" text-anchor="middle">25</text><text class="axis" x="506.9" y="312" text-anchor="middle">26</text><text class="axis" x="551.1" y="312" text-anchor="middle">27</text><text class="axis" x="595.4" y="312" text-anchor="middle">28</text><text class="axis" x="639.7" y="312" text-anchor="middle">29</text><text class="axis" x="684.0" y="312" text-anchor="middle">30</text><line class="line web" x1="64" y1="14" x2="86" y2="14"/><text class="axis" x="94" y="18">webhooks</text><line class="line evp" x1="214" y1="14" x2="236" y2="14"/><text class="axis" x="244" y="18">Events processed</text></svg><figcaption><code>orders/updated</code> per day, 16–30 September. Shaded columns are weekends. ① first shops cut over · ② the rest of the fleet · ③ old webhook subscriptions deleted.</figcaption></figure>

And that covers moving `orders/updated` to Events. Inventory and product updates are next, with the same pattern. If you're doing something similar, or want to compare notes, say hi on [X](https://x.com/0xfluke).

[^events]: [About Events and webhooks](https://shopify.dev/docs/apps/build/events-webhooks), and the [Events API reference](https://shopify.dev/docs/api/events/latest).
[^cart]: [`cartAttributesUpdate`](https://shopify.dev/docs/api/storefront/latest/mutations/cartAttributesUpdate) in the Storefront API.
[^attrs]: [`Order.customAttributes`](https://shopify.dev/docs/api/admin-graphql/latest/objects/Order) in the Admin API.
[^structure]: [Events delivery structure](https://shopify.dev/docs/apps/build/events/delivery-structure): how the changed IDs become your query's variables.
[^filter]: [Filter Events deliveries](https://shopify.dev/docs/apps/build/events/delivery-filtering): `query_filter` syntax and limits.
