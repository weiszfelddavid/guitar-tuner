import React from 'react';
import { Outlet, useParams, Link } from 'react-router-dom';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { APP_VERSION } from '../version';
import { TUNINGS } from '../utils/tunings';

export const MainLayout: React.FC = () => {
  return (
    <div className="App">
      <main className="tuner-interface">
        <Outlet />
        

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
