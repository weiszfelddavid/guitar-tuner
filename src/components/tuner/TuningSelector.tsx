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
  const tuningRowRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  const instruments = useMemo(() => {
    return Array.from(new Set(TUNINGS.map(t => t.instrument)));
  }, []);

  const currentInstrumentTunings = useMemo(() => {
    return TUNINGS.filter(tuning => tuning.instrument === selected.instrument);
  }, [selected.instrument]);
  
  useEffect(() => {
    const checkOverflow = () => {
      const el = tuningRowRef.current;
      if (el) {
        setIsOverflowing(el.scrollWidth > el.clientWidth);
      }
    };
    
    // Check initially and on resize
    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    
    // Also re-check after tunings change and render, with a small delay
    const timeoutId = setTimeout(checkOverflow, 50);

    return () => {
      window.removeEventListener('resize', checkOverflow);
      clearTimeout(timeoutId);
    };
  }, [currentInstrumentTunings]);


  return (
    <div className="tuning-control-panel">
      <div className="instrument-row">
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

      <div className={`tuning-row-mask ${isOverflowing ? 'is-overflowing' : ''}`}>
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
    </div>
  );
};
