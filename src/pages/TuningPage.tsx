import React from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Tuner } from '../components/Tuner';
import { TUNINGS, noteToFreq } from '../utils/tunings';
import { useTranslation } from '../hooks/useTranslation';

export const TuningPage: React.FC = () => {
  const { lang, instrument, tuning } = useParams();
  const { t } = useTranslation();

  // Find the matching tuning from the URL
  const selectedTuning = TUNINGS.find(t => t.instrument === instrument && t.slug === tuning) || TUNINGS[0];
  const tuningKey = `${selectedTuning.instrument}_${selectedTuning.slug}`;

  // SEO Content Generation
  const pageTitle = t(`tunings.${tuningKey}.seoTitle`);
  const pageDesc = t(`tunings.${tuningKey}.description`);
  const tuningName = t(`tunings.${tuningKey}.name`);

  // --- Dynamic Schema.org Generation ---
  
  // 1. HowTo Schema
  const howToSchema = {
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

  // 2. FAQ Schema
  const notesString = selectedTuning.notes.join(", ");
  const freqString = selectedTuning.notes.map(n => `${n} (${noteToFreq(n).toFixed(1)} Hz)`).join(", ");
  
  const faqSchema = {
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

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <link rel="alternate" hrefLang="en" href={`https://tuner.weiszfeld.com/en/${selectedTuning.instrument}/${selectedTuning.slug}`} />
        <link rel="alternate" hrefLang="es" href={`https://tuner.weiszfeld.com/es/${selectedTuning.instrument}/${selectedTuning.slug}`} />
        <link rel="alternate" hrefLang="fr" href={`https://tuner.weiszfeld.com/fr/${selectedTuning.instrument}/${selectedTuning.slug}`} />
        <link rel="canonical" href={`https://tuner.weiszfeld.com/${lang}/${selectedTuning.instrument}/${selectedTuning.slug}`} />
        
        {/* Inject Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify(howToSchema)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(faqSchema)}
        </script>
      </Helmet>

      <Tuner 
        initialTuning={selectedTuning} 
      />
    </>
  );
};
