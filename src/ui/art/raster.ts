// Draw the game's SVG art on a canvas. Each drawing is turned into an image once and
// kept; until it has loaded, callers get null and fall back to something simpler.
const images = new Map<string, HTMLImageElement>();

/** The image for an SVG string, or null while it is still loading. `make` runs once per key. */
export function svgImage(key: string, make: () => string): HTMLImageElement | null {
  let img = images.get(key);
  if (!img) {
    img = new Image();
    img.decoding = 'async';
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized(make()))}`;
    images.set(key, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

/** An SVG needs a width and height of its own to be drawn as an image. */
function sized(svg: string, px = 128): string {
  const open = svg.slice(0, svg.indexOf('>'));
  if (/\swidth=/.test(open)) return svg.replace(/\swidth="[^"]*"/, ` width="${px}"`).replace(/\sheight="[^"]*"/, ` height="${px}"`);
  return svg.replace('<svg ', `<svg width="${px}" height="${px}" `);
}
