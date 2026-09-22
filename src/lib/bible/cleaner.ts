/**
 * Strips translator supplied word markers (such as {word} or [word] in KJV modules)
 * and normalizes whitespace for projection and UI display.
 */
export function cleanScriptureText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/\{([^}]+)\}/g, '$1')
    .replace(/\[([^\]]+)\]/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
