# 🎸 Pro Tuner (v2.0)

**Architecture:** React + AudioWorklet + YIN.
**Strict Types:** Yes.
**Test Coverage:** Mandatory for DSP engine.

## Quick Start
1. `npm install`
2. `npm run test:unit` (Validates math)
3. `npm run dev` (Starts UI)

## The Engine
Pitch detection happens in `src/audio/processor.ts`. Do not edit the algorithm constants without adding a regression test case.
