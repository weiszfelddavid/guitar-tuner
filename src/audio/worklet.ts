import processorUrl from './tuner-processor.ts?worker&url';

export class TunerWorkletNode extends AudioWorkletNode {
  constructor(context: AudioContext) {
    super(context, 'tuner-processor');
  }
}

/**
 * Wait for the worklet processor to send its ready signal
 */
function waitForProcessorReady(node: AudioWorkletNode): Promise<void> {
  return new Promise((resolve) => {
    const messageHandler = (event: MessageEvent) => {
      if (event.data.type === 'worklet-ready') {
        node.port.removeEventListener('message', messageHandler);
        resolve();
      }
    };
    node.port.addEventListener('message', messageHandler);
    node.port.start();
  });
}

export async function createTunerWorklet(context: AudioContext): Promise<TunerWorkletNode> {
  // Step 1: Await module registration (deterministic)
  await context.audioWorklet.addModule(processorUrl);

  // Step 2: Create node (this instantiates the processor)
  const node = new TunerWorkletNode(context);

  // Step 3: Wait for processor constructor to send ready signal (deterministic handshake)
  await waitForProcessorReady(node);

  return node;
}
