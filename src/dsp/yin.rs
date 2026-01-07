pub struct Yin {
    threshold: f32,
    sample_rate: f32,
    buffer_size: usize,
    results_buffer: Vec<f32>,
}

impl Yin {
    pub fn new(threshold: f32, sample_rate: f32, buffer_size: usize) -> Self {
        Yin {
            threshold,
            sample_rate,
            buffer_size,
            results_buffer: vec![0.0; buffer_size / 2],
        }
    }

    pub fn get_pitch(&mut self, audio_buffer: &[f32]) -> (f32, f32) {
        let n = self.buffer_size / 2; // Search range (tau max)
        
        // 1. Difference Function
        // We calculate d(tau) for tau = 0 to n
        // d(tau) = sum((x[j] - x[j+tau])^2) for j=0 to n
        
        // Reset results buffer
        for x in self.results_buffer.iter_mut() {
            *x = 0.0;
        }

        // Implementation of Difference Function
        // d(0) is always 0.
        for tau in 1..n {
            let mut diff = 0.0;
            // Ensure we don't go out of bounds of audio_buffer
            // audio_buffer must be size 'buffer_size' (2*n)
            // j goes to n-1. j+tau max is (n-1) + (n-1) = 2n-2 < 2n.
            for j in 0..n {
                let delta = audio_buffer[j] - audio_buffer[j + tau];
                diff += delta * delta;
            }
            self.results_buffer[tau] = diff;
        }

        // 2. Cumulative Mean Normalized Difference function
        let mut running_sum = 0.0;
        self.results_buffer[0] = 1.0;

        for tau in 1..n {
            running_sum += self.results_buffer[tau];
            if running_sum == 0.0 {
                self.results_buffer[tau] = 1.0;
            } else {
                self.results_buffer[tau] *= tau as f32 / running_sum;
            }
        }

        // 3. Absolute Threshold
        let mut tau_estimate = -1;
        
        for tau in 2..n {
            if self.results_buffer[tau] < self.threshold {
                // We found a dip below threshold.
                // We keep searching for the local minimum.
                let mut local_tau = tau;
                while local_tau + 1 < n && self.results_buffer[local_tau + 1] < self.results_buffer[local_tau] {
                    local_tau += 1;
                }
                tau_estimate = local_tau as i32;
                break;
            }
        }

        // If no pitch found under threshold, try to find global minimum
        if tau_estimate == -1 {
            let mut min_val = self.results_buffer[0];
            let mut min_tau = 0;
             for tau in 1..n {
                if self.results_buffer[tau] < min_val {
                    min_val = self.results_buffer[tau];
                    min_tau = tau;
                }
            }
            tau_estimate = min_tau as i32;
        }
        
        let clarity = if tau_estimate >= 0 {
             1.0 - self.results_buffer[tau_estimate as usize]
        } else {
            0.0
        };

        // 4. Parabolic Interpolation
        let final_pitch = if tau_estimate > 0 && (tau_estimate as usize) < n - 1 {
            let tau = tau_estimate as usize;
            let s0 = self.results_buffer[tau - 1];
            let s1 = self.results_buffer[tau];
            let s2 = self.results_buffer[tau + 1];
            
            let adjustment = (s2 - s0) / (2.0 * (2.0 * s1 - s2 - s0));
            let final_tau = tau as f32 + adjustment;
            
            self.sample_rate / final_tau
        } else {
            if tau_estimate > 0 {
                self.sample_rate / (tau_estimate as f32)
            } else {
                0.0
            }
        };
        
        // Prevent infinity or NaN or extremely low frequencies
        if final_pitch.is_nan() || final_pitch.is_infinite() {
             (0.0, 0.0)
        } else {
             (final_pitch, clarity)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f32::consts::PI;

    #[test]
    fn test_sine_wave_440hz() {
        let sample_rate = 44100.0;
        let buffer_size = 2048;
        let mut yin = Yin::new(0.1, sample_rate, buffer_size);
        
        let mut buffer = vec![0.0; buffer_size];
        let frequency = 440.0;
        
        // Fill buffer with sine wave
        for i in 0..buffer_size {
            buffer[i] = (2.0 * PI * frequency * (i as f32) / sample_rate).sin();
        }
        
        let (pitch, clarity) = yin.get_pitch(&buffer);
        
        println!("Detected: {}, Clarity: {}", pitch, clarity);
        assert!((pitch - frequency).abs() < 1.0, "Pitch {} should be close to 440Hz", pitch);
        assert!(clarity > 0.9, "Clarity {} should be high", clarity);
    }

    #[test]
    fn test_sine_wave_82hz() {
        let sample_rate = 48000.0; // Standard for our spec
        let buffer_size = 4096; // Larger buffer for low E
        let mut yin = Yin::new(0.1, sample_rate, buffer_size);
        
        let mut buffer = vec![0.0; buffer_size];
        let frequency = 82.41; // Low E
        
        for i in 0..buffer_size {
            buffer[i] = (2.0 * PI * frequency * (i as f32) / sample_rate).sin();
        }
        
        let (pitch, clarity) = yin.get_pitch(&buffer);
        
        println!("Detected: {}, Clarity: {}", pitch, clarity);
        assert!((pitch - frequency).abs() < 0.5, "Pitch {} should be close to 82.41Hz", pitch);
    }
}