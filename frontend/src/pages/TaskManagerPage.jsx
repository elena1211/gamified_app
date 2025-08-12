import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Edit, Trash2, Clock, CheckCircle, XCircle, Save, X } from 'lucide-react';
import { API_ENDPOINTS, apiRequest } from '../config/api.js';
import BottomNav from '../components/BottomNav';
import RewardPopup from '../components/RewardPopup';
import WeeklyTaskStats from '../components/WeeklyTaskStats';
import { useAppContext } from '../context/AppContext';

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
          <div className="mt-2 text-xs text-gray-500 flex justify-between">
            <span>Completed: {task.completedAt}</span>
            {task.completedTime && <span>Time: {task.completedTime}</span>}
          </div>
        )}
      </div>
    </div>
  );
};

export default function TaskManagerPage({ currentUser, onNavigateToHome, onNavigateToSettings }) {
  // Use global state from context
  const { 
    tasks, 
    completedTasks, 
    updateTasksState, 
    updateCompletedTasksState,
    getAttributePoints,
    applyStatChanges,
    updateUserStats
  } = useAppContext();

  // Local state for UI only
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [editData, setEditData] = useState(null);
  const [activeTab, setActiveTab] = useState('active');
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Add refresh trigger for weekly stats
  
  // RewardPopup state
  const [showRewardPopup, setShowRewardPopup] = useState(false);
  const [rewardData, setRewardData] = useState({
    taskTitle: '',
    rewardPoints: 0,
    attribute: 'discipline',
    totalPoints: 0
  });
  
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
    { value: 'intelligence', label: 'Intelligence', emoji: '🧠' },
    { value: 'discipline', label: 'Discipline', emoji: '🎯' },
    { value: 'energy', label: 'Energy', emoji: '⚡' },
    { value: 'social', label: 'Social', emoji: '👥' },
    { value: 'wellness', label: 'Wellness', emoji: '🌟' },
    { value: 'stress', label: 'Stress', emoji: '😰' }
  ];

  const fetchAllTasks = async () => {
    // Only fetch if tasks are empty (avoid refetching on navigation)
    if (tasks.length > 0) {
      console.log('Tasks already loaded, skipping fetch');
      return;
    }

    setLoading(true);
    try {
      // Fetch tasks from backend
      const { data } = await apiRequest(`${API_ENDPOINTS.tasks}?user=${currentUser}`);
      
      // Transform backend data to match our component structure
      const transformedTasks = data
        .filter(task => !task.completed) // Only get uncompleted tasks for active tab
        .map(task => ({
          id: task.id,
          title: task.title,
          description: task.tip || '',
          reward_point: task.reward?.match(/\+(\d+)/)?.[1] || '0', // Extract points from reward string
          difficulty: task.difficulty || 1,
          attribute: task.attribute || 'discipline'
        }));
      
      updateTasksState(transformedTasks);
      
    } catch (error) {
      console.error('Error fetching tasks:', error);
      // Fallback to static data if API fails
      updateTasksState([
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

  const fetchCompletedHistory = async () => {
    try {
      console.log('🔍 Fetching completed tasks history from API...');
      const { data } = await apiRequest(`${API_ENDPOINTS.completedHistory}?user=${currentUser}&limit=50`);
      
      if (data.success && data.completed_tasks) {
        const transformedHistory = data.completed_tasks.map(task => ({
          id: task.id,
          title: task.title,
          description: task.description || '',
          reward_point: task.reward_point?.toString() || '0',
          difficulty: task.difficulty || 1,
          attribute: task.attribute || 'discipline',
          completedAt: task.completed_at,
          completedTime: task.completed_time
        }));
        
        updateCompletedTasksState(transformedHistory);
        console.log('✅ Loaded', transformedHistory.length, 'completed tasks from API');
      } else {
        console.log('⚠️ No completed tasks found in API response');
        updateCompletedTasksState([]);
      }
    } catch (error) {
      console.error('❌ Error fetching completed tasks history:', error);
      // Don't show fallback data for completed history
      updateCompletedTasksState([]);
    }
  };

  useEffect(() => {
    fetchAllTasks();
    fetchCompletedHistory();
  }, [currentUser]);

  const handleAddTask = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!newTask.title.trim()) return;

    try {
      // In a real app, you would POST to the backend to create a new task
      // For now, we'll add it locally and assign a temporary ID
      const taskData = {
        ...newTask,
        user: currentUser || 'elena',
        completed: false
      };

      const newId = Math.max(...tasks.map(t => t.id || 0)) + 1000; // Use high ID to avoid conflicts
      const createdTask = { ...taskData, id: newId };
      
      updateTasksState([...tasks, createdTask]);
      setNewTask({ title: '', description: '', reward_point: '', difficulty: 1, attribute: 'discipline' });
      setShowAddForm(false);
      
      // TODO: Implement actual API call to create task in backend
      // await apiRequest(API_ENDPOINTS.tasks, {
      //   method: 'POST',
      //   body: JSON.stringify(taskData)
      // });
      
    } catch (error) {
      console.error('Error adding task:', error);
    }
  };

  const handleEditTask = async (taskId, updatedData) => {
    try {
      updateTasksState(tasks.map(task => 
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
      console.log('🎯 Attempting to complete task:', task.id, task.title);
      
      // Call backend API to mark task as complete - use fetch instead of apiRequest for better error handling
      const response = await fetch(API_ENDPOINTS.taskComplete, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task_id: task.id,
          user: currentUser || 'elena'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('📡 Backend response:', data);
      
      if (data.success) {
        const completedTask = {
          ...task,
          completedAt: new Date().toISOString().split('T')[0]
        };
        
        // Create reward string based on task attributes
        const rewardString = `+${task.reward_point} ${task.attribute}`;
        
        // Apply stat changes to global context
        applyStatChanges(rewardString);
        
        // Update streak in global context
        updateUserStats({ currentStreak: data.streak || 0 });
        
        // Use context function to get current points for attribute
        const newTotalPoints = getAttributePoints(task.attribute) + parseInt(task.reward_point || 0);
        
        // Show reward popup with updated stats
        setRewardData({
          taskTitle: task.title,
          rewardPoints: parseInt(task.reward_point || 0),
          attribute: task.attribute,
          totalPoints: newTotalPoints,
          currentStreak: data.streak || 0
        });
        setShowRewardPopup(true);
        
        // Update task lists - move task from active to completed
        const updatedActiveTasks = tasks.filter(t => t.id !== task.id);
        const updatedCompletedTasks = [completedTask, ...completedTasks];
        
        updateTasksState(updatedActiveTasks);
        updateCompletedTasksState(updatedCompletedTasks);
        
        console.log('✅ Task completed successfully, refreshing weekly stats in 0.5s');
        
        // Delay refresh to ensure backend has processed the completion
        setTimeout(() => {
          setRefreshTrigger(prev => prev + 1);
          console.log('🔄 Weekly stats refresh triggered');
        }, 500);
        
        console.log('📈 Applied stat changes:', rewardString);
        console.log('📋 Updated task lists - Active:', updatedActiveTasks.length, 'Completed:', updatedCompletedTasks.length);
      } else {
        throw new Error(data.message || 'Failed to complete task');
      }
    } catch (error) {
      console.error('❌ Error completing task:', error);
      alert(`Failed to complete task: ${error.message}. Please try again.`);
    }
  };

  const handleDeleteTask = async (taskId, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
      updateTasksState(tasks.filter(task => task.id !== taskId));
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

        {/* Weekly Stats Component */}
        <div className="mb-6">
          <WeeklyTaskStats currentUser={currentUser} refreshTrigger={refreshTrigger} />
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
            onClick={() => {
              setActiveTab('history');
              // Load completed history when switching to history tab
              if (completedTasks.length === 0) {
                fetchCompletedHistory();
              }
            }}
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

      <RewardPopup
        isVisible={showRewardPopup}
        onClose={() => setShowRewardPopup(false)}
        taskTitle={rewardData.taskTitle}
        rewardPoints={rewardData.rewardPoints}
        attribute={rewardData.attribute}
        totalPoints={rewardData.totalPoints}
      />
    </div>
  );
}
