import React from 'react';
import { useParams } from 'react-router-dom';
import { Tuner } from '../components/Tuner';
import { TUNINGS } from '../utils/tunings';
import { useTranslation } from '../hooks/useTranslation';
import { generateHowToSchema, generateFAQSchema } from '../utils/seo';

export const TuningPage: React.FC = () => {
  const { lang = 'en', instrument, tuning } = useParams();
  const { t } = useTranslation();

  // Find the matching tuning from the URL
  const selectedTuning = TUNINGS.find(t => t.instrument === instrument && t.slug === tuning) || TUNINGS[0];
  const tuningKey = `${selectedTuning.instrument}_${selectedTuning.slug}`;

  // SEO Content Generation
  const pageTitle = t(`tunings.${tuningKey}.seoTitle`);
  const pageDesc = t(`tunings.${tuningKey}.description`);
  const tuningName = t(`tunings.${tuningKey}.name`);

  // Schema Generators
  const howToSchema = generateHowToSchema(tuningName, lang, selectedTuning, t);
  const faqSchema = generateFAQSchema(tuningName, selectedTuning, t);

  return (
    <>
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

      <Tuner 
        tuning={selectedTuning} 
      />
    </>
  );
};