export default function(eleventyConfig) {
  const normalizeMermaidSource = (content) => content
    .trim()
    .replace(/^<p>/, "")
    .replace(/<\/p>$/, "")
    .replace(/<\/p>\s*<p>/g, "\n");

  // Pass through static assets
  eleventyConfig.addPassthroughCopy("src/css");

  // Collection: all projects sorted by display order
  eleventyConfig.addCollection("projects", function(collectionApi) {
    return collectionApi.getFilteredByGlob("src/projects/*.md")
      .sort((a, b) => (a.data.order || 999) - (b.data.order || 999));
  });

  // Filter: first N items from a collection
  eleventyConfig.addFilter("head", function(array, n) {
    if (!Array.isArray(array)) return array;
    return array.slice(0, n);
  });

  // Filter: projects with public-facing repos/pages
  eleventyConfig.addFilter("available", function(projects) {
    return projects.filter(p => p.data.status === "available");
  });

  // Filter: projects that remain private
  eleventyConfig.addFilter("upcoming", function(projects) {
    return projects.filter(p => p.data.status === "upcoming");
  });

  // Shortcode: status badge
  eleventyConfig.addShortcode("status", function(status) {
    const labels = {
      available: "Public",
      upcoming: "Private",
      preview: "Preview"
    };
    return `<span class="badge badge--${status}">${labels[status] || status}</span>`;
  });

  // Shortcode: tech tag
  eleventyConfig.addShortcode("tech", function(name) {
    return `<span class="tech-tag">${name}</span>`;
  });

  // Shortcode: Mermaid diagram block
  eleventyConfig.addPairedShortcode("mermaid", function(content) {
    return `<div class="mermaid-container"><pre class="mermaid">${normalizeMermaidSource(content)}</pre></div>`;
  });

  // Shortcode: architecture callout (show the what, not the how)
  eleventyConfig.addPairedShortcode("archnote", function(content, title) {
    return `<aside class="arch-note"><div class="arch-note__title">${title}</div><div class="arch-note__body">${content.trim()}</div></aside>`;
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data"
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk"
  };
}
