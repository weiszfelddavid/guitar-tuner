use wasm_bindgen::prelude::*;
mod yin;
use yin::Yin;

#[wasm_bindgen]
pub struct TunerResult {
    pub pitch: f32,
    pub clarity: f32,
}

#[wasm_bindgen]
pub struct PitchDetector {
    yin: Yin,
}

#[wasm_bindgen]
impl PitchDetector {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f32, buffer_size: usize) -> PitchDetector {
        // Threshold 0.10 is standard for YIN
        PitchDetector {
            yin: Yin::new(0.10, sample_rate, buffer_size),
        }
    }

    pub fn process(&mut self, buffer: &[f32]) -> TunerResult {
        // Ensure buffer is sufficient size, otherwise return 0
        // (In a real scenario we might buffer internally, but here we assume the JS side handles buffering)
        let (pitch, clarity) = self.yin.get_pitch(buffer);
        TunerResult { pitch, clarity }
    }
}
