class PitchProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
  }

  process(inputs, outputs, parameters) {
    return true;
  }
}

registerProcessor('pitch-processor', PitchProcessor);
