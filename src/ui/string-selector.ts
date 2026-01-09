// src/ui/string-selector.ts

export interface StringInfo {
  note: string;
  label: string;
  id: string;
  frequency: number;
  stringNumber: number;
}

export const STANDARD_TUNING: StringInfo[] = [
  { note: 'E2', label: 'Low E', id: 'string-6', frequency: 82.41, stringNumber: 6 },
  { note: 'A2', label: 'A', id: 'string-5', frequency: 110.00, stringNumber: 5 },
  { note: 'D3', label: 'D', id: 'string-4', frequency: 146.83, stringNumber: 4 },
  { note: 'G3', label: 'G', id: 'string-3', frequency: 196.00, stringNumber: 3 },
  { note: 'B3', label: 'B', id: 'string-2', frequency: 246.94, stringNumber: 2 },
  { note: 'E4', label: 'High E', id: 'string-1', frequency: 329.63, stringNumber: 1 },
];

export class StringSelector {
  private container: HTMLElement;
  private selectedString: string | null = null;
  private autoDetectedString: string | null = null;
  private onStringSelect: ((stringId: string | null) => void) | null = null;

  constructor(containerId: string = 'string-selector') {
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

      // Note label (E, A, D, G, B, E)
      const noteLabel = document.createElement('div');
      noteLabel.className = 'string-note';
      noteLabel.textContent = string.note.charAt(0); // Just the letter (E, A, D, etc)

      // String label (Low E, A, D, G, B, High E)
      const stringLabel = document.createElement('div');
      stringLabel.className = 'string-label';
      stringLabel.textContent = string.label;

      button.appendChild(noteLabel);
      button.appendChild(stringLabel);

      // Click handler
      button.addEventListener('click', () => this.handleStringClick(string.id));

      this.container.appendChild(button);
    });

    // Add to DOM
    document.body.appendChild(this.container);
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
