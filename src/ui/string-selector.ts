// src/ui/string-selector.ts

import { GUITAR_STRINGS, type GuitarString } from '../constants/guitar-strings';

// Re-export type for backward compatibility
export type StringInfo = GuitarString;

// Re-export constant with legacy name for backward compatibility
export const STANDARD_TUNING = GUITAR_STRINGS;

export class StringSelector {
  private container: HTMLElement;
  private selectedString: string | null = null;
  private autoDetectedString: string | null = null;
  private onStringSelect: ((stringId: string | null) => void) | null = null;

  constructor(containerId: string = 'string-selector', parent: HTMLElement = document.body) {
    // Create container
    this.container = document.createElement('div');
    this.container.id = containerId;
    this.container.className = 'string-selector';

    // Build the string buttons
    STANDARD_TUNING.forEach(string => {
      const button = document.createElement('button');
      button.className = 'string-button';
      button.id = string.id;
      button.dataset.stringId = string.id;

      // Single label: Note + Hint (e.g., E (low), A, D, G, B, E (high))
      const fullLabel = document.createElement('div');
      fullLabel.className = 'string-full-label';
      
      const noteLetter = string.note.charAt(0);
      let displayHint = '';
      if (string.label.toLowerCase().includes('low')) displayHint = ' (low)';
      if (string.label.toLowerCase().includes('high')) displayHint = ' (high)';
      
      fullLabel.textContent = `${noteLetter}${displayHint}`;

      button.appendChild(fullLabel);

      // Click handler
      button.addEventListener('click', () => this.handleStringClick(string.id));

      this.container.appendChild(button);
    });

    // Add to DOM
    parent.appendChild(this.container);
  }

  private handleStringClick(stringId: string) {
    // Toggle selection: click again to deselect
    if (this.selectedString === stringId) {
      this.selectedString = null;
    } else {
      this.selectedString = stringId;
    }

    this.updateUI();

    // Notify listener
    if (this.onStringSelect) {
      this.onStringSelect(this.selectedString);
    }
  }

  /**
   * Set which string is currently detected by the tuner
   */
  public setAutoDetectedString(noteName: string | null) {
    if (noteName === '--' || !noteName) {
      this.autoDetectedString = null;
    } else {
      // Find matching string by note name
      const matchedString = STANDARD_TUNING.find(s => s.note === noteName);
      this.autoDetectedString = matchedString ? matchedString.id : null;
    }
    this.updateUI();
  }

  /**
   * Get the currently selected string (manual lock)
   */
  public getSelectedString(): StringInfo | null {
    if (!this.selectedString) return null;
    return STANDARD_TUNING.find(s => s.id === this.selectedString) || null;
  }

  /**
   * Register callback for when user selects a string
   */
  public onSelect(callback: (stringId: string | null) => void) {
    this.onStringSelect = callback;
  }

  /**
   * Update visual state of all buttons
   */
  private updateUI() {
    STANDARD_TUNING.forEach(string => {
      const button = document.getElementById(string.id);
      if (!button) return;

      // Remove all state classes
      button.classList.remove('active', 'detected');

      // Apply appropriate state
      if (this.selectedString === string.id) {
        // Manual selection takes priority
        button.classList.add('active');
      } else if (this.autoDetectedString === string.id && !this.selectedString) {
        // Show auto-detected only if nothing is manually selected
        button.classList.add('detected');
      }
    });
  }

  /**
   * Remove the component from DOM
   */
  public destroy() {
    this.container.remove();
  }
}
