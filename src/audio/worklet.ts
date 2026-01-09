import processorUrl from './tuner-processor.ts?worker&url';

export class TunerWorkletNode extends AudioWorkletNode {
  constructor(context: AudioContext) {
    super(context, 'tuner-processor');
  }
}

export async function createTunerWorklet(context: AudioContext): Promise<TunerWorkletNode> {
  console.log('[worklet.ts] Loading worklet from:', processorUrl);
  try {
    await context.audioWorklet.addModule(processorUrl);
    console.log('[worklet.ts] Worklet module loaded successfully');
  } catch (error) {
    console.error('[worklet.ts] Failed to load worklet module:', error);
    throw error;
  }
  return new TunerWorkletNode(context);
}
