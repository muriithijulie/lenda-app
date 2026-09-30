export const ACCENT_OPTIONS = [
  { name: "Green", value: "#00E676" },
  { name: "Blue", value: "#40C4FF" },
  { name: "Pink", value: "#FF4081" },
  { name: "Gold", value: "#FFD740" },
  { name: "Orange", value: "#FF7A00" },
  { name: "Magenta", value: "#D500F9" },
  { name: "Cyan", value: "#00E5FF" },
];

export const FONT_OPTIONS = [
  { name: "DM Sans (Default)", value: "'DM Sans', sans-serif" },
  { name: "Space Grotesk", value: "'Space Grotesk', sans-serif" },
  { name: "Playfair (Serif)", value: "'Playfair Display', serif" },
  { name: "JetBrains Mono", value: "'JetBrains Mono', monospace" },
  { name: "Fredoka (Rounded)", value: "'Fredoka', sans-serif" },
  { name: "Oswald (Condensed)", value: "'Oswald', sans-serif" },
];

export const MODE_OPTIONS = [
  { key: "dark", label: "Dark" },
  { key: "light", label: "Light" },
  { key: "midnight", label: "Midnight" },
  { key: "forest", label: "Forest" },
];

export const CARD_STYLE_OPTIONS = [
  { key: "default", label: "Default" },
  { key: "glass", label: "Glass" },
  { key: "minimal", label: "Minimal" },
];

export const DEFAULT_ADMIN_THEME = { mode: "dark", accent: "#00E676", font: FONT_OPTIONS[0].value };
export const DEFAULT_PORTAL_THEME = {
  mode: "dark",
  accent: "#00E676",
  font: FONT_OPTIONS[0].value,
  backgroundColor: "",
  backgroundImage: "",
  logoUrl: "",
  cardStyle: "default",
};

// Applies mode + accent + font (and, for the portal, background/card style) as
// CSS custom properties on an element. The base palettes for each mode live
// in globals.css under [data-theme="..."] selectors; this only overrides the
// pieces the person has actually customized (accent, font, background).
export function applyTheme(el, theme, { cardStyleTarget } = {}) {
  if (!el || !theme) return;
  el.setAttribute("data-theme", theme.mode || "dark");
  el.style.setProperty("--accent", theme.accent || "#00E676");
  el.style.setProperty("--font-main", theme.font || FONT_OPTIONS[0].value);
  if (theme.backgroundColor) el.style.setProperty("--bg", theme.backgroundColor);
  if (cardStyleTarget) cardStyleTarget.dataset.cardStyle = theme.cardStyle || "default";
}
