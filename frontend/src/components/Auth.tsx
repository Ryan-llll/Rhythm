import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Sparkles, Mail, Lock, Loader } from 'lucide-react';

interface AuthProps {
  onContinueOffline: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onContinueOffline }) => {
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
          setSuccessMsg('Verification email sent! Please check your inbox.');
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

  return (
    <div className="auth-overlay">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo font-mono">
            <Sparkles size={24} color="#d8c3a5" className="logo-sparkle" />
            <span>Rhythm</span>
          </div>
          <span className="auth-subtitle">Developer Habit Tracker</span>
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
            <label className="form-label" htmlFor="auth-email">Email Address</label>
            <div className="input-icon-wrapper">
              <Mail size={16} className="input-icon" />
              <input
                type="email"
                id="auth-email"
                className="form-input with-icon"
                placeholder="developer@rhythm.dev"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="auth-password">Password</label>
            <div className="input-icon-wrapper">
              <Lock size={16} className="input-icon" />
              <input
                type="password"
                id="auth-password"
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
              'Sign In'
            )}
          </button>
        </form>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <button
          type="button"
          className="btn btn-outline offline-btn font-mono"
          onClick={onContinueOffline}
        >
          Continue Offline (Local Storage)
        </button>
      </div>

      <style>{`
        .auth-overlay {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          width: 100vw;
          background-color: var(--bg-color);
          padding: 24px;
        }
        .auth-card {
          background-color: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 12px;
          width: 100%;
          max-width: 420px;
          padding: 32px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .auth-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }
        .auth-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 1.8rem;
          font-weight: 700;
          color: var(--text-primary);
        }
        .auth-subtitle {
          font-size: 0.8rem;
          color: var(--text-muted);
          font-weight: 500;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
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
          margin-top: 10px;
          padding: 12px;
          font-weight: 600;
          font-size: 0.95rem;
          background-color: var(--accent-color);
          color: #18181b;
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
        .auth-divider {
          display: flex;
          align-items: center;
          text-align: center;
          color: var(--text-muted);
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin: 8px 0;
        }
        .auth-divider::before,
        .auth-divider::after {
          content: '';
          flex: 1;
          border-bottom: 1px solid var(--card-border);
        }
        .auth-divider:not(:empty)::before {
          margin-right: .5em;
        }
        .auth-divider:not(:empty)::after {
          margin-left: .5em;
        }
        .offline-btn {
          width: 100%;
          padding: 12px;
          font-weight: 600;
          font-size: 0.95rem;
          border: 1px solid var(--card-border);
          background-color: transparent;
          color: var(--text-secondary);
          cursor: pointer;
          border-radius: 6px;
          transition: all var(--transition-fast);
        }
        .offline-btn:hover {
          background-color: var(--input-bg);
          color: var(--text-primary);
          border-color: var(--text-muted);
        }
      `}</style>
    </div>
  );
};
