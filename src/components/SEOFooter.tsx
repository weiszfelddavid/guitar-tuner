import React from 'react';
import './SEOFooter.css';
import { type Tuning, noteToFreq } from '../utils/tunings';
import { useTranslation } from '../hooks/useTranslation';

interface SEOFooterProps {
  tuning: Tuning;
}

export const SEOFooter: React.FC<SEOFooterProps> = ({ tuning }) => {
  const { t } = useTranslation();
  
  const instrumentKey = tuning.instrument;
  const tuningKey = `${tuning.instrument}_${tuning.slug}`;

  // Localized Tuning Info
  const seoTitle = t(`tunings.${tuningKey}.seoTitle`);
  const description = t(`tunings.${tuningKey}.description`);
  const tuningName = t(`tunings.${tuningKey}.name`);
  
  // Localized Instrument Info
  const instTitle = t(`instruments.${instrumentKey}.title`);
  const instDesc = t(`instruments.${instrumentKey}.desc`);
  const instTips = t(`instruments.${instrumentKey}.tips`);

  return (
    <article className="seo-content">
      <section className="seo-section">
        <h1>{seoTitle}</h1>
        <p>
          {description} {instDesc}
        </p>
      </section>

      <section className="seo-section">
        <h2>{tuningName} {t('footer.frequencies_title')}</h2>
        <p>
          {t('footer.frequencies_ref')} <strong>{tuningName}</strong> {t('footer.strings')}:
        </p>
        <table className="freq-table">
          <thead>
            <tr>
              <th>{t('footer.table_string')}</th>
              <th>{t('footer.table_note')}</th>
              <th>{t('footer.table_freq')}</th>
            </tr>
          </thead>
          <tbody>
            {[...tuning.notes].reverse().map((note, index) => (
              <tr key={`${tuning.slug}-${note}-${index}`}>
                <td>{tuning.notes.length - index}</td>
                <td>{note}</td>
                <td>{noteToFreq(note).toFixed(2)} Hz</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="seo-section">
        <h2>{t('footer.pro_tips_title')} {tuningName}</h2>
        <p>{instTips}</p>
        <ol className="tuning-steps">
          <li><strong>{t('footer.step_mic')}:</strong> {t('footer.step_mic_desc')}</li>
          <li><strong>{t('footer.step_inst')}:</strong> {t('footer.step_inst_desc_prefix')} "{tuningName}" {t('footer.step_inst_desc_suffix')}</li>
          <li><strong>{t('footer.step_pluck')}:</strong> {t('footer.step_pluck_desc')}</li>
          <li><strong>{t('footer.step_needle')}:</strong>
            <ul>
              <li><strong>{t('common.flat')}:</strong> {t('footer.step_needle_flat')}</li>
              <li><strong>{t('common.sharp')}:</strong> {t('footer.step_needle_sharp')}</li>
            </ul>
          </li>
          <li><strong>{t('footer.step_diamond')}:</strong> {t('footer.step_diamond_desc')}</li>
        </ol>
      </section>
    </article>
  );
};