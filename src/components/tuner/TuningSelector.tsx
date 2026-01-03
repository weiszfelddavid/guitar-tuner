import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { TUNINGS, type Tuning } from '../../utils/tunings';
import { useTranslation } from '../../hooks/useTranslation';

export const TuningSelector: React.FC<{ selected: Tuning }> = ({ selected }) => {
  const { t } = useTranslation();
  const { lang } = useParams();

  const instruments = useMemo(() => {
    return Array.from(new Set(TUNINGS.map(t => t.instrument)));
  }, []);

  const currentInstrumentTunings = useMemo(() => {
    return TUNINGS.filter(tuning => tuning.instrument === selected.instrument);
  }, [selected.instrument]);

  return (
    <div className="tuning-control-panel">
      <div className="instrument-row">
        {instruments.map(inst => {
          const firstTuning = TUNINGS.find(tuning => tuning.instrument === inst);
          return (
            <Link
              key={inst}
              to={`/${lang}/${inst}/${firstTuning?.slug || 'standard'}`}
              className={`pill instrument-pill ${selected.instrument === inst ? 'active' : ''}`}
            >
              {inst.charAt(0).toUpperCase() + inst.slice(1).toLowerCase()}
            </Link>
          );
        })}
      </div>

      <div className="tuning-row-mask">
        <div className="tuning-row">
          {currentInstrumentTunings.map(tData => (
            <Link 
              key={`${tData.instrument}-${tData.slug}`}
              to={`/${lang}/${tData.instrument}/${tData.slug}`}
              className={`pill tuning-pill ${selected.slug === tData.slug ? 'active' : ''}`}
            >
              {t(`tunings.${tData.instrument}_${tData.slug}.name`, tData.name).replace(/.*\((.*)\)/, '$1')} 
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};
