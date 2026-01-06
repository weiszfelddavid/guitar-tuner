import React from 'react';
import { useParams } from 'react-router-dom';
import { Tuner } from '../components/Tuner';
import { TUNINGS } from '../utils/tunings';

export const TuningPage: React.FC = () => {
  const { instrument, tuning } = useParams();

  // Find the matching tuning from the URL
  const selectedTuning = TUNINGS.find(t => t.instrument === instrument && t.slug === tuning) || TUNINGS[0];

  return (
    <>
      <Tuner 
        tuning={selectedTuning} 
      />
    </>
  );
};