export function initDebugConsole() {
    // Only initialize debug console in development mode
    if (!import.meta.env.DEV) {
        console.log('Production mode - debug console disabled');
        return;
    }

    // Storage key for debug console visibility preference
    const STORAGE_KEY = 'debug-console-visible';
    const isVisible = localStorage.getItem(STORAGE_KEY) === 'true';

    const debugDiv = document.createElement('div');
    debugDiv.id = 'debug-console';
    debugDiv.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 30%; /* Take top 30% */
        background: rgba(0, 0, 0, 0.9);
        color: #0f0;
        font-family: monospace;
        font-size: 12px;
        overflow-y: auto;
        z-index: 10000;
        pointer-events: auto;
        white-space: pre-wrap;
        padding: 5px;
        padding-bottom: 35px; /* Space for buttons */
        display: ${isVisible ? 'block' : 'none'};
        transition: opacity 0.2s;
    `;
    document.body.appendChild(debugDiv);

    const copyBtn = document.createElement('button');
    copyBtn.innerText = 'Copy Logs';
    copyBtn.style.cssText = `
        position: fixed;
        bottom: 5px;
        right: 5px;
        z-index: 10001;
        padding: 5px 10px;
        background: #333;
        color: white;
        border: 1px solid #666;
        cursor: pointer;
        border-radius: 4px;
        font-size: 11px;
        display: ${isVisible ? 'block' : 'none'};
    `;
    copyBtn.onclick = () => {
        const text = debugDiv.innerText;
        navigator.clipboard.writeText(text).then(() => {
            copyBtn.innerText = 'Copied!';
            setTimeout(() => copyBtn.innerText = 'Copy Logs', 2000);
        }).catch(err => {
            console.error('Failed to copy: ', err);
            copyBtn.innerText = 'Error';
        });
    };
    document.body.appendChild(copyBtn);

    // Clear logs button
    const clearBtn = document.createElement('button');
    clearBtn.innerText = 'Clear';
    clearBtn.style.cssText = `
        position: fixed;
        bottom: 5px;
        right: 90px;
        z-index: 10001;
        padding: 5px 10px;
        background: #333;
        color: white;
        border: 1px solid #666;
        cursor: pointer;
        border-radius: 4px;
        font-size: 11px;
        display: ${isVisible ? 'block' : 'none'};
    `;
    clearBtn.onclick = () => {
        debugDiv.innerHTML = '';
        console.log('Debug console cleared');
    };
    document.body.appendChild(clearBtn);

    // Toggle function exposed globally
    (window as any).toggleDebugConsole = () => {
        const isCurrentlyVisible = debugDiv.style.display !== 'none';
        debugDiv.style.display = isCurrentlyVisible ? 'none' : 'block';
        copyBtn.style.display = isCurrentlyVisible ? 'none' : 'block';
        clearBtn.style.display = isCurrentlyVisible ? 'none' : 'block';
        localStorage.setItem(STORAGE_KEY, String(!isCurrentlyVisible));
        return !isCurrentlyVisible;
    };

    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    function logToScreen(type: string, args: any[]) {
        const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
        const line = document.createElement('div');
        line.textContent = `[${type}] ${msg}`;
        if (type === 'ERROR') line.style.color = '#ff5555';
        if (type === 'WARN') line.style.color = '#ffff55';
        debugDiv.appendChild(line);
        debugDiv.scrollTop = debugDiv.scrollHeight;
    }

    console.log = (...args) => { originalLog(...args); logToScreen('LOG', args); };
    console.error = (...args) => { originalError(...args); logToScreen('ERROR', args); };
    console.warn = (...args) => { originalWarn(...args); logToScreen('WARN', args); };

    console.log("Debug Console Initialized");
}
