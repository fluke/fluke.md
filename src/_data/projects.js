const ARTOS = '<a href="https://artossoftware.com">Artos Software</a>';

// Order is the ←/→ pager order. `menu` is the one-liner on the home page.
export default [
  {
    slug: "artos",
    name: "Artos Software",
    section: "NOW",
    menu: "The studio I co-founded.",
    desc: "Artos Software is the software studio I co-founded. We build Shopify apps: STOQ, Filemonk and Invoice Falcon.",
    paras: [
      `${ARTOS} is the software studio I co-founded with Sandesh. We're a small, remote team with one goal: help Shopify merchants grow.`,
      "We make three apps: STOQ for pre-orders and back-in-stock alerts, Filemonk for selling digital products, and Invoice Falcon for invoices. I'm the CTO, which mostly means I write a lot of Rails.",
      "Sandesh and I have been building things together since Jobspire, back in college.",
    ],
    out: [["https://artossoftware.com", "VISIT ARTOSSOFTWARE.COM ▶"]],
    info: [
      ["TYPE", "Studio"],
      ["ROLE", "Co-founder, CTO"],
      ["SINCE", "2023"],
      ["TEAM", "Remote"],
      ["APPS", '<a href="/stoq/">STOQ</a>, <a href="/filemonk/">Filemonk</a>, <a href="/invoice-falcon/">Invoice Falcon</a>'],
    ],
  },
  {
    slug: "stoq",
    name: "STOQ",
    section: "NOW",
    menu: "Pre-orders and restock alerts.",
    desc: "STOQ (formerly Restock Rocket) is a Shopify app for pre-orders, back-in-stock alerts and demand analytics, used by 20,000+ merchants.",
    paras: [
      "STOQ helps Shopify merchants keep selling when stock runs out: pre-orders, back-in-stock alerts over email, SMS and push, and analytics on what customers are waiting for.",
      "It started life as Restock Rocket, a back-in-stock alerts app. We added pre-orders in 2024, renamed it STOQ, and it now runs on 20,000+ stores.",
      "In 2025 it was picked as one of the Best of Built for Shopify apps at Shopify Editions. It's rated 5.0 across 2,000+ reviews, most of them earned by our Merchant Success team.",
    ],
    out: [
      ["https://www.stoqapp.com", "VISIT STOQAPP.COM ▶"],
      ["https://apps.shopify.com/back-in-stock-restock-alerts", "VIEW ON SHOPIFY ▶"],
    ],
    info: [
      ["TYPE", "Shopify app"],
      ["BY", ARTOS],
      ["ROLE", "Co-founder"],
      ["STORES", "20,000+"],
      ["RATING", "5.0 ★"],
      ["WAS", "Restock Rocket"],
    ],
  },
  {
    slug: "filemonk",
    name: "Filemonk",
    section: "NOW",
    menu: "Digital downloads.",
    desc: "Filemonk is a Shopify app for selling digital products with instant delivery and content protection.",
    paras: [
      "Filemonk lets Shopify merchants sell digital products — ebooks, music, courses, licence keys — with instant delivery after checkout and protection against link sharing.",
      "It powers digital downloads for 12,000+ stores.",
    ],
    out: [
      ["https://filemonk.io", "VISIT FILEMONK.IO ▶"],
      ["https://apps.shopify.com/filemonk", "VIEW ON SHOPIFY ▶"],
    ],
    info: [["TYPE", "Shopify app"], ["BY", ARTOS], ["ROLE", "Co-founder"], ["STORES", "12,000+"]],
  },
  {
    slug: "invoice-falcon",
    name: "Invoice Falcon",
    section: "NOW",
    menu: "Invoices and packing slips.",
    desc: "Invoice Falcon is a Shopify app for professional, customisable invoices and documents.",
    paras: [
      "Invoice Falcon makes professional, customisable invoices and documents for Shopify orders: sent automatically after payment, with bulk-printed packing slips, credit notes and multi-currency support.",
    ],
    out: [
      ["https://invoicefalcon.com", "VISIT INVOICEFALCON.COM ▶"],
      ["https://apps.shopify.com/invoice-falcon", "VIEW ON SHOPIFY ▶"],
    ],
    info: [["TYPE", "Shopify app"], ["BY", ARTOS], ["ROLE", "Founder"]],
  },
  {
    slug: "jobspire",
    name: "Jobspire",
    section: "BEFORE",
    desc: "Jobspire was a recruitment and career platform for Indian startups. I co-founded it at Manipal and was CTO from 2014 until it was acquired in 2017.",
    paras: [
      "Jobspire was a recruitment and career platform for Indian startups. Four of us started it in our seventh semester at Manipal Institute of Technology, and I was CTO.",
      "We raised $262K from angel investors in 2015 and grew to 200,000 professionals and 1,000+ companies. I architected the Rails stack and led a five-person tech and product team.",
      "JustCode, a New York company, acquired Jobspire in early 2017.",
    ],
    out: [],
    info: [
      ["TYPE", "Startup"],
      ["ROLE", "Co-founder, CTO"],
      ["YEARS", "2014–2017"],
      ["RAISED", "$262K"],
      ["EXIT", "JustCode, 2017"],
    ],
  },
];
