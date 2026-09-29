import rssPlugin from "@11ty/eleventy-plugin-rss";
import syntaxHighlight from "@11ty/eleventy-plugin-syntaxhighlight";

const SITE = "https://fluke.md";

// Markdown source characters stay in the page as quiet, unselectable spans so a
// post reads like the .md file it came from.
const mk = (s) => `<span class="mk" aria-hidden="true">${s}</span>`;

function visibleMarkdown(md) {
  const r = md.renderer.rules;
  const escape = md.utils.escapeHtml;

  r.heading_open = (tokens, idx, opts, env, self) => {
    const level = Number(tokens[idx].tag.slice(1));
    const text = tokens[idx + 1].content;
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    tokens[idx].attrSet("id", id);
    return self.renderToken(tokens, idx, opts) + mk("#".repeat(level) + " ");
  };

  r.strong_open = () => "<strong>" + mk("**");
  r.strong_close = () => mk("**") + "</strong>";
  r.em_open = () => "<em>" + mk("_");
  r.em_close = () => mk("_") + "</em>";
  r.code_inline = (tokens, idx) => `<code>${mk("`")}${escape(tokens[idx].content)}${mk("`")}</code>`;

  r.link_open = (tokens, idx, opts, env, self) => {
    const href = tokens[idx].attrGet("href") || "";
    (env.linkStack ||= []).push(href);
    if (/^https?:/.test(href) && !href.startsWith(SITE)) tokens[idx].attrSet("rel", "noopener");
    return self.renderToken(tokens, idx, opts) + mk("[") + '<span class="txt">';
  };
  r.link_close = (tokens, idx, opts, env) => {
    const href = env.linkStack.pop();
    return `</span>${mk("](")}<span class="url" aria-hidden="true">${escape(href)}</span>${mk(")")}</a>`;
  };

  r.blockquote_open = (tokens, idx, opts, env, self) => {
    env.quoteDepth = (env.quoteDepth || 0) + 1;
    return self.renderToken(tokens, idx, opts);
  };
  r.blockquote_close = (tokens, idx, opts, env, self) => {
    env.quoteDepth -= 1;
    return self.renderToken(tokens, idx, opts);
  };
  r.paragraph_open = (tokens, idx, opts, env, self) =>
    self.renderToken(tokens, idx, opts) + (env.quoteDepth ? mk("&gt; ") : "");

  r.list_item_open = (tokens, idx, opts, env, self) => {
    const t = tokens[idx];
    const marker = t.markup === "." || t.markup === ")" ? `${t.info}${t.markup} ` : `${t.markup} `;
    return self.renderToken(tokens, idx, opts) + mk(marker);
  };

  r.hr = () => `<hr>${mk("---")}`;

  r.image = (tokens, idx) => {
    const t = tokens[idx];
    const src = t.attrGet("src");
    const alt = escape(t.content);
    const title = t.attrGet("title");
    const img = `<img src="${src}" alt="${alt}" loading="lazy">`;
    return title ? `<figure>${img}<figcaption>${escape(title)}</figcaption></figure>` : img;
  };

  const fence = r.fence;
  r.fence = (tokens, idx, opts, env, self) => {
    const lang = escape(tokens[idx].info.trim().split(/\s+/)[0] || "");
    return (
      '<div class="code">' +
      `<div class="fence" aria-hidden="true">\`\`\`<span class="lang">${lang}</span></div>` +
      fence(tokens, idx, opts, env, self) +
      '<div class="fence" aria-hidden="true">```</div></div>'
    );
  };
}

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(rssPlugin);
  eleventyConfig.addPlugin(syntaxHighlight);
  eleventyConfig.amendLibrary("md", visibleMarkdown);

  // `draft: true` posts render under `npm start` (or DRAFTS=1) and are left out
  // of production builds entirely: no page, no feed entry, no sitemap line.
  const showDrafts = process.env.ELEVENTY_RUN_MODE !== "build" || process.env.DRAFTS === "1";
  eleventyConfig.addPreprocessor("drafts", "*", (data) => {
    if (data.draft && !showDrafts) return false;
  });

  eleventyConfig.addPassthroughCopy({ "src/assets": "assets", "src/CNAME": "CNAME" });
  eleventyConfig.addWatchTarget("src/assets/");

  eleventyConfig.addCollection("posts", (api) =>
    api.getFilteredByGlob("src/posts/*.md").sort((a, b) => b.date - a.date)
  );

  // Cache-busting for the stylesheet and script, fixed per build.
  eleventyConfig.addGlobalData("build", { version: Date.now().toString(36) });

  eleventyConfig.addFilter("upper", (s) => String(s).toUpperCase());
  eleventyConfig.addFilter("isoDate", (d) => d.toISOString().slice(0, 10));
  eleventyConfig.addFilter("displayDate", (d) =>
    d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).toUpperCase()
  );
  eleventyConfig.addFilter("year", (d) => d.getUTCFullYear());
  eleventyConfig.addFilter("readingTime", (html) => {
    const words = String(html).replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    return `${Math.max(1, Math.round(words / 220))} min`;
  });
  // Share images are screenshots named after the page's URL (see scripts/og.mjs).
  eleventyConfig.addFilter("ogImage", (url) => {
    const name = url === "/" ? "home" : url.replace(/^\/|\/$/g, "").replace(/\//g, "-");
    return `${SITE}/assets/og/${name}.png`;
  });
  // Feeds and JSON-LD get plain HTML without the visible Markdown markers.
  eleventyConfig.addFilter("stripMarkers", (html) =>
    String(html)
      .replace(/<span class="mk" aria-hidden="true">.*?<\/span>/g, "")
      .replace(/<span class="url" aria-hidden="true">.*?<\/span>/g, "")
      .replace(/<div class="fence" aria-hidden="true">.*?<\/div>/g, "")
  );
  eleventyConfig.addFilter("json", (v) => JSON.stringify(v));
  eleventyConfig.addFilter("postIndex", (posts, url) => posts.findIndex((p) => p.url === url));
  eleventyConfig.addFilter("topics", (tags = []) => tags.filter((t) => t !== "posts"));
  eleventyConfig.addFilter("postJsonLd", (data) =>
    JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: data.title,
      description: data.description,
      datePublished: data.page.date.toISOString().slice(0, 10),
      url: SITE + data.page.url,
      image: `${SITE}/assets/og/${data.page.url.replace(/^\/|\/$/g, "").replace(/\//g, "-")}.png`,
      author: { "@type": "Person", name: "Kartik Luke Singh", url: SITE + "/" },
      keywords: (data.tags || []).filter((t) => t !== "posts").join(", "),
    }).replace(/</g, "\\u003c")
  );

  return {
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    markdownTemplateEngine: false,
    htmlTemplateEngine: "njk",
  };
}
