import processorUrl from './tuner-processor.ts?worker&url';

export class TunerWorkletNode extends AudioWorkletNode {
  constructor(context: AudioContext) {
    super(context, 'tuner-processor');
  }
}

/**
 * Wait for worklet to send ready signal
 * Returns true if ready, false if timeout
 */
function waitForWorkletReady(node: AudioWorkletNode, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let timeoutId: number;

    const messageHandler = (event: MessageEvent) => {
      if (event.data.type === 'worklet-ready') {
        clearTimeout(timeoutId);
        node.port.removeEventListener('message', messageHandler);
        console.log('[worklet.ts] Received worklet-ready signal');
        resolve(true);
      }
    };

    node.port.addEventListener('message', messageHandler);
    node.port.start(); // Important: start the port to receive messages

    // Send initialization check
    console.log('[worklet.ts] Sending check-ready message');
    node.port.postMessage({ type: 'check-ready' });

    // Timeout fallback
    timeoutId = setTimeout(() => {
      node.port.removeEventListener('message', messageHandler);
      console.warn('[worklet.ts] Worklet ready check timed out after', timeoutMs, 'ms');
      resolve(false);
    }, timeoutMs) as unknown as number;
  });
}

export async function createTunerWorklet(context: AudioContext): Promise<TunerWorkletNode> {
  console.log('[worklet.ts] Loading worklet from:', processorUrl);

  try {
    // Step 1: Load the module
    await context.audioWorklet.addModule(processorUrl);
    console.log('[worklet.ts] Worklet module loaded successfully');

    // Step 2: Add small delay to ensure registerProcessor completes
    // This is necessary because addModule() may resolve before registerProcessor() finishes
    console.log('[worklet.ts] Waiting for processor registration to complete...');
    await new Promise(resolve => setTimeout(resolve, 100));

    // Step 3: Attempt to create the node
    console.log('[worklet.ts] Creating AudioWorkletNode');
    const node = new TunerWorkletNode(context);
    console.log('[worklet.ts] AudioWorkletNode created successfully');

    // Step 4: Wait for worklet to confirm it's ready
    console.log('[worklet.ts] Waiting for worklet ready confirmation...');
    const ready = await waitForWorkletReady(node, 5000);

    if (!ready) {
      throw new Error(
        'AudioWorklet failed to initialize within timeout period. ' +
        'The audio processor did not respond to ready check. ' +
        'This may indicate a slow connection or browser compatibility issue.'
      );
    }

    console.log('[worklet.ts] Worklet fully initialized and ready');
    return node;
  } catch (error) {
    console.error('[worklet.ts] Failed to create worklet:', error);

    // Provide specific error message for the common case
    if (error instanceof Error && error.message.includes('not defined')) {
      throw new Error(
        'AudioWorklet registration failed: tuner-processor is not defined in AudioWorkletGlobalScope. ' +
        'This usually happens when the worklet module fails to load or register properly. ' +
        'Possible causes: slow network connection, browser compatibility issues, or script loading errors. ' +
        'Try refreshing the page or using a different browser.'
      );
    }
    throw error;
  }
}
