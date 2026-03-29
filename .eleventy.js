/**
 * Eleventy (11ty) Configuration File
 * 
 * Sets up the static site generator for the Custom Design Submission Portal
 * Handles templating, asset copying, and build optimization
 */

module.exports = function(eleventyConfig) {
  
  // ============================================================================
  // PASSTHROUGH FILE COPYING
  // Copy static assets without processing
  // ============================================================================
  
  // Copy CSS files
  eleventyConfig.addPassthroughCopy("src/css");
  
  // Copy JavaScript files
  eleventyConfig.addPassthroughCopy("src/js");
  
  // Copy images if any
  eleventyConfig.addPassthroughCopy("src/images");
  
  // Copy favicon and other root assets
  eleventyConfig.addPassthroughCopy("src/favicon.ico");
  eleventyConfig.addPassthroughCopy("src/*.ico");
  eleventyConfig.addPassthroughCopy("src/*.png");
  eleventyConfig.addPassthroughCopy("src/*.svg");
  
  // ============================================================================
  // CUSTOM FILTERS
  // ============================================================================
  
  /**
   * Filter to format date strings
   * Usage: {{ date | formatDate }}
   */
  eleventyConfig.addFilter("formatDate", function(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  });
  
  /**
   * Filter to create slug from string
   * Usage: {{ title | slug }}
   */
  eleventyConfig.addFilter("slug", function(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  });
  
  // ============================================================================
  // SHORTCODES
  // ============================================================================
  
  /**
   * Shortcode to get current year
   * Usage: {% currentYear %}
   */
  eleventyConfig.addShortcode("currentYear", function() {
    return new Date().getFullYear().toString();
  });
  
  /**
   * Shortcode to get current build timestamp
   * Usage: {% buildTime %}
   */
  eleventyConfig.addShortcode("buildTime", function() {
    return new Date().toISOString();
  });
  
  // ============================================================================
  // WATCH TARGETS
  // Additional files to watch during development
  // ============================================================================
  
  eleventyConfig.addWatchTarget("src/css/");
  eleventyConfig.addWatchTarget("src/js/");
  eleventyConfig.addWatchTarget("src/images/");
  
  // ============================================================================
  // LAYOUT ALIASES
  // Shortcut for common layouts
  // ============================================================================
  
  eleventyConfig.addLayoutAlias("base", "base.njk");
  eleventyConfig.addLayoutAlias("default", "base.njk");
  
  // ============================================================================
  // MARKDOWN CONFIGURATION
  // ============================================================================
  
  const markdownIt = require("markdown-it");
  eleventyConfig.setLibrary("md", markdownIt({
    html: true,
    breaks: true,
    linkify: true
  }));
  
  // ============================================================================
  // SERVER CONFIGURATION
  // ============================================================================
  
  return {
    // Input directory (source files)
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data"
    },
    
    // Template file formats to process
    templateFormats: ["njk", "md", "html", "11ty.js"],
    
    // Default markdown template engine
    markdownTemplateEngine: "njk",
    
    // Default HTML template engine
    htmlTemplateEngine: "njk",
    
    // If true, the output directory is cleared before build
    dirOutputOnWrite: true,
    
    // Control the default HTML pretty print behavior
    htmlOutputConfig: {
      indent: 2,
      wrap: 0
    }
  };
};
