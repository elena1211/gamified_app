import { useId, useState } from 'react';
import { ChartColumn, Flame, ScrollText, Target } from 'lucide-react';
import { apiRequest, API_ENDPOINTS } from '../config/api.js';
import { getAvatarThumbSrc, getAvatarTitle } from '../utils/avatar';

// One level from each avatar stage, lowest first.
const STAGE_LEVELS = [1, 5, 10, 30, 50];
const FIRST_LEVEL = STAGE_LEVELS[0];
const LAST_LEVEL = STAGE_LEVELS[STAGE_LEVELS.length - 1];
const FIRST_TITLE = getAvatarTitle(FIRST_LEVEL);
const LAST_TITLE = getAvatarTitle(LAST_LEVEL);
const STAGGER_MS = 90;
// Each stage stands a little taller than the last. Larger from md up, where the
// progression has a whole column to itself.
const FIGURE_HEIGHTS = [
  'h-14 md:h-20',
  'h-[4.5rem] md:h-[6.5rem]',
  'h-[5.5rem] md:h-32',
  'h-[6.5rem] md:h-[9.5rem]',
  'h-[7.5rem] md:h-44',
];

const FEATURES = [
  { Icon: Target, colour: 'var(--accent-rose-deep)', title: 'Set Your Goals', desc: 'Define your path to success' },
  { Icon: ScrollText, colour: 'var(--accent-gold-deep)', title: 'Daily Random Quests', desc: 'Complete challenges to level up' },
  { Icon: Flame, colour: 'var(--accent-rust)', title: 'Track Progress', desc: 'Maintain momentum and stay motivated' },
  { Icon: ChartColumn, colour: 'var(--frame-deep)', title: 'View Stats', desc: 'Watch your skills grow over time' },
];

// The five avatar stages side by side. The character growing as tasks get done
// is the whole premise of the app, so it is the first thing a visitor sees.
function StageProgression() {
  const captionId = useId();

  return (
    <figure aria-labelledby={captionId}>
      <div className="flex items-end justify-between gap-1 px-1">
        {STAGE_LEVELS.map((level, i) => (
          <div key={level} className={`stagger-item w-[18%] ${FIGURE_HEIGHTS[i]}`} style={{ animationDelay: `${i * STAGGER_MS}ms` }}>
            <img src={getAvatarThumbSrc(level)} alt="" className="h-full w-full object-contain object-bottom" />
          </div>
        ))}
      </div>
      <div className="mt-1" style={{ borderTop: '2px dashed var(--frame)', opacity: 0.5 }} />
      {/* The caption names the figure. Browsers derive that from <figcaption> on
          their own, but screen reader support for it is uneven, so
          aria-labelledby says it outright. Screen readers get one whole
          sentence; the two corner labels are the same facts laid out for the
          eye, so they are hidden from them rather than read twice. */}
      <figcaption id={captionId} className="mt-2 flex justify-between text-[11px] tracking-wide text-ink-soft">
        <span className="sr-only">
          {`Your character grows through five stages, from ${FIRST_TITLE} at level ${FIRST_LEVEL} to ${LAST_TITLE} at level ${LAST_LEVEL}.`}
        </span>
        <span aria-hidden="true">Lv. {FIRST_LEVEL} · {FIRST_TITLE}</span>
        <span aria-hidden="true">Lv. {LAST_LEVEL} · {LAST_TITLE}</span>
      </figcaption>
    </figure>
  );
}

export default function WelcomePage({ onLoginSuccess, onNavigateToRegister }) {
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGuest = async () => {
    // The guest id is the credential for the account it names, so the server
    // mints it. This used to be Math.random().toString(36).slice(2, 8) — not a
    // CSPRNG, and short enough to be guessable — cached in localStorage and
    // replayed to reclaim the account.
    setLoading(true);
    setError('');
    try {
      const { data } = await apiRequest(API_ENDPOINTS.guest, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      onLoginSuccess(data.username, data.token);
    } catch {
      setError('Failed to start guest session. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.password.trim()) {
      setError('All fields are required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data } = await apiRequest(API_ENDPOINTS.login, {
        method: 'POST',
        body: JSON.stringify({ username: formData.username, password: formData.password }),
      });
      onLoginSuccess(data.username, data.token);
    } catch (err) {
      setError(err.message || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  // Shown on both views. The landing view used to omit it, so a failed guest
  // start — most often the backend still waking up — cleared the spinner and
  // left the player with no idea anything had gone wrong.
  const errorBox = error && (
    <div
      role="alert"
      className="mb-4 px-4 py-3 text-sm text-ink border-2 rounded-sm"
      style={{ background: 'var(--paper-deep)', borderColor: 'var(--accent-rust)' }}
    >
      {error}
    </div>
  );

  const switchMode = (loginMode) => {
    setError('');
    setIsLoginMode(loginMode);
  };

  if (!isLoginMode) {
    return (
      <div className="paper-bg min-h-screen flex items-center justify-center p-4 sm:p-8">
        <div className="page-enter w-full max-w-4xl grid gap-8 md:grid-cols-2 md:items-center">
          <section className="text-center md:text-left">
            <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">Growth Journal</p>
            <h1 className="font-display text-4xl sm:text-5xl text-ink mt-2">Level Up</h1>
            <p className="text-ink-soft mt-3">
              Complete real tasks. Watch your character grow from {FIRST_TITLE} to {LAST_TITLE}.
            </p>
            <div className="mt-8 max-w-sm mx-auto md:mx-0 md:max-w-none">
              <StageProgression />
            </div>
          </section>

          <div className="rpg-window w-full max-w-md mx-auto">
            <div className="rpg-header">Begin your journey</div>
            <div className="px-6 py-6">
              <ul className="space-y-4 mb-7">
                {FEATURES.map(({ Icon, colour, title, desc }) => (
                  <li key={title} className="flex items-start gap-3">
                    <span className="feature-seal" style={{ color: colour }} aria-hidden="true">
                      <Icon size={18} strokeWidth={2} />
                    </span>
                    <div>
                      <h2 className="font-semibold text-ink text-sm">{title}</h2>
                      <p className="text-xs text-ink-soft">{desc}</p>
                    </div>
                  </li>
                ))}
              </ul>

              {errorBox}

              <div className="space-y-3">
                <button
                  onClick={onNavigateToRegister}
                  className="rpg-btn-primary w-full"
                >
                  Create Account
                </button>
                <button
                  onClick={() => switchMode(true)}
                  className="rpg-btn-secondary w-full"
                >
                  Sign In
                </button>
                <button
                  onClick={handleGuest}
                  disabled={loading}
                  className="w-full text-xs text-ink-soft hover:text-ink underline transition-colors py-1"
                >
                  {loading ? 'Starting guest session…' : 'Continue as guest (no account needed)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="paper-bg min-h-screen flex items-center justify-center p-4">
      <div className="rpg-window max-w-sm w-full page-enter">
        <h1 className="rpg-header">Welcome Back</h1>
        <div className="px-6 py-6">
          {errorBox}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs text-ink-soft uppercase tracking-wider mb-1">
                Username
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                className="rpg-input"
                placeholder="Enter your username"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-ink-soft uppercase tracking-wider mb-1">
                Password
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="rpg-input"
                placeholder="Enter your password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="rpg-btn-primary w-full mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span
                    className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
                  />
                  Signing in…
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <div className="paper-divider mt-5 mb-4"><span>or</span></div>

          <div className="flex flex-col gap-2 text-center text-sm">
            <button
              onClick={() => switchMode(false)}
              className="text-ink-mute hover:text-ink transition-colors"
            >
              ← Back
            </button>
            <span className="text-ink-mute text-xs">
              No account?{' '}
              <button
                onClick={onNavigateToRegister}
                className="text-rose underline hover:text-ink transition-colors"
              >
                Register here
              </button>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
