import { type Tuning, noteToFreq } from './tunings';

export const generateHowToSchema = (tuningName: string, lang: string, selectedTuning: Tuning, t: (key: string) => string) => {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": `${t('footer.pro_tips_title')} ${tuningName}`,
    "step": [
      {
        "@type": "HowToStep",
        "name": t('footer.step_mic'),
        "text": t('footer.step_mic_desc'),
        "url": `https://tuner.weiszfeld.com/${lang}/${selectedTuning.instrument}/${selectedTuning.slug}#step1`
      },
      {
        "@type": "HowToStep",
        "name": t('footer.step_inst'),
        "text": `${t('footer.step_inst_desc_prefix')} "${tuningName}" ${t('footer.step_inst_desc_suffix')}`,
        "url": `https://tuner.weiszfeld.com/${lang}/${selectedTuning.instrument}/${selectedTuning.slug}#step2`
      },
      {
        "@type": "HowToStep",
        "name": t('footer.step_pluck'),
        "text": t('footer.step_pluck_desc'),
        "url": `https://tuner.weiszfeld.com/${lang}/${selectedTuning.instrument}/${selectedTuning.slug}#step3`
      },
      {
        "@type": "HowToStep",
        "name": t('footer.step_needle'),
        "text": `${t('footer.step_needle_flat')} / ${t('footer.step_needle_sharp')}`,
        "url": `https://tuner.weiszfeld.com/${lang}/${selectedTuning.instrument}/${selectedTuning.slug}#step4`
      }
    ]
  };
};

export const generateFAQSchema = (tuningName: string, selectedTuning: Tuning, t: (key: string) => string) => {
  const notesString = selectedTuning.notes.join(", ");
  const freqString = selectedTuning.notes.map(n => `${n} (${noteToFreq(n).toFixed(1)} Hz)`).join(", ");
  
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": `${t('footer.frequencies_title')} ${tuningName}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `${t('footer.frequencies_ref')} ${tuningName} ${t('footer.strings')}: ${freqString}.`
        }
      },
      {
        "@type": "Question",
        "name": `What are the notes for ${tuningName}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `The notes for ${tuningName} are ${notesString}.`
        }
      }
    ]
  };
};
