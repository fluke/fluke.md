export default {
  layout: "layouts/post.njk",
  tags: ["posts"],
  permalink: (data) => `/writing/${data.page.fileSlug}/`,
};
