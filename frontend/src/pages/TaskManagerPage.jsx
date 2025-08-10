import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Edit, Trash2, Clock, CheckCircle, XCircle, Save, X } from 'lucide-react';
import { API_ENDPOINTS, apiRequest } from '../config/api.js';
import BottomNav from '../components/BottomNav';

export default function TaskManagerPage({ currentUser, onNavigateToHome, onNavigateToSettings }) {
  const [tasks, setTasks] = useState([]);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [activeTab, setActiveTab] = useState('active'); // 'active', 'history'
  
  // Refs for forms and tasks
  const addFormRef = useRef(null);
  const taskRefs = useRef({});
  const scrollPositionRef = useRef(0);
  
  // New task form state
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
    { value: 'discipline', label: 'Discipline', emoji: '🎯' },
    { value: 'knowledge', label: 'Knowledge', emoji: '🧠' },
    { value: 'energy', label: 'Energy', emoji: '⚡' },
    { value: 'charisma', label: 'Charisma', emoji: '✨' }
  ];

  // Fetch all tasks and history
  const fetchAllTasks = async () => {
    try {
      setLoading(true);
      
      // Fetch active tasks
      const activeTasks = await apiRequest(`${API_ENDPOINTS.tasks}?user=${currentUser || 'elena'}&all=true`);
      setTasks(activeTasks.data || []);
      
      // Fetch completed task history (mock for now)
      const historyTasks = [
        {
          id: 'h1',
          title: '📚 Read for 30 minutes',
          completedAt: '2025-08-09',
          reward_point: '3',
          difficulty: 1,
          attribute: 'knowledge'
        },
        {
          id: 'h2', 
          title: '🏃‍♂️ Morning jog',
          completedAt: '2025-08-08',
          reward_point: '4',
          difficulty: 2,
          attribute: 'energy'
        }
      ];
      setCompletedTasks(historyTasks);
      
    } catch (error) {
      console.error('Error fetching tasks:', error);
      // Fallback data
      setTasks([
        {id: 1, title: "🧹 Organise workspace", description: "Clean and organise your desk", reward_point: "4", difficulty: 1, attribute: "discipline"},
        {id: 2, title: "📝 Write journal entry", description: "Reflect on today's experiences", reward_point: "3", difficulty: 1, attribute: "discipline"},
        {id: 3, title: "🏃‍♂️ 30-minute workout", description: "Include cardio and strength training", reward_point: "6", difficulty: 2, attribute: "energy"}
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllTasks();
  }, [currentUser]);

  // Restore scroll position when editing state changes
  useEffect(() => {
    if (scrollPositionRef.current > 0) {
      // Use requestAnimationFrame to ensure scroll position is restored in the next repaint cycle
      const animationId = requestAnimationFrame(() => {
        const targetPosition = scrollPositionRef.current;
        // Only scroll if the target position differs from current position
        if (Math.abs(window.scrollY - targetPosition) > 5) {
          window.scrollTo({
            top: targetPosition,
            behavior: 'instant'
          });
        }
        // Reset scroll position reference
        scrollPositionRef.current = 0;
      });
      
      return () => cancelAnimationFrame(animationId);
    }
  }, [editingTask]);

  // Handle adding new task
  const handleAddTask = async (e) => {
    if (e) {
      e.preventDefault(); // prevent form submission
      e.stopPropagation();
    }
    
    if (!newTask.title.trim()) return;

    try {
      const taskData = {
        ...newTask,
        user: currentUser || 'elena',
        completed: false
      };

      // For now, just add to local state (you can implement API call)
      const newId = Math.max(...tasks.map(t => t.id || 0)) + 1;
      const createdTask = { ...taskData, id: newId };
      
      setTasks(prev => [...prev, createdTask]);
      setNewTask({ title: '', description: '', reward_point: '', difficulty: 1, attribute: 'discipline' });
      setShowAddForm(false);
      
    } catch (error) {
      console.error('Error adding task:', error);
    }
  };

  // Handle editing task
  const handleEditTask = async (taskId, updatedData, e) => {
    if (e) {
      e.preventDefault(); // prevent form submission
      e.stopPropagation();
    }
    
    // Save current scroll position
    scrollPositionRef.current = window.scrollY;
    
    try {
      setTasks(prev => prev.map(task => 
        task.id === taskId ? { ...task, ...updatedData } : task
      ));
      setEditingTask(null);
      
    } catch (error) {
      console.error('Error editing task:', error);
    }
  };

  // Handle completing task
  const handleCompleteTask = async (task, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!confirm(`Complete "${task.title}"?`)) return;
    
    try {
      // Move task to completed tasks with completion date
      const completedTask = {
        ...task,
        completedAt: new Date().toISOString().split('T')[0] // Today's date in YYYY-MM-DD format
      };
      
      setCompletedTasks(prev => [completedTask, ...prev]);
      setTasks(prev => prev.filter(t => t.id !== task.id));
      
    } catch (error) {
      console.error('Error completing task:', error);
    }
  };

  // Handle deleting task
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

  // Start editing task
  const startEditingTask = useCallback((task, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    // Save scroll position only when needed
    if (!editingTask) {
      scrollPositionRef.current = window.scrollY;
    }
    setEditingTask({ id: task.id });
  }, [editingTask]);

  // Cancel editing
  const cancelEditing = useCallback((e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    // Save current scroll position only when necessary
    if (editingTask) {
      scrollPositionRef.current = window.scrollY;
    }
    setEditingTask(null);
  }, [editingTask]);

  const TaskCard = ({ task, isHistory = false }) => {
    const isEditing = editingTask?.id === task.id;
    const difficulty = difficultyOptions.find(d => d.value === task.difficulty);
    const attribute = attributeOptions.find(a => a.value === task.attribute);

    // Local state for task element reference for potential future use
    const [localEditData, setLocalEditData] = useState(null);

    // When entering edit mode, initialize local edit data
    useEffect(() => {
      if (isEditing && !localEditData) {
        setLocalEditData({
          title: task.title || '',
          description: task.description || '',
          reward_point: task.reward_point || '',
          difficulty: task.difficulty || 1,
          attribute: task.attribute || 'discipline'
        });
      } else if (!isEditing && localEditData) {
        setLocalEditData(null);
      }
    }, [isEditing]);

    const handleLocalInputChange = (field, value) => {
      setLocalEditData(prev => prev ? { ...prev, [field]: value } : null);
    };

    const handleSubmit = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (localEditData) {
        handleEditTask(task.id, localEditData, e);
      }
    };

    if (isEditing && localEditData) {
      return (
        <form 
          onSubmit={handleSubmit}
          className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-3 transition-all duration-200 ease-in-out"
          style={{ minHeight: '200px' }}
        >
          <div className="space-y-3">
            <input
              type="text"
              value={localEditData.title}
              onChange={(e) => handleLocalInputChange('title', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Task title"
            />
            <input
              type="text"
              value={localEditData.description}
              onChange={(e) => handleLocalInputChange('description', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Task description"
            />
            <input
              type="number"
              value={localEditData.reward_point}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                if (e.target.value === '' || (value >= 1 && value <= 5)) {
                  handleLocalInputChange('reward_point', e.target.value);
                }
              }}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Reward points (1-5)"
              min="1"
              max="5"
            />
            <div className="flex gap-2">
              <select
                value={localEditData.difficulty}
                onChange={(e) => handleLocalInputChange('difficulty', parseInt(e.target.value))}
                className="px-3 py-2 border rounded-lg text-sm flex-1"
              >
                {difficultyOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <select
                value={localEditData.attribute}
                onChange={(e) => handleLocalInputChange('attribute', e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm flex-1"
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
                onClick={cancelEditing}
                className="flex items-center gap-1 px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 flex-1 justify-center"
              >
                <X size={14} /> Cancel
              </button>
            </div>
          </div>
        </form>
      );
    }

    return (
      <div 
        ref={el => taskRefs.current[task.id] = el}
        className="bg-white border border-gray-200 rounded-lg p-4 mb-3 shadow-sm transition-all duration-200 ease-in-out"
        style={{ minHeight: '120px' }}
      >
        <div className="h-full flex flex-col">
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-medium text-gray-800 flex-1 pr-2 leading-tight">{task.title}</h3>
            {!isHistory && (
              <div className="flex gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={(e) => handleCompleteTask(task, e)}
                  className="p-1 text-green-500 hover:bg-green-50 rounded"
                  title="Complete task"
                >
                  <CheckCircle size={16} />
                </button>
                <button
                  type="button"
                  onClick={(e) => startEditingTask(task, e)}
                  className="p-1 text-blue-500 hover:bg-blue-50 rounded"
                  title="Edit task"
                >
                  <Edit size={16} />
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDeleteTask(task.id, e)}
                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                  title="Delete task"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>
          
          <div className="flex-1 flex flex-col justify-between min-h-0">
            {task.description && (
              <p className="text-sm text-gray-600 mb-2 line-clamp-2">{task.description}</p>
            )}
            
            <div className="flex items-center justify-between text-sm mt-auto pt-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`font-medium ${difficulty?.colour || 'text-gray-600'}`}>
                  {difficulty?.label || 'Unknown'}
                </span>
                <span className="text-gray-600">
                  {attribute?.emoji} {attribute?.label}
                </span>
                <span className="text-green-600 font-medium">
                  +{task.reward_point} {attribute?.label || 'Points'}
                </span>
              </div>
              
              {isHistory && (
                <div className="flex items-center gap-1 text-gray-500">
                  <Clock size={14} />
                  <span>{task.completedAt}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

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
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Task Manager</h1>
          <p className="text-gray-600">Manage your quests and track your progress</p>
        </div>

        {/* Tabs */}
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

        {/* Content */}
        {activeTab === 'active' && (
          <div>
            {/* Add Task Button */}
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="w-full mb-6 py-3 px-4 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={20} />
              Add New Task
            </button>

            {/* Add Task Form */}
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

            {/* Active Tasks List */}
            <div>
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Active Tasks</h2>
              {tasks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No active tasks. Create your first task above!</p>
                </div>
              ) : (
                tasks.map(task => (
                  <TaskCard key={task.id} task={task} />
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
                <TaskCard key={task.id} task={task} isHistory={true} />
              ))
            )}
          </div>
        )}
      </div>

      <BottomNav 
        onSettingsClick={onNavigateToSettings} 
        onHomeClick={onNavigateToHome} 
        onTaskManagerClick={() => {}} // Empty function since we're already on tasks page
        currentPage="tasks"
      />
    </div>
  );
}
