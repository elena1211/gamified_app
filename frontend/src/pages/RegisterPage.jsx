import { useState } from 'react';
import { API_ENDPOINTS, apiRequest } from '../config/api.js';

const GOAL_SUGGESTIONS = [
  { title: 'Become a Software Engineer', description: 'Master programming skills, build projects, and land a position at a tech company' },
  { title: 'Learn Data Science', description: 'Develop skills in statistics, machine learning, and data analysis' },
  { title: 'Master Web Development', description: 'Build full-stack web applications with modern technologies' },
  { title: 'Get Fit and Healthy', description: 'Improve physical fitness, build healthy habits, and maintain wellness' },
  { title: 'Learn a New Language', description: 'Achieve fluency in a foreign language through consistent practice' },
  { title: 'Start a Business', description: 'Develop entrepreneurial skills and launch a successful venture' },
  { title: 'Custom Goal', description: 'Create your own personalised goal' },
];

export default function RegisterPage({ onRegisterSuccess, onNavigateBack }) {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    email: '',
    selectedGoal: null,
    customGoalTitle: '',
    customGoalDescription: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleGoalSelect = (goal) => {
    setFormData(prev => ({
      ...prev,
      selectedGoal: goal,
      customGoalTitle: goal.title === 'Custom Goal' ? '' : goal.title,
      customGoalDescription: goal.title === 'Custom Goal' ? '' : goal.description,
    }));
  };

  const handleNextStep = () => {
    if (!formData.username.trim()) { setError('All fields are required'); return; }
    if (formData.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (formData.password !== formData.confirmPassword) { setError('Passwords do not match'); return; }
    setError('');
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.selectedGoal) { setError('Please select a goal'); return; }
    if (formData.selectedGoal.title === 'Custom Goal' && !formData.customGoalTitle.trim()) {
      setError('Goal title is required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data } = await apiRequest(API_ENDPOINTS.register, {
        method: 'POST',
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          email: formData.email,
          goal_title: formData.customGoalTitle,
          goal_description: formData.customGoalDescription,
        }),
      });
      onRegisterSuccess(data.username);
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="paper-bg min-h-screen flex items-center justify-center p-4">
      <div className="rpg-window max-w-md w-full page-enter">
        <div className="rpg-header">
          Create Account — Step {step} of 2
        </div>
        <div className="px-6 py-5">
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-5">
            {[1, 2].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors"
                  style={
                    step >= s
                      ? { background: 'var(--accent-rose-deep)', borderColor: 'var(--accent-rose-deep)', color: 'var(--paper)' }
                      : { background: 'var(--paper)', borderColor: 'var(--frame)', color: 'var(--ink-mute)' }
                  }
                >
                  {s}
                </div>
                {s < 2 && (
                  <div
                    className="w-12 h-0.5"
                    style={{ background: step >= 2 ? 'var(--accent-rose-deep)' : 'var(--frame)', opacity: 0.5 }}
                  />
                )}
              </div>
            ))}
          </div>

          {error && (
            <div
              className="mb-4 px-4 py-3 text-sm text-ink border-2 rounded-sm"
              style={{ background: 'var(--paper-deep)', borderColor: 'var(--accent-rust)' }}
            >
              {error}
            </div>
          )}

          <form onSubmit={step === 1 ? (e) => { e.preventDefault(); handleNextStep(); } : handleSubmit}>
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="font-display text-lg text-ink mb-2">Account Details</h2>

                {[
                  { label: 'Username', name: 'username', type: 'text', placeholder: 'Choose a username', required: true },
                  { label: 'Email (optional)', name: 'email', type: 'email', placeholder: 'your@email.com', required: false },
                  { label: 'Password', name: 'password', type: 'password', placeholder: 'At least 6 characters', required: true },
                  { label: 'Confirm Password', name: 'confirmPassword', type: 'password', placeholder: 'Repeat your password', required: true },
                ].map(field => (
                  <div key={field.name}>
                    <label className="block text-xs text-ink-soft uppercase tracking-wider mb-1">
                      {field.label}
                    </label>
                    <input
                      type={field.type}
                      name={field.name}
                      value={formData[field.name]}
                      onChange={handleInputChange}
                      className="rpg-input"
                      placeholder={field.placeholder}
                      required={field.required}
                    />
                  </div>
                ))}

                <button type="submit" className="rpg-btn-primary w-full mt-2">
                  Next: Choose Your Goal →
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h2 className="font-display text-lg text-ink mb-2">Set Your Main Goal</h2>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {GOAL_SUGGESTIONS.map((goal, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleGoalSelect(goal)}
                      className="w-full text-left p-3 rounded-sm border-2 transition-all"
                      style={
                        formData.selectedGoal?.title === goal.title
                          ? { borderColor: 'var(--frame-deep)', background: 'var(--paper-shadow)' }
                          : { borderColor: 'var(--frame)', background: 'var(--paper)', opacity: 0.85 }
                      }
                    >
                      <h3 className="text-sm font-semibold text-ink">{goal.title}</h3>
                      <p className="text-xs text-ink-mute mt-0.5">{goal.description}</p>
                    </button>
                  ))}
                </div>

                {formData.selectedGoal?.title === 'Custom Goal' && (
                  <div
                    className="space-y-3 p-4 rounded-sm"
                    style={{ background: 'var(--paper-deep)', border: '1px solid var(--frame)' }}
                  >
                    <div>
                      <label className="block text-xs text-ink-soft uppercase tracking-wider mb-1">Goal Title</label>
                      <input
                        type="text"
                        name="customGoalTitle"
                        value={formData.customGoalTitle}
                        onChange={handleInputChange}
                        className="rpg-input"
                        placeholder="Enter your goal title"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-ink-soft uppercase tracking-wider mb-1">Description</label>
                      <textarea
                        name="customGoalDescription"
                        value={formData.customGoalDescription}
                        onChange={handleInputChange}
                        rows="3"
                        className="rpg-input resize-none"
                        placeholder="Describe your goal in detail"
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="rpg-btn-secondary flex-1"
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="rpg-btn-primary flex-1"
                  >
                    {loading ? 'Creating…' : 'Begin Journey'}
                  </button>
                </div>
              </div>
            )}
          </form>

          {onNavigateBack && step === 1 && (
            <div className="text-center mt-4">
              <button
                onClick={onNavigateBack}
                className="text-xs text-ink-mute hover:text-ink transition-colors"
              >
                ← Back to welcome
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
