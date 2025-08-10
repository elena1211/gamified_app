import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Plus, Edit, Trash2, Clock, CheckCircle, XCircle, Save, X } from 'lucide-react';
import { API_ENDPOINTS, apiRequest } from './config/api.js';
import BottomNav from './components/BottomNav';

export default function TaskManagerPage({ currentUser, onNavigateToHome, onNavigateToSettings }) {
  const [tasks, setTasks] = useState([]);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [activeTab, setActiveTab] = useState('active'); // 'active', 'history'
  
  // Refs for scrolling
  const addFormRef = useRef(null);
  const taskRefs = useRef({});
  const scrollPositionRef = useRef(0);
  
  // Preserve scroll position during re-renders
  useLayoutEffect(() => {
    const saveScroll = () => {
      scrollPositionRef.current = window.pageYOffset;
    };
    const restoreScroll = () => {
      window.scrollTo(0, scrollPositionRef.current);
    };
    
    saveScroll();
    const timeoutId = setTimeout(restoreScroll, 0);
    
    return () => clearTimeout(timeoutId);
  });
  
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

  // Handle adding new task
  const handleAddTask = async () => {
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
  const handleEditTask = async (taskId, updatedData) => {
    try {
      setTasks(prev => prev.map(task => 
        task.id === taskId ? { ...task, ...updatedData } : task
      ));
      setEditingTask(null);
      
    } catch (error) {
      console.error('Error editing task:', error);
    }
  };

  // Handle deleting task
  const handleDeleteTask = async (taskId) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
      setTasks(prev => prev.filter(task => task.id !== taskId));
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const TaskCard = ({ task, isHistory = false }) => {
    const isEditing = editingTask?.id === task.id;
    const difficulty = difficultyOptions.find(d => d.value === task.difficulty);
    const attribute = attributeOptions.find(a => a.value === task.attribute);

    if (isEditing) {
      return (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-3 min-h-[280px]">
          <div className="space-y-3">
            <input
              type="text"
              value={editingTask.title}
              onChange={(e) => setEditingTask(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Task title"
              autoFocus={false}
            />
            <input
              type="text"
              value={editingTask.description}
              onChange={(e) => setEditingTask(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Task description"
            />
            <input
              type="text"
              value={editingTask.reward_point}
              onChange={(e) => setEditingTask(prev => ({ ...prev, reward_point: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Reward points (e.g., 5)"
            />
            <div className="flex gap-2">
              <select
                value={editingTask.difficulty}
                onChange={(e) => setEditingTask(prev => ({ ...prev, difficulty: parseInt(e.target.value) }))}
                className="px-3 py-2 border rounded-lg text-sm"
              >
                {difficultyOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <select
                value={editingTask.attribute}
                onChange={(e) => setEditingTask(prev => ({ ...prev, attribute: e.target.value }))}
                className="px-3 py-2 border rounded-lg text-sm"
              >
                {attributeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.emoji} {opt.label}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleEditTask(task.id, editingTask)}
                className="flex items-center gap-1 px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
              >
                <Save size={14} /> Save
              </button>
              <button
                onClick={() => setEditingTask(null)}
                className="flex items-center gap-1 px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
              >
                <X size={14} /> Cancel
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div 
        ref={el => taskRefs.current[task.id] = el}
        className="bg-white border border-gray-200 rounded-lg p-4 mb-3 shadow-sm min-h-[140px]"
      >
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-medium text-gray-800">{task.title}</h3>
          {!isHistory && (
            <div className="flex gap-1">
              <button
                onClick={() => setEditingTask({ ...task })}
                className="p-1 text-blue-500 hover:bg-blue-50 rounded"
              >
                <Edit size={16} />
              </button>
              <button
                onClick={() => handleDeleteTask(task.id)}
                className="p-1 text-red-500 hover:bg-red-50 rounded"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>
        
        {task.description && (
          <p className="text-sm text-gray-600 mb-2">{task.description}</p>
        )}
        
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-3">
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
              onClick={() => setShowAddForm(true)}
              className="w-full mb-6 py-3 px-4 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={20} />
              Add New Task
            </button>

            {/* Add Task Form */}
            {showAddForm && (
              <div ref={addFormRef} className="bg-white border border-gray-200 rounded-lg p-6 mb-6 shadow-sm">
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
                    onChange={(e) => setNewTask(prev => ({ ...prev, reward_point: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm"
                    placeholder="Reward points (e.g., 5)"
                    min="1"
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
                      onClick={handleAddTask}
                      className="flex-1 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                    >
                      Create Task
                    </button>
                    <button
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
              </div>
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

      <BottomNav onSettingsClick={onNavigateToSettings} onHomeClick={onNavigateToHome} />
    </div>
  );
}
