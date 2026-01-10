export class MobileDebugOverlay {
  private element: HTMLDivElement;
  private logs: string[] = [];

  constructor() {
    this.element = document.createElement('div');
    this.element.id = 'mobile-debug-overlay';
    this.element.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      max-height: 50%;
      background: rgba(0, 0, 0, 0.95);
      color: white;
      font-family: monospace;
      font-size: 12px;
      padding: 10px;
      z-index: 999999;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-word;
    `;
  }

  show(): void {
    if (!document.body.contains(this.element)) {
      document.body.appendChild(this.element);
    }
  }

  hide(): void {
    if (document.body.contains(this.element)) {
      document.body.removeChild(this.element);
    }
  }

  log(message: string): void {
    this.logs.push(message);
    this.render();
  }

  error(message: string, errorDetails?: string): void {
    const errorMsg = `❌ ERROR: ${message}`;
    this.logs.push(errorMsg);
    if (errorDetails) {
      this.logs.push(`Stack: ${errorDetails}`);
    }
    this.render();
  }

  success(message: string): void {
    this.logs.push(`✅ ${message}`);
    this.render();
  }

  private render(): void {
    this.element.innerHTML = this.logs
      .map((log) => {
        if (log.startsWith('❌')) {
          return `<div style="color: #ff5555; font-weight: bold;">${log}</div>`;
        } else if (log.startsWith('✅')) {
          return `<div style="color: #55ff55;">${log}</div>`;
        } else if (log.startsWith('Stack:')) {
          return `<div style="color: #ff8888; margin-left: 20px; font-size: 10px;">${log}</div>`;
        } else {
          return `<div>${log}</div>`;
        }
      })
      .join('');
    this.element.scrollTop = this.element.scrollHeight;
  }

  clear(): void {
    this.logs = [];
    this.render();
  }
}
