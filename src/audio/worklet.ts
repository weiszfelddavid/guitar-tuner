import processorUrl from './tuner-processor.ts?worker&url';

export class TunerWorkletNode extends AudioWorkletNode {
  constructor(context: AudioContext) {
    super(context, 'tuner-processor');
  }
}

export async function createTunerWorklet(context: AudioContext): Promise<TunerWorkletNode> {
  await context.audioWorklet.addModule(processorUrl);
  await new Promise(resolve => setTimeout(resolve, 500));
  const node = new TunerWorkletNode(context);
  return node;
}
