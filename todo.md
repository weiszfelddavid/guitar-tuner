# Pro-Guitar Tuner Roadmap

## 1. Visual Interface Polish
**Goal:** Enhance the visual gauge to provide more precise and readable feedback, mimicking professional hardware tuners.

### Info Display
- [x] **Frequency (Hz) Readout:** Display the exact detected frequency (e.g., "110.2 Hz") alongside the note name and cents. This is critical for intonation work.
- [x] **String Number:** Display the detected string number (e.g., "5th String") to help beginners confirm they are tuning the correct peg.

## 2. Essential Tuner Functionality
**Goal:** Add standard features expected in a guitar tuner application.

### Controls & Settings
- [ ] **Manual String Selection:** Add clickable string buttons (E, A, D, G, B, e) to "lock" the tuner to a specific string. This prevents the tuner from jumping to the wrong octave or note when a string is very loose (e.g., during restringing).
- [ ] **Reference Pitch:** Add ability to adjust the reference pitch (A4) away from 440Hz (e.g., 432Hz, 442Hz), commonly used in orchestral or period settings.
- [ ] **Alternate Tunings:** Add support for common alternate tunings (Drop D, Open G, DADGAD) selectable via a menu.

### Technical
- [ ] **Plumbing:** Update `TunerState` to pass the raw frequency from the audio processor to the UI renderer.