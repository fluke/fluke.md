---
title: "Gmail API and Rails: sending emails through ActionMailer"
short: Gmail API and Rails ActionMailer
description: How google-http-actionmailer sends ActionMailer mail through the Gmail HTTP API, with token refresh, per-message delivery settings and send hooks.
date: 2019-01-03
tags: [rails, gmail, actionmailer]
medium: https://medium.com/@kartikluke/gmail-api-and-rails-sending-emails-through-actionmailer-f2a34098474c
featured: false
---

When I was working with my friends on [Foxbound](https://www.foxbound.io/), one of the main features we needed for the sales automation tool was to send emails through a user's Gmail account. Getting this to work in Ruby is easy once you manage to find the documentation. However, I wanted to integrate it with ActionMailer, because it's a nice structured way of writing mailers and it lets us leverage built-in functionality like the ActiveJob integration to queue up mail for later.

So that's how I got around to writing a gem to add Gmail HTTP API support for ActionMailer, which led to the creation of **[google-http-actionmailer](https://github.com/fluke/google-http-actionmailer)**.

## So how do you send mail through the Gmail HTTP API in Ruby?

```ruby
gem 'google-api-client'

require 'google/apis/gmail_v1'

mail = Mail.new
# ...

service = Google::Apis::GmailV1::GmailService.new
service.authorization = access_token # You'll get this through your refresh token

message = Google::Apis::GmailV1::Message.new(
  raw: mail.to_s
)

service.send_user_message(
  user_id, # ID of the user or 'me' for current authenticated user
  message
)
```

In the gem, this code is incorporated as a custom delivery method that gets included into ActionMailer.

## What can google-http-actionmailer do?

The gem is a plug-and-play solution for sending mail through the Google HTTP API for Gmail. It's easy to configure.

While working on Foxbound, we also found that we wanted to track the emails we sent and the threads they were in. The message ID and thread ID come back in the response from the Gmail API.

So we added hooks that trigger on your mail object before and after the email is sent. This lets you write callbacks to store details, trigger actions conditionally, and so on.

## How do I use google-http-actionmailer?

Set up your authorization as described in the [Google API Client](https://github.com/google/google-api-ruby-client/#authorization) (the easiest method is to pass a valid access token, which I describe below), then edit `config/application.rb` or `config/environments/<ENVIRONMENT>.rb` and add or change the ActionMailer configuration:

```ruby
config.action_mailer.delivery_method = :google_http_actionmailer

config.action_mailer.google_http_actionmailer_settings = {
  authorization: ...,
  client_options: {
    application_name: ...,
    application_version: ...,
  },
  request_options: {
    retries: ...,
    header: ...,
  },
  message_options: {
    fields: ...,
    content_type: ...,
  },
  delivery_options: {
    before_send: ...,
    after_send: ...,
  }
}
```

For client and request options, see [the options in the Google API client](https://github.com/google/google-api-ruby-client/blob/master/lib/google/apis/options.rb). For message options, see the `send_user_message` method [in the Gmail service](https://github.com/google/google-api-ruby-client/blob/master/generated/google/apis/gmail_v1/service.rb#L1150).

Normal ActionMailer usage will now be sent using Google's HTTPS API.

If you go with access tokens for authorization, you'll need to know how to refresh them and how to set the token dynamically at the time of sending, which I describe below.

## Refreshing access tokens

This requires the **omniauth-google-oauth2** gem. We use our existing access token and refresh token to obtain a new token.

```ruby
strategy = OmniAuth::Strategies::GoogleOauth2.new(nil, <GOOGLE_CLIENT_ID>, <GOOGLE_CLIENT_SECRET>)
client = strategy.client
token = OAuth2::AccessToken.new client, access_token, { refresh_token: refresh_token }
new_token = token.refresh!
# Store the new token
```

## Dynamically setting the delivery method

Access tokens usually expire, so you may need to set the delivery method dynamically. For that we use an interceptor. Interceptors are a concept in ActionMailer: they receive the message before it's sent, so you can use them to modify messages on the way out. In this case we use an interceptor to set the delivery method with a token we refreshed:

```ruby
class DynamicSettingsInterceptor
  def self.delivering_email(message)
    token = user.new_token

    message.delivery_method(
      GoogleHttpActionmailer::DeliveryMethod,
      {
        authorization: token
      }
    )

    message
  end
end

register_interceptor ::DynamicSettingsInterceptor
```

## Setting after-send and before-send hooks

Sometimes we want the object returned by the Gmail API, perhaps to store details of the email that was sent. For that we can use delivery options: pass a proc that takes two parameters, `mail` (the object created by ActionMailer) and `message` (the object created by the Gmail API), to the `after_send` and `before_send` hooks.

```ruby
config.action_mailer.delivery_method = :google_http_actionmailer

config.action_mailer.google_http_actionmailer_settings = {
  authorization: access_token,
  ...
  delivery_options: {
    after_send: ->(mail, message) {
      ...
    },
    before_send: ->(mail, message) {
      ...
    }
  }
}
```

And that covers using **[google-http-actionmailer](https://github.com/fluke/google-http-actionmailer)**. If you'd like to look at the code, contribute or make suggestions, head over to [GitHub](https://github.com/fluke/google-http-actionmailer), or say hi on [X](https://x.com/0xfluke).
