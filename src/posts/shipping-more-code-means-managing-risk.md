---
title: "More code, more risk: managing AI like an engineering team"
short: More code, more risk
description: With AI agents doing the engineering work, my job has become an engineering manager's — deciding what ships and managing the risk with toggles, waves, shadow runs and kill switches.
date: 2026-10-04
tags: [engineering, rails, ai]
draft: true
---

<p class="todo">TODO: an opening moment in your own words, e.g. the first week you realised you hadn't written or reviewed a line yourself.</p>

At [Artos Software](https://artossoftware.com) we run Shopify apps on tens of thousands of stores. Last year I wrote that with coding agents I was still the bottleneck as the operator: the agents could open fifty PRs, but reviewing and landing them was on me. I thought the answer was hiring more operators.

It moved faster than that. Now the agents do that loop too: they pick up the work, implement it, test it, review each other's changes and open the PR. My job looks a lot more like an engineering manager's. I decide what we build, how it ships and whether it worked. I spend almost no time asking "is this code right?" and most of it asking "what happens if it isn't?"

## What changed?

The amount of change, and how far I am from it. We get through more changes in a week than we used to in a month, and I don't read most of them line by line. Each one is usually small and reasonable on its own. But with that many, the odds that one is subtly wrong go up, and so do the odds that two reasonable changes interact badly. Agent review and tests catch most of it. They can't catch all of it, because they only see the code, not twenty thousand stores with their own themes, apps and data.

So the question I care about is no longer whether a change is perfect. It's how many stores a change can hurt before we notice, and how fast we can take it back.

## How do you ship something you haven't watched work?

Behind a toggle, off by default. Almost every change that touches what merchants or their customers see ships dormant:

```ruby
def use_new_flow?(shop)
  Toggle.enabled?(shop, :new_flow) # off until we turn it on
end
```

Shipping and releasing become two separate decisions. The code can go out on a normal deploy, sit there doing nothing, and get turned on later for exactly the shops we choose. If it's wrong, turning it off is a setting change, not a deploy.

The default matters as much as the toggle. A missing toggle should mean the old, known behaviour. When we want something on for everyone, we flip the default deliberately as its own change, and keep the toggle as a way back out.

## How do you turn it on without betting every store?

In waves. Roughly:

1. **Our own test stores.** Every new thing gets switched on there first.
2. **One real merchant**, ideally one we talk to and who'll tell us when something looks off.
3. **A small slice of the fleet**, then bigger slices.
4. **Everyone**, by flipping the default.

Anything that changes data across the fleet goes through a script that does nothing unless you tell it to:

```ruby
# bin/rails "rollout:arm[new_flow]"         dry run: lists the next wave
# bin/rails "rollout:arm[new_flow,apply]"   actually turns it on
task :arm, [:flag, :mode] => :environment do |_, args|
  wave = Shop.installed.without_toggle(args[:flag]).limit(ENV.fetch("WAVE_SIZE", 100).to_i)
  puts "#{wave.count} shops in this wave"
  next unless args[:mode] == "apply"

  wave.find_each { |shop| Toggle.enable!(shop, args[:flag]) }
end
```

Dry run by default sounds fussy until the day it saves you. The wave size is the risk dial: small while we're unsure, larger once the numbers look boring.

## How do you know it's safe to widen?

You measure before you switch, not after. For bigger changes we run the new path in **shadow** first: it runs alongside the old one, records what it would have done, and changes nothing. Then we compare the two. When we moved our order updates to Shopify Events, the shadow run is where we found the problems, not our merchants.

And we add the telemetry before the feature, not after the first support ticket. If we can't see a change working, we can't tell whether the next wave is safe.

## What about taking it back?

Every toggle is a kill switch, but only if it works when you need it. A few things we learned:

- **Rollback isn't always instant.** Anything cached, like a storefront page or a setting, keeps the old answer for a while after you flip the switch. Know how long before you need to.
- **Ambiguity should fall back to the safe path.** If code can't tell whether something is enabled, it should do the old, known thing.
- **Have a fleet-wide off switch** for anything new on the storefront, separate from the per-shop toggles.

## So what does the job look like now?

The same job an engineering manager has, with the team made of agents. I set priorities and write the brief. I decide what ships dormant and how big each wave is. Then I watch the numbers and decide whether the next wave goes out. I hardly write code, and I don't need to review most of it. What I can't hand off is judgement about risk: what could break, for whom, and how we'd know.

<p class="todo">TODO: one or two numbers if you have them (changes per week before and after, how many toggles are live, a time a wave or shadow run caught something an agent missed).</p>

And that covers how my job changed. If you're going through the same shift, say hi on [X](https://x.com/0xfluke).
