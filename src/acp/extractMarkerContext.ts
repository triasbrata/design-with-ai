/**
 * Client-side marker context extractor.
 *
 * Reads the iframe DOM at the marker rectangle coordinates and returns
 * structured context about the marked element.
 */
import type { MarkerRect, MarkerContext } from '../types';

/**
 * Build a simple CSS selector path for an element (max 3 levels deep).
 */
function buildSelector(el: Element): string {
  const parts: string[] = [];
  let current: Element | null = el;
  let depth = 0;
  while (current && current.tagName !== 'BODY' && current.tagName !== 'HTML' && depth < 3) {
    let seg = current.tagName.toLowerCase();
    if (current.id) {
      seg += `#${current.id}`;
      parts.unshift(seg);
      break; // ID is unique, stop here
    }
    if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\s+/).filter(Boolean);
      if (classes.length > 0) {
        seg += '.' + classes.join('.');
      }
    }
    parts.unshift(seg);
    current = current.parentElement;
    depth++;
  }
  return parts.join(' > ');
}

/**
 * Extract context from the iframe document at the marker coordinates.
 *
 * @param screen   Current screen name
 * @param state    Current active state
 * @param rect     Marker rectangle (coordinates relative to iframe content, 390×844)
 * @param iframeDoc The iframe's contentDocument (must be same-origin)
 * @returns MarkerContext or null if extraction fails
 */
export function extractMarkedContext(
  screen: string,
  state: string,
  rect: MarkerRect,
  iframeDoc: Document | null,
): MarkerContext | null {
  if (!iframeDoc) return null;

  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;

  // elementFromPoint works relative to the document's viewport.
  // For an iframe with viewport 390×844, these coords map directly.
  const el = iframeDoc.elementFromPoint(cx, cy);
  if (!el || !el.tagName) return null;

  // Closest data-baseline-state ancestor
  const baselineEl = el.closest('[data-baseline-state]');
  const baselineState = baselineEl
    ? baselineEl.getAttribute('data-baseline-state') || undefined
    : undefined;

  const tag = el.tagName.toLowerCase();
  const text = el.textContent?.trim() || '';
  const selector = buildSelector(el);

  // Find nearest cai-id (on element or ancestor)
  const caiId = el.getAttribute('cai-id')
    || el.closest('[cai-id]')?.getAttribute('cai-id')
    || undefined;

  return {
    screen,
    state: baselineState || state,
    rect,
    element: {
      tag,
      text,
      selector,
      boundingBox: rect,
      caiId,
    },
  };
}
