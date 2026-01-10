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

/**
 * Attempt to create AudioWorkletNode with retry logic
 * Retries with exponential backoff if processor is not yet registered
 */
async function createNodeWithRetry(
  context: AudioContext,
  maxAttempts: number = 5,
  initialDelayMs: number = 100
): Promise<TunerWorkletNode> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Calculate delay with exponential backoff
    const delayMs = initialDelayMs * Math.pow(2, attempt - 1); // 100, 200, 400, 800, 1600ms

    if (attempt > 1) {
      console.log(`[worklet.ts] Retry attempt ${attempt}/${maxAttempts} after ${delayMs}ms delay...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    } else {
      console.log('[worklet.ts] Waiting for processor registration to complete...');
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    try {
      console.log(`[worklet.ts] Attempting to create AudioWorkletNode (attempt ${attempt}/${maxAttempts})`);
      const node = new TunerWorkletNode(context);
      console.log('[worklet.ts] AudioWorkletNode created successfully');
      return node;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if it's the "not defined" error
      if (lastError.message.includes('not defined')) {
        console.warn(`[worklet.ts] Processor not yet registered (attempt ${attempt}/${maxAttempts})`);
        // Continue to next attempt
        if (attempt === maxAttempts) {
          // Last attempt failed
          throw new Error(
            `AudioWorklet registration failed after ${maxAttempts} attempts over ${delayMs * 2}ms. ` +
            'The tuner-processor is not defined in AudioWorkletGlobalScope. ' +
            'This usually indicates: (1) Very slow network connection, (2) Browser compatibility issue, ' +
            'or (3) Script loading/parsing failure. Try refreshing the page or using a different browser.'
          );
        }
      } else {
        // Different error, throw immediately
        throw lastError;
      }
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError || new Error('Failed to create AudioWorkletNode for unknown reason');
}

export async function createTunerWorklet(context: AudioContext): Promise<TunerWorkletNode> {
  console.log('[worklet.ts] Loading worklet from:', processorUrl);

  try {
    // Step 1: Load the module
    await context.audioWorklet.addModule(processorUrl);
    console.log('[worklet.ts] Worklet module loaded successfully');

    // Step 2: Create node with retry logic (handles race condition)
    const node = await createNodeWithRetry(context);

    // Step 3: Wait for worklet to confirm it's ready
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
    throw error;
  }
}
