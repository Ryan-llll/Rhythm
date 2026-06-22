import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Sparkles, Mail, Lock, Loader, Download, ArrowRight } from 'lucide-react';

interface LandingPageProps {
  onContinueOffline: () => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onContinueOffline,
  theme,
  toggleTheme,
}) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        
        if (data.user && data.session === null) {
          setSuccessMsg('Account created! Please check your email for a verification link.');
        } else {
          setSuccessMsg('Account created successfully! Logging you in...');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  // Generate mock heatmap data for decoration (7 rows, 30 columns)
  const renderMockHeatmap = () => {
    const rows = 7;
    const cols = 28;
    const cells = [];
    for (let r = 0; r < rows; r++) {
      const rowCells = [];
      for (let c = 0; c < cols; c++) {
        // Random intensity (0 to 4)
        const intensity = Math.random() > 0.6 ? Math.floor(Math.random() * 4) + 1 : 0;
        rowCells.push(intensity);
      }
      cells.push(rowCells);
    }

    return (
      <div className="mock-heatmap">
        {cells.map((row, rIdx) => (
          <div key={rIdx} className="mock-heatmap-row">
            {row.map((intensity, cIdx) => (
              <div
                key={cIdx}
                className={`mock-cell intensity-${intensity}`}
                style={{
                  animationDelay: `${(rIdx + cIdx) * 0.05}s`
                }}
              />
            ))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="landing-container">
      {/* Top Navbar */}
      <header className="landing-navbar fade-in">
        <div className="landing-logo font-mono">
          <Sparkles size={24} className="logo-sparkle animate-pulse" />
          <span>Rhythm</span>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          className="navbar-theme-btn"
          title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
        >
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>
      </header>

      {/* Hero Body */}
      <main className="landing-hero">
        {/* Left Side: Brand Details */}
        <div className="hero-info slide-up">
          <div className="badge-wrapper">
            <span className="badge-new font-mono">PHASE 4 RELEASE</span>
          </div>
          
          <h1 className="hero-title">
            The developer-centric <span className="text-glow">habit tracker</span> built for consistency.
          </h1>
          
          <p className="hero-description">
            Rhythm integrates GitHub-style contribution heatmaps, streaks, and multi-slot tracking into a minimal workspace. Fully cloud-synced or 100% offline.
          </p>

          {/* Interactive Heatmap Preview */}
          <div className="preview-container">
            <div className="preview-header">
              <span className="preview-title font-mono">contribution_grid.json</span>
              <div className="preview-dots">
                <span className="dot red"></span>
                <span className="dot yellow"></span>
                <span className="dot green"></span>
              </div>
            </div>
            {renderMockHeatmap()}
          </div>

          {/* Action CTAs */}
          <div className="hero-actions">
            <a href="/rhythm.apk" className="btn btn-primary download-btn font-mono">
              <Download size={16} />
              <span>Download Android APK</span>
            </a>
            
            <button onClick={onContinueOffline} className="btn btn-outline web-btn font-mono">
              <span>Open Offline Guest Mode</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {/* Right Side: Animated Authentication Box */}
        <div className="hero-auth slide-up-delayed">
          <div className="auth-card-glowing">
            <div className="auth-card-header">
              <span className="auth-card-subtitle font-mono">sync_state: idle</span>
              <h3 className="auth-card-title">{isSignUp ? 'Create Cloud Profile' : 'Access Cloud Database'}</h3>
            </div>

            <div className="auth-tabs">
              <button
                type="button"
                className={`auth-tab-btn ${!isSignUp ? 'active' : ''}`}
                onClick={() => {
                  setIsSignUp(false);
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`auth-tab-btn ${isSignUp ? 'active' : ''}`}
                onClick={() => {
                  setIsSignUp(true);
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
              >
                Register
              </button>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              {errorMsg && (
                <div className="auth-alert error font-mono">
                  {errorMsg}
                </div>
              )}
              
              {successMsg && (
                <div className="auth-alert success font-mono">
                  {successMsg}
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="landing-email">Email Address</label>
                <div className="input-icon-wrapper">
                  <Mail size={16} className="input-icon" />
                  <input
                    type="email"
                    id="landing-email"
                    className="form-input with-icon"
                    placeholder="developer@rhythm.dev"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="landing-password">Password</label>
                <div className="input-icon-wrapper">
                  <Lock size={16} className="input-icon" />
                  <input
                    type="password"
                    id="landing-password"
                    className="form-input with-icon"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary auth-submit-btn font-mono"
                disabled={loading}
              >
                {loading ? (
                  <Loader size={16} className="spinner" />
                ) : isSignUp ? (
                  'Create Account'
                ) : (
                  'Connect Database'
                )}
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* Styled JSX Styles */}
      <style>{`
        .landing-container {
          min-height: 100vh;
          width: 100vw;
          background-color: var(--bg-color);
          color: var(--text-primary);
          display: flex;
          flex-direction: column;
          font-family: var(--font-sans);
          overflow-x: hidden;
          transition: background-color var(--transition-normal);
        }

        /* Navbar */
        .landing-navbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px 48px;
          border-bottom: 1px solid var(--card-border);
          width: 100%;
          max-width: 1400px;
          margin: 0 auto;
        }
        .landing-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 1.6rem;
          font-weight: 700;
          color: var(--text-primary);
        }
        .logo-sparkle {
          color: var(--accent-color);
        }
        .navbar-theme-btn {
          background: transparent;
          border: 1px solid var(--card-border);
          border-radius: 6px;
          padding: 8px 16px;
          color: var(--text-secondary);
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .navbar-theme-btn:hover {
          color: var(--text-primary);
          background-color: var(--input-bg);
          border-color: var(--text-muted);
        }

        /* Hero Layout */
        .landing-hero {
          flex: 1;
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          align-items: center;
          gap: 64px;
          padding: 48px;
          width: 100%;
          max-width: 1400px;
          margin: 0 auto;
        }

        /* Hero Left info */
        .hero-info {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .badge-wrapper {
          display: flex;
        }
        .badge-new {
          background-color: var(--accent-muted);
          color: var(--accent-color);
          border: 1px solid var(--accent-color);
          padding: 4px 12px;
          border-radius: 9999px;
          font-size: 0.72rem;
          font-weight: bold;
          letter-spacing: 0.05em;
        }
        .hero-title {
          font-size: 3rem;
          font-weight: 800;
          line-height: 1.15;
          letter-spacing: -0.02em;
          color: var(--text-primary);
        }
        .text-glow {
          color: var(--accent-color);
          text-shadow: 0 0 20px rgba(216, 195, 165, 0.2);
        }
        .hero-description {
          font-size: 1.1rem;
          line-height: 1.6;
          color: var(--text-secondary);
          max-width: 600px;
        }

        /* Interactive Heatmap Preview */
        .preview-container {
          background-color: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 12px;
          padding: 20px;
          margin-top: 12px;
          box-shadow: var(--shadow-md);
        }
        .preview-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .preview-title {
          font-size: 0.75rem;
          color: var(--text-muted);
        }
        .preview-dots {
          display: flex;
          gap: 6px;
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .dot.red { background-color: #f87171; }
        .dot.yellow { background-color: #fb923c; }
        .dot.green { background-color: #4ade80; }

        .mock-heatmap {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .mock-heatmap-row {
          display: flex;
          gap: 4px;
        }
        .mock-cell {
          flex: 1;
          aspect-ratio: 1;
          border-radius: 2px;
          background-color: var(--card-border);
          transition: background-color 0.2s ease, transform 0.2s ease;
          animation: slideInCell 0.5s ease forwards;
          opacity: 0;
        }
        .mock-cell:hover {
          transform: scale(1.3);
          z-index: 10;
        }
        .mock-cell.intensity-0 { background-color: var(--card-border); }
        .mock-cell.intensity-1 { background-color: color-mix(in srgb, var(--accent-color) 25%, transparent); }
        .mock-cell.intensity-2 { background-color: color-mix(in srgb, var(--accent-color) 50%, transparent); }
        .mock-cell.intensity-3 { background-color: color-mix(in srgb, var(--accent-color) 75%, transparent); }
        .mock-cell.intensity-4 { background-color: var(--accent-color); }

        @keyframes slideInCell {
          from {
            opacity: 0;
            transform: scale(0.6);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        /* CTA buttons */
        .hero-actions {
          display: flex;
          gap: 16px;
          margin-top: 12px;
        }
        .download-btn {
          flex-direction: row;
          align-items: center;
          gap: 8px;
          background-color: var(--accent-color);
          color: #18181b;
          font-weight: bold;
          box-shadow: 0 4px 14px rgba(216, 195, 165, 0.4);
          animation: floatAnimation 3s ease-in-out infinite;
        }
        @keyframes floatAnimation {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
          100% { transform: translateY(0px); }
        }
        .download-btn:hover {
          background-color: var(--accent-hover);
        }
        .web-btn {
          border-color: var(--card-border);
          color: var(--text-secondary);
          align-items: center;
          gap: 8px;
        }
        .web-btn:hover {
          background-color: var(--input-bg);
          color: var(--text-primary);
          border-color: var(--text-muted);
        }

        /* Right Side: Auth Card */
        .hero-auth {
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .auth-card-glowing {
          width: 100%;
          max-width: 420px;
          background-color: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 16px;
          padding: 32px;
          box-shadow: var(--shadow-lg), 0 0 40px rgba(216, 195, 165, 0.03);
          display: flex;
          flex-direction: column;
          gap: 24px;
          position: relative;
        }
        .auth-card-glowing::after {
          content: '';
          position: absolute;
          inset: -1px;
          border-radius: 16px;
          padding: 1px;
          background: linear-gradient(135deg, var(--accent-color), transparent 60%);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }

        .auth-card-header {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .auth-card-subtitle {
          font-size: 0.75rem;
          color: var(--text-muted);
        }
        .auth-card-title {
          font-size: 1.4rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        /* Tab switch */
        .auth-tabs {
          display: flex;
          background-color: var(--input-bg);
          border: 1px solid var(--input-border);
          border-radius: var(--border-radius);
          padding: 3px;
        }
        .auth-tab-btn {
          flex: 1;
          background: transparent;
          border: none;
          padding: 10px;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-secondary);
          cursor: pointer;
          border-radius: 6px;
          transition: all var(--transition-fast);
        }
        .auth-tab-btn:hover {
          color: var(--text-primary);
        }
        .auth-tab-btn.active {
          background-color: var(--card-border);
          color: var(--accent-color);
        }

        /* Auth Form */
        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .input-icon-wrapper {
          position: relative;
        }
        .input-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          pointer-events: none;
        }
        .form-input.with-icon {
          padding-left: 38px;
        }
        .auth-submit-btn {
          margin-top: 8px;
          padding: 12px;
          font-weight: 600;
          font-size: 0.95rem;
          background-color: var(--accent-color);
          color: #18181b;
        }
        .auth-submit-btn:hover {
          background-color: var(--accent-hover);
        }

        .auth-alert {
          padding: 10px 14px;
          border-radius: 6px;
          font-size: 0.78rem;
          line-height: 1.4;
          border: 1px solid transparent;
        }
        .auth-alert.error {
          background-color: rgba(248, 113, 113, 0.1);
          border-color: rgba(248, 113, 113, 0.2);
          color: var(--color-family);
        }
        .auth-alert.success {
          background-color: rgba(74, 222, 128, 0.1);
          border-color: rgba(74, 222, 128, 0.2);
          color: var(--color-life);
        }
        .spinner {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* Animations */
        .fade-in {
          animation: fadeIn 0.8s ease forwards;
        }
        .slide-up {
          animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .slide-up-delayed {
          animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards;
          opacity: 0;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(24px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Responsive Breakpoints */
        @media (max-width: 1024px) {
          .landing-hero {
            grid-template-columns: 1fr;
            gap: 48px;
            padding: 32px;
          }
          .hero-title {
            font-size: 2.4rem;
          }
        }
        @media (max-width: 640px) {
          .landing-navbar {
            padding: 16px 24px;
          }
          .landing-logo {
            font-size: 1.4rem;
          }
          .landing-hero {
            padding: 24px;
          }
          .hero-title {
            font-size: 2rem;
          }
          .hero-actions {
            flex-direction: column;
            gap: 12px;
          }
          .btn {
            width: 100%;
            justify-content: center;
          }
          .auth-card-glowing {
            padding: 24px;
          }
        }
      `}</style>
    </div>
  );
};
