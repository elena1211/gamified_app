import { useState } from 'react';
import { API_ENDPOINTS, apiRequest } from '../config/api.js';
import { COLORS, EMOJIS, ANIMATION_CLASSES, LAYOUT_CLASSES } from '../config/constants.js';

const GOAL_SUGGESTIONS = [
  {
    title: "Become a Software Engineer",
    description: "Master programming skills, build projects, and land a position at a tech company"
  },
  {
    title: "Learn Data Science",
    description: "Develop skills in statistics, machine learning, and data analysis"
  },
  {
    title: "Master Web Development",
    description: "Build full-stack web applications with modern technologies"
  },
  {
    title: "Get Fit and Healthy",
    description: "Improve physical fitness, build healthy habits, and maintain wellness"
  },
  {
    title: "Learn a New Language",
    description: "Achieve fluency in a foreign language through consistent practice"
  },
  {
    title: "Start a Business",
    description: "Develop entrepreneurial skills and launch a successful venture"
  },
  {
    title: "Custom Goal",
    description: "Create your own personalized goal"
  }
];

export default function RegisterPage({ onRegisterSuccess, onNavigateBack }) {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    email: '',
    selectedGoal: null,
    customGoalTitle: '',
    customGoalDescription: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // 1: User Info, 2: Goal Selection

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleGoalSelect = (goal) => {
    setFormData(prev => ({
      ...prev,
      selectedGoal: goal,
      customGoalTitle: goal.title === 'Custom Goal' ? '' : goal.title,
      customGoalDescription: goal.title === 'Custom Goal' ? '' : goal.description
    }));
  };

  const handleNextStep = () => {
    // Validation for step 1
    if (!formData.username.trim()) {
      setError('Username is required');
      return;
    }
    
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    setError('');
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation for step 2
    if (!formData.selectedGoal) {
      setError('Please select a goal');
      return;
    }
    
    if (formData.selectedGoal.title === 'Custom Goal' && !formData.customGoalTitle.trim()) {
      setError('Please enter your custom goal title');
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
          goal_description: formData.customGoalDescription
        })
      });
      
      // Registration successful
      onRegisterSuccess(data.username);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 shadow-lg max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">🎮 Level Up</h1>
          <p className="text-gray-600">Start your journey to success!</p>
          {onNavigateBack && (
            <button
              onClick={onNavigateBack}
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:border-pink-300 hover:text-pink-600 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <span>←</span>
              <span className="font-medium">Back to Welcome</span>
            </button>
          )}
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center mb-6">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            step >= 1 ? 'bg-pink-500 text-white' : 'bg-gray-200 text-gray-500'
          }`}>
            1
          </div>
          <div className={`w-16 h-1 mx-2 ${step >= 2 ? 'bg-pink-500' : 'bg-gray-200'}`}></div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            step >= 2 ? 'bg-pink-500 text-white' : 'bg-gray-200 text-gray-500'
          }`}>
            2
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={step === 1 ? (e) => { e.preventDefault(); handleNextStep(); } : handleSubmit}>
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Account Information</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  placeholder="Choose a username"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email (optional)
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password *
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  placeholder="At least 6 characters"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password *
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  placeholder="Confirm your password"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-pink-500 hover:bg-pink-600 text-white py-3 rounded-lg font-medium transition-colors"
              >
                Next: Choose Your Goal →
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Choose Your Main Goal</h2>
              
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {GOAL_SUGGESTIONS.map((goal, index) => (
                  <div
                    key={index}
                    onClick={() => handleGoalSelect(goal)}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      formData.selectedGoal?.title === goal.title
                        ? 'border-pink-500 bg-pink-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <h3 className="font-medium text-gray-800">{goal.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{goal.description}</p>
                  </div>
                ))}
              </div>

              {formData.selectedGoal?.title === 'Custom Goal' && (
                <div className="space-y-3 mt-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Goal Title *
                    </label>
                    <input
                      type="text"
                      name="customGoalTitle"
                      value={formData.customGoalTitle}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                      placeholder="What do you want to achieve?"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      name="customGoalDescription"
                      value={formData.customGoalDescription}
                      onChange={handleInputChange}
                      rows="3"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                      placeholder="Describe your goal in detail..."
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-lg font-medium transition-colors"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-pink-500 hover:bg-pink-600 text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {loading ? 'Creating Account...' : 'Start Journey! 🚀'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
