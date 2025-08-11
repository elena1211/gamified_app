import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Edit, Trash2, Clock, CheckCircle, XCircle, Save, X } from 'lucide-react';
import { API_ENDPOINTS, apiRequest } from '../config/api.js';
import BottomNav from '../components/BottomNav';

// Move TaskCard outside the main component to prevent re-creation
const TaskCard = ({ 
  task, 
  isHistory = false, 
  isEditing, 
  editData, 
  onStartEdit, 
  onCancelEdit, 
  onSaveEdit, 
  onComplete, 
  onDelete, 
  onEditDataChange,
  difficultyOptions,
  attributeOptions 
}) => {
  const difficulty = difficultyOptions.find(d => d.value === task.difficulty);
  const attribute = attributeOptions.find(a => a.value === task.attribute);

  const handleSubmit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onSaveEdit(task.id, editData);
  };

  if (isEditing && editData) {
    return (
      <div 
        className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-3"
        style={{ minHeight: '200px' }}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={editData.title}
            onChange={(e) => {
              e.preventDefault();
              onEditDataChange('title', e.target.value);
            }}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Task title"
          />
          <input
            type="text"
            value={editData.description}
            onChange={(e) => {
              e.preventDefault();
              onEditDataChange('description', e.target.value);
            }}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Task description"
          />
          <input
            type="number"
            value={editData.reward_point}
            onChange={(e) => {
              e.preventDefault();
              const value = parseInt(e.target.value);
              if (e.target.value === '' || (value >= 1 && value <= 5)) {
                onEditDataChange('reward_point', e.target.value);
              }
            }}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Reward points (1-5)"
            min="1"
            max="5"
          />
          <div className="flex gap-2">
            <select
              value={editData.difficulty}
              onChange={(e) => {
                e.preventDefault();
                onEditDataChange('difficulty', parseInt(e.target.value));
              }}
              className="px-3 py-2 border rounded-lg text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {difficultyOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select
              value={editData.attribute}
              onChange={(e) => {
                e.preventDefault();
                onEditDataChange('attribute', e.target.value);
              }}
              className="px-3 py-2 border rounded-lg text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {attributeOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.emoji} {opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex items-center gap-1 px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 flex-1 justify-center"
            >
              <Save size={14} /> Save
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onCancelEdit(e);
              }}
              className="flex items-center gap-1 px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 flex-1 justify-center"
            >
              <X size={14} /> Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div 
      className="bg-white border border-gray-200 rounded-lg p-4 mb-3 shadow-sm"
      style={{ minHeight: '120px' }}
    >
      <div className="h-full flex flex-col">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-medium text-gray-800 flex-1 pr-2 leading-tight">{task.title}</h3>
          {!isHistory && (
            <div className="flex gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onComplete(task, e);
                }}
                className="p-1 text-green-500 hover:bg-green-50 rounded"
                title="Complete task"
              >
                <CheckCircle size={16} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onStartEdit(task, e);
                }}
                className="p-1 text-blue-500 hover:bg-blue-50 rounded"
                title="Edit task"
              >
                <Edit size={16} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete(task.id, e);
                }}
                className="p-1 text-red-500 hover:bg-red-50 rounded"
                title="Delete task"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>
        
        {task.description && (
          <p className="text-gray-600 text-sm mb-3 flex-1">{task.description}</p>
        )}
        
        <div className="flex items-center gap-3 mt-auto">
          <span className={`text-xs px-2 py-1 rounded-full ${difficulty?.colour} bg-opacity-10`}>
            {difficulty?.label}
          </span>
          <span className="text-xs text-gray-500">
            {attribute?.emoji} {attribute?.label}
          </span>
          <span className="text-xs font-medium text-green-600 ml-auto">
            +{task.reward_point} {attribute?.label}
          </span>
        </div>
        
        {isHistory && task.completedAt && (
          <div className="mt-2 text-xs text-gray-500">
            Completed: {task.completedAt}
          </div>
        )}
      </div>
    </div>
  );
};

export default function TaskManagerPage({ currentUser, onNavigateToHome, onNavigateToSettings }) {
  const [tasks, setTasks] = useState([]);
  const [completedTasks, setCompletedTasks] = useState([
    {id: 101, title: "💻 Practice coding", description: "Completed Leetcode problem", reward_point: "5", difficulty: 2, attribute: "intelligence", completedAt: "2025-08-10"},
    {id: 102, title: "🚶‍♀️ Morning walk", description: "30-minute walk in the park", reward_point: "3", difficulty: 1, attribute: "energy", completedAt: "2025-08-09"},
    {id: 103, title: "📖 Read chapter", description: "Read one chapter of productivity book", reward_point: "4", difficulty: 1, attribute: "intelligence", completedAt: "2025-08-08"}
  ]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [editData, setEditData] = useState(null);
  const [activeTab, setActiveTab] = useState('active');
  
  const addFormRef = useRef(null);
  
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    reward_point: '',
    difficulty: 1,
    attribute: 'discipline'
  });

  const difficultyOptions = [
    { value: 1, label: 'Easy', colour: 'text-green-600' },
    { value: 2, label: 'Medium', colour: 'text-yellow-600' },
    { value: 3, label: 'Hard', colour: 'text-red-600' }
  ];

  const attributeOptions = [
    { value: 'discipline', label: 'Discipline', emoji: '💪' },
    { value: 'energy', label: 'Energy', emoji: '⚡' },
    { value: 'happiness', label: 'Happiness', emoji: '😊' },
    { value: 'health', label: 'Health', emoji: '🏥' },
    { value: 'intelligence', label: 'Intelligence', emoji: '🧠' },
    { value: 'strength', label: 'Strength', emoji: '💪' },
    { value: 'social', label: 'Social', emoji: '👥' },
    { value: 'creativity', label: 'Creativity', emoji: '🎨' }
  ];

  const fetchAllTasks = async () => {
    setLoading(true);
    try {
      setTasks([
        {id: 1, title: "🧹 Organise workspace", description: "Clean and organise your desk", reward_point: "4", difficulty: 1, attribute: "discipline"},
        {id: 2, title: "📝 Write journal entry", description: "Reflect on today's experiences", reward_point: "3", difficulty: 1, attribute: "discipline"},
        {id: 3, title: "🏃‍♂️ 30-minute workout", description: "Include cardio and strength training", reward_point: "5", difficulty: 2, attribute: "energy"},
        {id: 4, title: "📚 Learn something new", description: "Read an educational article or watch a tutorial", reward_point: "4", difficulty: 1, attribute: "intelligence"},
        {id: 5, title: "🧘‍♀️ Meditation session", description: "10 minutes of mindfulness meditation", reward_point: "3", difficulty: 1, attribute: "energy"}
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllTasks();
  }, [currentUser]);

  const handleAddTask = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!newTask.title.trim()) return;

    try {
      const taskData = {
        ...newTask,
        user: currentUser || 'elena',
        completed: false
      };

      const newId = Math.max(...tasks.map(t => t.id || 0)) + 1;
      const createdTask = { ...taskData, id: newId };
      
      setTasks(prev => [...prev, createdTask]);
      setNewTask({ title: '', description: '', reward_point: '', difficulty: 1, attribute: 'discipline' });
      setShowAddForm(false);
      
    } catch (error) {
      console.error('Error adding task:', error);
    }
  };

  const handleEditTask = async (taskId, updatedData) => {
    try {
      setTasks(prev => prev.map(task => 
        task.id === taskId ? { ...task, ...updatedData } : task
      ));
      setEditingTask(null);
      setEditData(null);
    } catch (error) {
      console.error('Error editing task:', error);
    }
  };

  const handleCompleteTask = async (task, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!confirm(`Complete "${task.title}"?`)) return;
    
    try {
      const completedTask = {
        ...task,
        completedAt: new Date().toISOString().split('T')[0]
      };
      
      setCompletedTasks(prev => [completedTask, ...prev]);
      setTasks(prev => prev.filter(t => t.id !== task.id));
    } catch (error) {
      console.error('Error completing task:', error);
    }
  };

  const handleDeleteTask = async (taskId, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
      setTasks(prev => prev.filter(task => task.id !== taskId));
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const startEditingTask = useCallback((task, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    setEditingTask(task.id);
    setEditData({
      title: task.title || '',
      description: task.description || '',
      reward_point: task.reward_point || '',
      difficulty: task.difficulty || 1,
      attribute: task.attribute || 'discipline'
    });
  }, []);

  const cancelEditing = useCallback((e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setEditingTask(null);
    setEditData(null);
  }, []);

  const handleEditDataChange = useCallback((field, value) => {
    setEditData(prev => prev ? { ...prev, [field]: value } : null);
  }, []);

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center" style={{minHeight: '100vh'}}>
        <div className="text-purple-800 text-xl">🔧 Loading Task Manager...</div>
      </div>
    );
  }

  return (
    <div className="bg-pink-50 pb-20" style={{minHeight: '100vh'}}>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Task Manager</h1>
          <p className="text-gray-600">Manage your quests and track your progress</p>
        </div>

        <div className="flex mb-6 bg-white rounded-lg p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'active'
                ? 'bg-purple-500 text-white'
                : 'text-gray-600 hover:text-purple-600'
            }`}
          >
            Active Tasks ({tasks.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'history'
                ? 'bg-purple-500 text-white'
                : 'text-gray-600 hover:text-purple-600'
            }`}
          >
            Completed History ({completedTasks.length})
          </button>
        </div>

        {activeTab === 'active' && (
          <div>
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="w-full mb-6 py-3 px-4 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={20} />
              Add New Task
            </button>

            {showAddForm && (
              <form 
                onSubmit={handleAddTask}
                ref={addFormRef} 
                className="bg-white border border-gray-200 rounded-lg p-6 mb-6 shadow-sm"
              >
                <h3 className="text-lg font-medium mb-4">Create New Task</h3>
                <div className="space-y-4">
                  <input
                    type="text"
                    value={newTask.title}
                    onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm"
                    placeholder="Task title (e.g., 🏃‍♂️ 30-minute workout)"
                  />
                  <input
                    type="text"
                    value={newTask.description}
                    onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm"
                    placeholder="Task description or tip"
                  />
                  <input
                    type="number"
                    value={newTask.reward_point}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (e.target.value === '' || (value >= 1 && value <= 5)) {
                        setNewTask(prev => ({ ...prev, reward_point: e.target.value }));
                      }
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm"
                    placeholder="Reward points (1-5)"
                    min="1"
                    max="5"
                  />
                  <div className="flex gap-3">
                    <select
                      value={newTask.difficulty}
                      onChange={(e) => setNewTask(prev => ({ ...prev, difficulty: parseInt(e.target.value) }))}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-sm"
                    >
                      {difficultyOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <select
                      value={newTask.attribute}
                      onChange={(e) => setNewTask(prev => ({ ...prev, attribute: e.target.value }))}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-sm"
                    >
                      {attributeOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.emoji} {opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      className="flex-1 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                    >
                      Create Task
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddForm(false);
                        setNewTask({ title: '', description: '', reward_point: '', difficulty: 1, attribute: 'discipline' });
                      }}
                      className="flex-1 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            )}

            <div>
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Active Tasks</h2>
              {tasks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No active tasks. Create your first task above!</p>
                </div>
              ) : (
                tasks.map(task => (
                  <TaskCard 
                    key={task.id} 
                    task={task} 
                    isEditing={editingTask === task.id}
                    editData={editData}
                    onStartEdit={startEditingTask}
                    onCancelEdit={cancelEditing}
                    onSaveEdit={handleEditTask}
                    onComplete={handleCompleteTask}
                    onDelete={handleDeleteTask}
                    onEditDataChange={handleEditDataChange}
                    difficultyOptions={difficultyOptions}
                    attributeOptions={attributeOptions}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Completed Tasks History</h2>
            {completedTasks.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle size={48} className="mx-auto mb-4 text-gray-300" />
                <p>No completed tasks yet. Complete some tasks to see your history!</p>
              </div>
            ) : (
              completedTasks.map(task => (
                <TaskCard 
                  key={task.id} 
                  task={task} 
                  isHistory={true} 
                  difficultyOptions={difficultyOptions}
                  attributeOptions={attributeOptions}
                />
              ))
            )}
          </div>
        )}
      </div>

      <BottomNav 
        onSettingsClick={onNavigateToSettings} 
        onHomeClick={onNavigateToHome} 
        onTaskManagerClick={() => {}}
        currentPage="tasks"
      />
    </div>
  );
}
