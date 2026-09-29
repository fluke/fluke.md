---
title: "Elixir in front of Rails: a bouncer for our Shopify webhooks"
short: An Elixir bouncer for Rails webhooks
description: Most of our inventory webhooks end in one database check and do nothing. A small Elixir service now decides which ones Rails ever sees.
date: 2026-09-29
tags: [elixir, rails, shopify]
draft: true
---

<p class="todo">DRAFT NOTE: publish once the triager is dropping real inventory traffic in production and there's a week of numbers.</p>

At [Artos Software](https://artossoftware.com) we're Rubyists at heart. [STOQ](https://www.stoqapp.com) is a Rails app, and it'll stay one. But Shopify sends us millions of inventory webhooks a day, and most of them end in a single database check that finds nothing to do. So we put a small Elixir service in front of our Ruby workers whose only job is to decide which webhooks deserve a job at all.

## Why do most of our inventory webhooks do nothing?

We get about 3.9 million `inventory_levels/update` deliveries a day. About 90% of them end in one read-replica check: is anyone waiting for this product? No? Done. No Shopify call, no side effect.

That check is cheap. Everything around it isn't: a queued job, a worker thread, and time holding Ruby's GVL. We'd already found that what looked like database latency in our workers at 25 threads was really threads waiting their turn on the GVL. So the win here is worker capacity, not Shopify API budget. The droppable 90% never touched the API anyway.

## So why Elixir, and not more Ruby?

Because the triager is high-concurrency, low-logic plumbing, which is exactly what the BEAM is good at and where Ruby's GVL is the ceiling. Each message is handled by a cheap BEAM process, so thousands of in-flight messages each waiting on a replica query don't queue behind a global lock.

We looked at Node too. It would beat Ruby for I/O-heavy fan-out, but it has one event loop per process and no preemption, so one CPU-heavy step blocks everything. The BEAM schedules preemptively across cores.

The rule we've settled on: Ruby for the application and everything a merchant touches; Elixir for the technical, load-bearing plumbing. <span class="todo">TODO: your own line here.</span>

## How does the triager decide?

It's a bouncer. A new EventBridge rule sends only the target topics to a separate SQS queue; every other webhook keeps its current path. [Broadway](https://github.com/dashbitco/broadway) reads that queue, and each message gets one decision: `:forward` or `:drop`.

```elixir
def decide(%{topic: "inventory_levels/update"} = delivery, shop) do
  if PendingIntents.exists?(shop.id, delivery.inventory_item_id),
    do: :forward,
    else: :drop
rescue
  _ -> :forward
end

def decide(_delivery, _shop), do: :forward
```

<span class="todo">TODO: swap in the real `Decision.decide/2` once slice 1 lands.</span>

Survivors are forwarded verbatim to the Rails queue as ordinary Shoryuken jobs, so Rails can't tell them from a normal delivery. Everything that needs a Shopify fetch, plus every trigger, notification and write, stays in Rails.

There's one rule it can't break: **fail toward forwarding.** Any error, timeout or doubt forwards. The worst case is forwarding something droppable, which Rails then does nothing with. Losing a webhook is never an option.

## Is it a Phoenix app or a background worker?

A full Phoenix app, even though most of it is a pipeline. That means internal pages and LiveView dashboards for the triage numbers come for free. Getting another developer started is three commands, thanks to [mise](https://mise.jdx.dev):

```toml
[tools]
erlang = "29.1.1"
elixir = "1.20.4-otp-29"

[tasks.setup]
run = "mix setup"

[tasks.server]
run = "mix phx.server"
```

That's `mise install`, `mise run setup`, `mise run server`.

## How are we rolling it out?

In slices, each one earning the next:

1. **Inventory, pass-through:** everything forwards, so we can prove the plumbing.
2. **Inventory, shadow:** record what Elixir *would* drop and compare with what Ruby did, matched by webhook ID. We want at least 99.9% agreement before dropping anything.
3. **Inventory, drop.**
4. **Products,** which needs two checks instead of one.
5. **An in-memory pending-intent set** in ETS, per shop, updated when intents are created or fulfilled, which removes the replica query too.

## Did it work?

<span class="todo">TODO once live: shadow agreement and the mismatches; drop rate in production; Ruby inventory jobs per day before and after; worker time saved and whether we shrank worker capacity; Elixir memory, CPU, messages per second and decision time; replica load before and after the ETS set; any false drops; monthly cost against the Ruby capacity it frees; how long it took a Rubyist to get productive.</span>

And that covers putting an Elixir bouncer in front of Rails. If you're weighing the same move, or want to compare notes, say hi on [X](https://x.com/0xfluke).
