/* eslint-disable no-console */
// @ts-ignore
import SpatialNavigation from 'js-spatial-navigation';

const SECTION_MAIN = 'sn-main';
const SECTION_DIALOG = 'sn-dialog';
const SECTION_SEARCH = 'sn-search';

interface SpatialNavOptions {
  visualDebug?: boolean;
  alwaysPreferEvent?: boolean;
}

class SpatialNavigationManager {
  private initialized: boolean = false;

  private options: SpatialNavOptions = {
    visualDebug: false,
    alwaysPreferEvent: true,
  };

  constructor(options: SpatialNavOptions = {}) {
    this.options = { ...this.options, ...options };
  }

  public init() {
    if (this.initialized) return;

    SpatialNavigation.init();

    if (this.options.visualDebug) {
      SpatialNavigation.setDebug(true);
    }

    // Configure default behavior
    SpatialNavigation.pause();

    this.initialized = true;
  }

  public registerSection(sectionId: string, container?: HTMLElement) {
    if (!this.initialized) return;

    const config: Record<string, unknown> = {
      selector: '[tabindex="0"]',
    };

    if (container) {
      SpatialNavigation.add(sectionId, config);
      SpatialNavigation.setSectionDefaultElement(sectionId, container);
    } else {
      SpatialNavigation.add(sectionId, config);
    }
  }

  public unregisterSection(sectionId: string) {
    if (!this.initialized) return;
    SpatialNavigation.remove(sectionId);
  }

  public focus(sectionId: string, elementOrSelector?: HTMLElement | string) {
    if (!this.initialized) return;

    try {
      if (elementOrSelector instanceof HTMLElement) {
        elementOrSelector.focus();
        SpatialNavigation.focus(sectionId, elementOrSelector);
      } else if (typeof elementOrSelector === 'string') {
        SpatialNavigation.focus(sectionId, elementOrSelector);
      } else {
        SpatialNavigation.focus(sectionId);
      }
    } catch (error) {
      console.warn('Failed to focus section:', sectionId, error);
    }
  }

  public setDefaultElement(sectionId: string, element: HTMLElement) {
    if (!this.initialized) return;
    try {
      SpatialNavigation.setSectionDefaultElement(sectionId, element);
    } catch (error) {
      console.warn('Failed to set default element:', sectionId, error);
    }
  }

  public enable() {
    if (!this.initialized) return;
    SpatialNavigation.resume();
  }

  public disable() {
    if (!this.initialized) return;
    SpatialNavigation.pause();
  }

  public getCurrentFocused(): HTMLElement | null {
    if (!this.initialized) return null;
    return SpatialNavigation.getCurrentFocusedElement() || null;
  }

  public isInitialized(): boolean {
    return this.initialized;
  }
}

export default SpatialNavigationManager;
export { SECTION_MAIN, SECTION_DIALOG, SECTION_SEARCH };
