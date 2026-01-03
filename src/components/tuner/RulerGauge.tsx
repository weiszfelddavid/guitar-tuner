import React from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { type TunerStatus } from './NoteDisplay';

interface RulerGaugeProps { 
  cents: number; 
  status: TunerStatus; 
}

export const RulerGauge: React.FC<RulerGaugeProps> = ({ cents, status }) => {
  const { t } = useTranslation();
  const clampedCents = Math.max(-50, Math.min(50, cents));
  const percent = ((clampedCents + 50) / 100) * 100;
  const isVisible = status === 'detecting' || status === 'locked' || status === 'holding';
  const isHolding = status === 'holding';

  return (
    <div className={`gauge-container ${isVisible ? 'visible' : ''} ${isHolding ? 'holding' : ''}`}>
      <div className="gauge-ruler">
        <div className="tick major" style={{ left: '0%' }}></div>
        <div className="tick minor" style={{ left: '25%' }}></div>
        <div className="tick center" style={{ left: '50%' }}></div>
        <div className="tick minor" style={{ left: '75%' }}></div>
        <div className="tick major" style={{ left: '100%' }}></div>
      </div>
      <div className="gauge-indicator" style={{ left: `${percent}%` }}></div>
      <div className="cents-label">
        {isVisible ? `${cents > 0 ? '+' : ''}${Math.round(cents)} ${t('common.cents_label')}` : ''}
      </div>
    </div>
  );
};
