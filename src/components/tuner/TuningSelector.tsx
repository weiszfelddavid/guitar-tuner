import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { TUNINGS, type Tuning } from '../../utils/tunings';
import { useTranslation } from '../../hooks/useTranslation';

interface TuningSelectorProps {
  selected: Tuning;
  onActivate: () => void;
}

export const TuningSelector: React.FC<TuningSelectorProps> = ({ selected, onActivate }) => {
  const { t } = useTranslation();
  const { lang } = useParams();
  const instrumentRowRef = useRef<HTMLDivElement>(null);
  const tuningRowRef = useRef<HTMLDivElement>(null);

  const instruments = useMemo(() => {
    return Array.from(new Set(TUNINGS.map(t => t.instrument)));
  }, []);

  const currentInstrumentTunings = useMemo(() => {
    return TUNINGS.filter(tuning => tuning.instrument === selected.instrument);
  }, [selected.instrument]);

  useEffect(() => {
    // Scoped search using refs to avoid global DOM queries
    const scrollOptions: ScrollIntoViewOptions = { behavior: 'smooth', block: 'nearest', inline: 'center' };
    instrumentRowRef.current?.querySelector('.active')?.scrollIntoView(scrollOptions);
    tuningRowRef.current?.querySelector('.active')?.scrollIntoView(scrollOptions);
  }, [selected]);

  return (
    <div className="tuning-control-panel">
      <div className="instrument-row" ref={instrumentRowRef}>
        {instruments.map(inst => {
          const firstTuning = TUNINGS.find(tuning => tuning.instrument === inst);
          return (
            <Link
              key={inst}
              to={`/${lang}/${inst}/${firstTuning?.slug || 'standard'}`}
              onClick={onActivate}
              className={`pill instrument-pill ${selected.instrument === inst ? 'active' : ''}`}
            >
              {inst.charAt(0).toUpperCase() + inst.slice(1).toLowerCase()}
            </Link>
          );
        })}
      </div>

      <div className="tuning-row" ref={tuningRowRef}>
        {currentInstrumentTunings.map(tData => (
          <Link 
            key={`${tData.instrument}-${tData.slug}`}
            to={`/${lang}/${tData.instrument}/${tData.slug}`}
            onClick={onActivate}
            className={`pill tuning-pill ${selected.slug === tData.slug ? 'active' : ''}`}
          >
            {t(`tunings.${tData.instrument}_${tData.slug}.name`, tData.name).replace(/.*\((.*)\)/, '$1')} 
          </Link>
        ))}
      </div>
    </div>
  );
};
