/**
 * Utility functions for TV remote navigation
 * Now primarily using js-spatial-navigation for arrow key handling
 * This file maintains legacy functions for back key detection
 */

const BACK_KEYS = new Set(['Escape', 'Backspace', 'BrowserBack', 'Back']);

// eslint-disable-next-line import/prefer-default-export
export function isBackKey(event: KeyboardEvent) {
  return BACK_KEYS.has(event.key);
}
