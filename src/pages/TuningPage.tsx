import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Tuner } from '../components/Tuner';
import { TUNINGS, type Tuning } from '../utils/tunings';

export const TuningPage: React.FC = () => {
  const { lang, instrument, tuning } = useParams();
  const navigate = useNavigate();

  // Find the matching tuning from the URL
  const selectedTuning = TUNINGS.find(t => t.instrument === instrument && t.slug === tuning) || TUNINGS[0];

  // Logic to handle tuning changes via chips (update URL)
  const handleTuningChange = (t: Tuning) => {
    navigate(`/${lang}/${t.instrument}/${t.slug}`);
  };

  // SEO Content Generation (Phase 1 basic version)
  const pageTitle = `${selectedTuning.name} Online Tuner | Precision Microphone`;
  const pageDesc = `Tune your ${selectedTuning.name} instantly using your microphone. Accurate, free, and pro-grade.`;

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <link rel="alternate" hrefLang="en" href={`https://tuner.weiszfeld.com/en/${selectedTuning.instrument}/${selectedTuning.slug}`} />
        <link rel="alternate" hrefLang="es" href={`https://tuner.weiszfeld.com/es/${selectedTuning.instrument}/${selectedTuning.slug}`} />
        <link rel="alternate" hrefLang="fr" href={`https://tuner.weiszfeld.com/fr/${selectedTuning.instrument}/${selectedTuning.slug}`} />
        <link rel="canonical" href={`https://tuner.weiszfeld.com/${lang}/${selectedTuning.instrument}/${selectedTuning.slug}`} />
      </Helmet>

      <Tuner 
        initialTuning={selectedTuning} 
        onTuningChange={handleTuningChange}
      />
    </>
  );
};