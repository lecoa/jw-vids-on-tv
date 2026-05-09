const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled]):not([type="hidden"]):not([readonly])',
  'select:not([disabled]):not([readonly])',
  'textarea:not([disabled]):not([readonly])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

const BACK_KEYS = new Set(['Escape', 'Backspace', 'BrowserBack', 'Back']);
const NAVIGATION_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter']);

export function isBackKey(event: KeyboardEvent) {
  return BACK_KEYS.has(event.key);
}

export function isRemoteNavigationKey(event: KeyboardEvent) {
  return NAVIGATION_KEYS.has(event.key);
}

export function isEditableElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return !target.readOnly && !target.disabled;
  }

  if (target instanceof HTMLSelectElement) {
    return !target.disabled;
  }

  return target.isContentEditable;
}

export function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.tabIndex >= 0 && element.getClientRects().length > 0,
  );
}

export function focusRelativeElement(
  container: HTMLElement,
  current: HTMLElement | null,
  direction: -1 | 1,
) {
  const focusableElements = getFocusableElements(container);
  if (focusableElements.length === 0) {
    return false;
  }

  const currentIndex = current ? focusableElements.indexOf(current) : -1;
  let nextIndex = 0;

  if (currentIndex === -1) {
    nextIndex = direction > 0 ? 0 : focusableElements.length - 1;
  } else {
    nextIndex = (currentIndex + direction + focusableElements.length) % focusableElements.length;
  }

  focusableElements[nextIndex]?.focus();
  return true;
}

export function clickActiveElement(target: EventTarget | null) {
  if (target instanceof HTMLElement) {
    target.click();
    return true;
  }

  return false;
}
