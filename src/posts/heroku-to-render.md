---
title: "Heroku to Render: moving a Rails app one service at a time"
short: Heroku to Render, one service at a time
description: How we moved a busy Rails app off Heroku in two steps, database to PlanetScale and then the app to Render, without a big-bang cutover, and what running one app on two platforms taught us.
date: 2026-09-29
tags: [rails, render, heroku]
draft: true
---

At [Artos Software](https://artossoftware.com) we run [STOQ](https://www.stoqapp.com), a Rails app that serves Shopify storefronts, a merchant dashboard and a lot of background jobs. It had lived on Heroku for years. This year we moved off it in two steps: first the database, then the app.

## Why leave Heroku?

It started with the database. Most of our reliability problems on Heroku came from Heroku Postgres, so the first move was our database to [PlanetScale](https://planetscale.com) Postgres. Only after that did we start moving the app.

Then there was the platform itself. Heroku has felt like it's in maintenance mode for a while, and we didn't want to bet the next few years on something that looks like it's winding down. So this wasn't fire-fighting, and it wasn't for a number on an invoice. Once we looked closely, though, Render was better for a Rails app in a few concrete ways:

- **Memory headroom.** Each Puma worker sits at roughly 400–500 MB. A 1 GB Heroku dyno could barely fit two, and we'd turned YJIT off there after out-of-memory crashes. On Render we can run bigger instances: a 4 GB one runs eight workers, and YJIT is back on.
- **A private path to the database.** Render reaches PlanetScale over AWS PrivateLink, which also costs about half as much per terabyte as public egress.
- **We control malloc.** Render's native Ruby runtime doesn't ship jemalloc, so we moved to a Docker image where we set it ourselves.
- **Fewer add-ons.** An over-provisioned Redis, a cron add-on and an autoscaler all go away.

## Doesn't splitting the app and database across clouds add latency?

That's the obvious worry: every query now crosses from one provider to another. Two things took care of it. We moved the app into the same AWS region as the database, and Render connects to PlanetScale over AWS PrivateLink, so queries travel a private network path instead of the public internet. We haven't missed the old setup. Requests on Render wait 1–2 ms in the queue, against 60–140 ms on the Heroku web dynos that are left.

<span class="todo">TODO (optional): a before/after database latency number, and when the PlanetScale cutover happened.</span>

## So how do you move a Rails app without a big-bang cutover?

With the database already on PlanetScale, we moved the app service by service, starting with the one nobody outside the team uses.

1. **Admin first,** as the proof of concept.
2. **Network and region:** move to the same region as the database, then switch to PrivateLink.
3. **Staging,** completely: web, worker, crons and Redis.
4. **Shared state:** one Redis both platforms can reach.
5. **The merchant dashboard.**
6. **Storefront traffic,** shop by shop in waves, until every shop was on Render.

The production workers, crons and database migrations stay on Heroku for now. We tried workers on both platforms in staging and they happily consumed the same SQS queues. For production we want one consumer per queue and a clean switch, not two platforms racing.

## How do you keep Render from serving code before its migration?

Heroku's release phase still runs `db:migrate`, so Render must never serve a commit before Heroku has migrated it. We turned off Render's auto-deploy and added a cron that runs every minute and deploys Render pinned to Heroku's newest *succeeded* release:

```ruby
# Heroku is the migration authority (its release phase runs `rails db:migrate`),
# so a commit is only safe to serve once the Heroku release carrying it has
# SUCCEEDED.
def sync
  release = latest_release
  return finish(:no_release) if release.blank?
  return finish(:unchanged) if release['id'] == $redis.get(MARKER_KEY)

  case release['status']
  when 'succeeded' then deploy(release)
  # ...
  end
end
```

It never raises, so one bad tick can't crash the cron, and it only retries services that didn't accept the deploy, because a repeated deploy request cancels one already running.

## What does the Render side look like?

One `render.yaml` Blueprint declares every service. Shared settings like `WEB_CONCURRENCY` live in an environment group, so we can tune them without a commit. Services find each other by name instead of by pasted URLs:

```yaml
- key: REDIS_LOCAL_URL
  fromService:
    type: keyvalue
    name: stoq-local-redis
    property: connectionString
```

Know this before you start: a Blueprint sync reapplies the whole file. Anything you changed in the dashboard and didn't put in the yaml gets reverted. Treat `render.yaml` as the only source of truth.

## What bit us?

Nearly every problem came from running one app on two platforms at once: two Redises, two caches, two deploy pipelines and one database.

**Split-brain Redis.** Render read its own Redis while Heroku wrote to another. It first showed up as an admin page listing every shop as inactive, but the same split applied to locks and flags, and a lock only excludes processes that share a store. We moved per-node counters to a local Redis and put both platforms on one shared Redis for everything that coordinates.

**A Redis client that never connected.** `Redis.new` doesn't connect until the first command. Our webhook rate limiter checked `connected?` before issuing anything, so it always bailed out and the rate limit was silently off. The rule since: issue the command and rescue the error; never pre-check.

**Code ahead of its migration.** Before the deploy watcher, Render auto-deployed a view that read a new column before Heroku had migrated. Our first fix, a pre-deploy command, failed every deploy for twenty minutes. Reverting the commit didn't remove it either: service properties like that only change on a Blueprint sync.

**Two caches, one setting.** Heroku's `Rails.cache` is Memcached and Render's is Redis. Clearing a cached setting only clears it on the platform that saved it. That one goes away when the workers move.

**Full traffic finds what partial traffic hides.** Once every storefront request landed on Render, memory per instance crept past 90%. Puma workers grew from about 400 MB to about 530 MB under load, and the only thing recycling them was a timed restart. We're adding recycling based on memory instead. The same week, we noticed that 42% of our web requests were CORS preflights: the storefront sent custom headers on simple GETs, so the browser asked permission before every one. Dropping those headers makes them plain requests again.

## Did it work?

The whole web tier and all of staging now run on Render, and it serves about 93% of our web traffic. The biggest lesson was about capacity: our web services are CPU-idle and memory-bound. About 400 MB per Puma worker is just the app booted, not a leak, so the lever is memory per instance. That's why the dashboard and storefront services moved to 4 GB instances to fit more workers.

**What did it save?** I don't have a clean number, and I'd rather say so. Too much changed at once. Bigger instances made the same work cheaper per request, but over the same months two other projects cut the work itself: [moving order updates to Shopify Events](/writing/shopify-events-filters/) took out most of our `orders/updated` webhooks, and moving the theme extension's reads to the Storefront API cut calls to our servers. Any before-and-after bill mixes all three.

What's left is the part we deliberately deferred: production workers, crons, and running migrations on Render so the deploy watcher can go.

And that covers moving a Rails web tier from Heroku to Render. If you're planning the same move, or want to compare notes, say hi on [X](https://x.com/0xfluke).
