import React from 'react';
import { Outlet, useParams, Link } from 'react-router-dom';
import { SEOFooter } from '../components/SEOFooter';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { APP_VERSION } from '../version';
import { TUNINGS } from '../utils/tunings';

export const MainLayout: React.FC = () => {
  const { instrument, tuning } = useParams();
  
  // Find current tuning for SEO footer, default to standard guitar
  const currentTuning = TUNINGS.find(t => t.instrument === instrument && t.slug === tuning) || TUNINGS[0];

  return (
    <div className="App">
      <main className="tuner-interface">
        <Outlet />
        
        <SEOFooter tuning={currentTuning} />

        <div className="footer-controls">
          <Link to="/technical-overview" style={{ 
            color: '#666', 
            textDecoration: 'none', 
            fontSize: '0.8rem', 
            marginBottom: '1rem',
            borderBottom: '1px dotted #444'
          }}>
            Technical Overview
          </Link>
          <LanguageSwitcher />
          <div className="version-footer">
            {APP_VERSION}
          </div>
        </div>
      </main>
    </div>
  );
};
