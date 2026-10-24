/** True for ⌘K / Ctrl+K anywhere, or "/" outside a text field. */
export function isPaletteShortcut(e: KeyboardEvent) {
  const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName));
  return (e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing);
}
