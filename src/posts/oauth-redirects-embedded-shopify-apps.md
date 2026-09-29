---
title: OAuth redirects (and others) in embedded Shopify apps
short: OAuth redirects in embedded Shopify apps
description: Why redirect_to fails inside an embedded Shopify app's iframe, and how shopify_app's fullpage_redirect_to breaks out of it.
date: 2018-01-15
tags: [shopify, oauth, rails]
medium: https://medium.com/@kartikluke/oauth-redirects-and-others-in-embedded-shopify-apps-a569e15cbf38
featured: true
---

> **2026 note:** this describes the 2018 embedded app SDK. Embedded apps now use App Bridge, where `window.open(url, "_top")` navigates the top frame. The lesson about reading your gems' source still stands.

Redirecting out of your embedded Shopify app isn't quite straightforward. I'd integrated Facebook AdInsights data into my app but was unable to get the OAuth request to work within the embedded iframe, as it blocks the request. I'd taken to using a workaround: opening the authentication page in another tab that wasn't embedded. This was pretty clearly bad UX, but I couldn't figure my way around it.

That was until I went through the code of the very useful [shopify_app](https://github.com/Shopify/shopify_app) gem that I'd been using this whole time and found the [fullpage_redirect_to](https://github.com/Shopify/shopify_app/blob/3fb589d71bc03a11a8bb48bf87e613f6ce0210ea/lib/shopify_app/controller_concerns/login_protection.rb#L65) method. On further inspection I found in the Shopify documentation that there was a way to get your request out of the iframe.

## The great escape

Since your app is loaded in an iframe, you can't use the usual `redirect_to 'auth/facebook'`, assuming you're using Facebook OmniAuth.

You have to instead return a page with:

```html
<script type='text/javascript'>
  // If the current window is the 'parent', change the URL by setting location.href
  if (window.top == window.self) {
    window.top.location.href = "/auth/facebook";

  // If the current window is the 'child', change the parent's URL with postMessage
  } else {
    message = JSON.stringify({
      message: "Shopify.API.remoteRedirect",
      data: { location: window.location.origin + "/auth/facebook" }
    });
    window.parent.postMessage(message, "https://myshopname.myshopify.com");
  }
</script>
```

## On the Rails

shopify_app implements this in a reusable way. The `fullpage_redirect_to` method renders an HTML page if we're in an embedded app. Otherwise it does a normal redirect.

```ruby
def fullpage_redirect_to(url)
  if ShopifyApp.configuration.embedded_app?
    render 'shopify_app/shared/redirect', locals: { url: url, current_shopify_domain: current_shopify_domain }
  else
    redirect_to url
  end
end
```

The HTML page contains a `<div>` with the parameters for our redirect as data attributes.

```erb
...
<body>
  <%=
  content_tag(:div, nil,
    id: 'redirection-target',
    data: {
      target: {
        myshopifyUrl: "https://#{current_shopify_domain}",
        url: url,
      },
    },
  )
  %>
</body>
...
```

The JS function picks up these parameters and triggers the redirection script.

```js
document.addEventListener("DOMContentLoaded", function() {
  var redirectTargetElement = document.getElementById("redirection-target");
  var targetInfo = JSON.parse(redirectTargetElement.dataset.target)

  if (window.top == window.self) {
    // If the current window is the 'parent', change the URL by setting location.href
    window.top.location.href = targetInfo.url;
  } else {
    // If the current window is the 'child', change the parent's URL with postMessage
    normalizedLink = document.createElement('a');
    normalizedLink.href = targetInfo.url;

    data = JSON.stringify({
      message: 'Shopify.API.remoteRedirect',
      data: { location: normalizedLink.href }
    });
    window.parent.postMessage(data, targetInfo.myshopifyUrl);
  }
});
```

## Conclusion

It's always a good idea to read through the code of the gems you use if you're having trouble, especially open source ones. Documentation is generally sparse because the maintainers might not have the time.
