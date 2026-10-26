// Turns a note's frontmatter into { image, y } for the banner template, or
// null when the note has no banner. Values follow the Obsidian banner
// plugins: "[[image.png]]", "![[image.png]]", "![](image.png)", a vault
// path, or an external URL; false/"none" turns the banner off.

const OFF_VALUES = new Set(["", "false", "none", "no-banner", "no-b"]);

function parseProperties(list) {
  return String(list || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

function linkTarget(value) {
  let target = value.trim();

  const wikilink = target.match(/^!?\[\[([^\]]+)\]\]$/);
  if (wikilink) {
    return wikilink[1].split("|")[0].split("#")[0].trim();
  }

  const markdownLink = target.match(/^!?\[[^\]]*\]\(([^)]+)\)$/);
  if (markdownLink) {
    target = markdownLink[1].trim().replace(/^<(.*)>$/, "$1");
    try {
      target = decodeURIComponent(target);
    } catch {
      // Keep it as written
    }
  }

  return target;
}

function imageUrl(value) {
  const target = linkTarget(value);
  if (!target) return null;

  if (/^https?:\/\//i.test(target)) return target;
  // Local file:// paths and other schemes can't be served by the site
  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return null;

  // Published vault images live under /img/user/<vault path>; the Obsidian
  // plugin rewrites frontmatter links to full vault paths when publishing.
  const path = target.replace(/^\/+/, "").replace(/^img\/user\//, "");
  return (
    "/img/user/" +
    path
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/")
  );
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Vertical focus as a CSS percentage (0 = top, 50 = center, 100 = bottom)
function verticalPosition(props) {
  // Note Banners: banner-pos from -100 (bottom) to 100 (top), 0 = center
  const notePos = Number(props["banner-pos"]);
  if (props["banner-pos"] !== undefined && Number.isFinite(notePos)) {
    return (100 - clamp(notePos, -100, 100)) / 2;
  }

  // Banners: banner_y from 0 to 1. Banners Reloaded: 0% to 100%.
  for (const key of ["banner_y", "banner-y"]) {
    const raw = props[key];
    if (raw === undefined || raw === null || raw === "") continue;
    const text = String(raw).trim();
    const number = parseFloat(text);
    if (!Number.isFinite(number)) continue;
    if (text.endsWith("%") || number > 1) return clamp(number, 0, 100);
    return clamp(number * 100, 0, 100);
  }

  return 50;
}

function gardenBanner(noteProps, propertyList) {
  if (!noteProps || typeof noteProps !== "object") return null;

  for (const key of parseProperties(propertyList)) {
    let value = noteProps[key];
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) value = value[0];
    if (value === false) return null;
    if (typeof value !== "string") continue;
    if (OFF_VALUES.has(value.trim().toLowerCase())) return null;

    const image = imageUrl(value);
    if (!image) continue;

    return {
      // Quoted inside CSS url("…"), so keep quotes, backslashes and
      // newlines out of it
      image: image.replace(/["\\\n\r]/g, (c) => encodeURIComponent(c)),
      y: verticalPosition(noteProps),
    };
  }

  return null;
}

module.exports = {
  gardenBanner,
  setupEleventy(eleventyConfig) {
    eleventyConfig.addFilter("gardenBanner", gardenBanner);
  },
};
