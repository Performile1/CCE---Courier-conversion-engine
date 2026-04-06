

import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
import { supabaseInitializationError } from './services/supabaseClient';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = createRoot(rootElement);

const MissingConfigScreen = () => (
  <div style={{
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px',
    background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 45%, #ffffff 100%)',
    color: '#431407',
    fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif'
  }}>
    <div style={{
      width: '100%',
      maxWidth: '720px',
      borderRadius: '24px',
      padding: '32px',
      backgroundColor: 'rgba(255, 255, 255, 0.92)',
      boxShadow: '0 24px 80px rgba(154, 52, 18, 0.18)',
      border: '1px solid rgba(154, 52, 18, 0.12)'
    }}>
      <p style={{ margin: '0 0 8px', fontSize: '12px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#9a3412' }}>
        Local setup required
      </p>
      <h1 style={{ margin: '0 0 12px', fontSize: '36px', lineHeight: 1.1 }}>
        Supabase is not configured for this Vite session.
      </h1>
      <p style={{ margin: '0 0 20px', fontSize: '18px', lineHeight: 1.6 }}>
        The app was previously rendering a blank page because startup failed before React could mount. Add the missing environment variables and reload the dev server.
      </p>
      <div style={{ marginBottom: '20px', padding: '16px 18px', borderRadius: '16px', backgroundColor: '#fff7ed', border: '1px solid rgba(154, 52, 18, 0.14)' }}>
        <div style={{ fontWeight: 700, marginBottom: '8px' }}>Required variables</div>
        <div>VITE_SUPABASE_URL</div>
        <div>VITE_SUPABASE_ANON_KEY</div>
      </div>
      <pre style={{
        margin: 0,
        padding: '16px 18px',
        overflowX: 'auto',
        borderRadius: '16px',
        backgroundColor: '#1c1917',
        color: '#fed7aa',
        fontSize: '14px',
        lineHeight: 1.6
      }}>{`# .env.local\nVITE_SUPABASE_URL=...\nVITE_SUPABASE_ANON_KEY=...`}</pre>
      <p style={{ margin: '20px 0 0', fontSize: '14px', color: '#7c2d12' }}>
        {supabaseInitializationError?.message}
      </p>
    </div>
  </div>
);

root.render(
  <React.StrictMode>
    {supabaseInitializationError ? <MissingConfigScreen /> : <App />}
  </React.StrictMode>
);