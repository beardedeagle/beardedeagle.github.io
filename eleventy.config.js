export default function(eleventyConfig) {
  const normalizeMermaidSource = (content) => content
    .trim()
    .replace(/^<p>/, "")
    .replace(/<\/p>$/, "")
    .replace(/<\/p>\s*<p>/g, "\n");

  // Pass through static assets
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");

  // Collection: all projects sorted by display order
  eleventyConfig.addCollection("projects", function(collectionApi) {
    return collectionApi.getFilteredByGlob("src/projects/*.md")
      .sort((a, b) => (a.data.order || 999) - (b.data.order || 999));
  });

  // Collection: long-form writing, newest first; parts of one series in order
  eleventyConfig.addCollection("posts", function(collectionApi) {
    return collectionApi.getFilteredByGlob("src/writing/*.md")
      .sort((a, b) => (b.date - a.date) || ((a.data.part || 0) - (b.data.part || 0)));
  });

  // Filter: posts in one series, in reading order
  eleventyConfig.addFilter("seriesOf", function(posts, series) {
    if (!Array.isArray(posts) || !series) return [];
    return posts
      .filter(p => p.data.series === series)
      .sort((a, b) => (a.data.part || 0) - (b.data.part || 0));
  });

  // Filters: dates rendered in UTC so the published day never shifts
  eleventyConfig.addFilter("readableDate", function(date) {
    return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(date);
  });
  eleventyConfig.addFilter("isoDate", function(date) {
    return date.toISOString().slice(0, 10);
  });

  // Filter: reading time in minutes at ~230 words per minute, ignoring markup
  eleventyConfig.addFilter("readingTime", function(html) {
    const words = String(html || "").replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 230));
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
