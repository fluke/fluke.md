---
title: Cron scheduling with Heroku Scheduler and custom intervals
short: Heroku Scheduler custom intervals
description: Running daily, twice-monthly and monthly jobs on Heroku Scheduler by triggering a rake task every day and checking the date inside it.
date: 2016-03-15
tags: [heroku, cron, ruby]
medium: https://medium.com/jobspire-blog/cron-scheduling-using-heroku-scheduler-7f4f8351990c
---

Scheduling repetitive tasks on Heroku using Heroku Scheduler while keeping flexibility.

## Then

Around a year ago I wrote an article on free cron scheduling on Heroku for the Jobspire blog. In it I wrote:

> We could have used [Heroku Scheduler](https://elements.heroku.com/addons/scheduler) and that's a good idea if you need to schedule tasks in intervals of ten minutes, daily or monthly. However, for certain tasks we needed to define a much more specific execution interval. Three times a day, every two hours or even every 5 minutes.

Basically I needed to schedule tasks, and Heroku Scheduler only offered Daily, Hourly and Every 10 minutes. So I created an app on Google App Engine, which has a much simpler interface for setting up cron tasks, with a lot of control over when they run. The scheduling app would simply make a request to my Rails application telling it to do specific tasks on the schedule I defined.

```yaml
cron:
- description: daily
  url: /daily
  schedule: every day 10:00

- description: bimonthly
  url: /bimonthly
  schedule: second,fourth mon of month 10:00

- description: monthly
  url: /monthly
  schedule: 1 of month 10:00
```

This quickly became a chore to update. I'd mostly built the app to avoid the cost of paid cron services and to try out the Python framework Flask.

## Now

So we've updated our process to use Heroku Scheduler. Heroku Scheduler spins up a one-off dyno that runs a command; in this case I'm running a rake task. You can learn how to add it to your project and use it [in Heroku's docs](https://devcenter.heroku.com/articles/scheduler). You should end up with something like this:

![Heroku Scheduler listing four jobs — rake daily, rake weekly, rake monthly and rake bimonthly — each running daily on a 1X dyno](/assets/posts/heroku-scheduler/dashboard.png "Heroku Scheduler dashboard")

The following code is Ruby. [Rake](https://ruby.github.io/rake/) is a tool you can use with [Ruby](https://www.ruby-lang.org/) projects to define "tasks" in Ruby that can be run from the command line. We now handle daily, twice-monthly and monthly jobs like this: the task is triggered every day, but the work only runs on days that match the parameters we want.

```ruby
task daily: [:environment] do
  # Daily tasks
end

task bimonthly: [:environment] do
  # If second week or fourth week of the month
  if Time.now.day == 14 || Time.now.day == 28
    # Weekly tasks
  end
end

task monthly: [:environment] do
  # If first of the month
  if Time.now.day == 1
    # Monthly tasks
  end
end
```

That gave me the flexibility I wanted out of Heroku Scheduler. The caveats are that you can't run anything more often than every ten minutes, and Heroku warns that if scheduling is critical to your app you should [run a custom clock process](https://devcenter.heroku.com/articles/scheduled-jobs-custom-clock-processes#custom-clock-processes).

## A note on cost

Heroku allowed a certain number of free dyno-hours. If your scheduled process ran for less than that, scheduling was essentially free; otherwise costs were related to use. A task running once a day was unlikely to get you charged, but one running every ten minutes might.

> **2026 note:** Heroku ended free dynos in November 2022, so scheduled runs now use paid dyno hours.
