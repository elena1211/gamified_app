import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Edit, Trash2, CheckCircle, Save, X } from 'lucide-react';
import { API_ENDPOINTS, apiRequest, getAuthHeaders } from '../config/api.js';
import BottomNav from '../components/BottomNav';
import RewardPopup from '../components/RewardPopup';
import WeeklyTaskStats from '../components/WeeklyTaskStats';
import LevelUpModal from '../components/LevelUpModal';
import Modal from '../components/Modal';
import { useAppContext } from '../context/AppContext';
import { getAvatarStage } from '../utils/avatar';
import { debugLog } from '../utils/logger';
import { cleanTaskTitle } from '../utils/taskUtils';

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
      <div className="rpg-window mb-3 p-4" style={{ minHeight: '200px' }}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={editData.title}
            onChange={(e) => { e.preventDefault(); onEditDataChange('title', e.target.value); }}
            className="rpg-input text-sm"
            placeholder="Task title"
          />
          <input
            type="text"
            value={editData.description}
            onChange={(e) => { e.preventDefault(); onEditDataChange('description', e.target.value); }}
            className="rpg-input text-sm"
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
            className="rpg-input text-sm"
            placeholder="Reward points (1–5)"
            min="1"
            max="5"
          />
          <div className="flex gap-2">
            <select
              value={editData.difficulty}
              onChange={(e) => { e.preventDefault(); onEditDataChange('difficulty', parseInt(e.target.value)); }}
              className="rpg-select flex-1 text-sm"
            >
              {difficultyOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select
              value={editData.attribute}
              onChange={(e) => { e.preventDefault(); onEditDataChange('attribute', e.target.value); }}
              className="rpg-select flex-1 text-sm"
            >
              {attributeOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.emoji} {opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="rpg-btn-sage flex-1 text-sm py-2">
              <Save size={13} /> Save
            </button>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCancelEdit(e); }}
              className="rpg-btn-secondary flex-1 text-sm py-2"
            >
              <X size={13} /> Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="rpg-window-light mb-3 p-4" style={{ minHeight: '100px' }}>
      <div className="h-full flex flex-col">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-sm font-semibold text-ink flex-1 pr-2 leading-snug">
            {cleanTaskTitle(task.title)}
          </h3>
          {!isHistory && (
            <div className="flex gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onComplete(task, e); }}
                className="p-1 rounded transition-colors hover:bg-[var(--paper-shadow)]"
                style={{ color: 'var(--accent-sage)' }}
                title="Complete quest"
                aria-label="Complete quest"
              >
                <CheckCircle size={16} />
              </button>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onStartEdit(task, e); }}
                className="p-1 rounded transition-colors hover:bg-[var(--paper-shadow)]"
                style={{ color: 'var(--ink-soft)' }}
                title="Edit quest"
                aria-label="Edit quest"
              >
                <Edit size={16} />
              </button>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(task, e); }}
                className="p-1 rounded transition-colors hover:bg-[var(--paper-shadow)]"
                style={{ color: 'var(--accent-rust)' }}
                title="Delete quest"
                aria-label="Delete quest"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>

        {task.description && (
          <p className="text-xs text-ink-soft mb-3 flex-1 italic">{task.description}</p>
        )}

        <div className="flex items-center gap-3 mt-auto text-xs">
          <span className="text-ink-mute">{difficulty?.label}</span>
          <span className="text-ink-mute">{attribute?.emoji} {attribute?.label}</span>
          <span className="ml-auto font-semibold" style={{ color: 'var(--accent-sage)' }}>
            {/* Completed-history items never carry a `reward` string (only
                TaskListView/TaskDetailView do) — fall back to the same
                reward_point // 2 math the backend uses, not the raw value. */}
            {task.reward || `+${Math.floor((task.reward_point || 0) / 2)} ${attribute?.label}`}
          </span>
        </div>

        {isHistory && task.completedAt && (
          <div className="mt-2 text-xs text-ink-mute flex justify-between">
            <span>Completed: {task.completedAt}</span>
            {task.completedTime && <span>{task.completedTime}</span>}
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

  // In-app confirmation for Complete/Delete — replaces window.confirm(),
  // which is a native browser dialog that looks nothing like the rest of
  // the app and blocks all page interaction (including unrelated buttons)
  // until it's dismissed, easy to miss and mistake for the page being stuck.
  const [confirmModal, setConfirmModal] = useState(null); // { type: 'complete' | 'delete', task }

  // RewardPopup state
  const [showRewardPopup, setShowRewardPopup] = useState(false);
  const [rewardData, setRewardData] = useState({
    taskTitle: '',
    rewardPoints: 0,
    attribute: 'discipline',
    totalPoints: 0
  });

  // Level up modal states
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [levelUpData, setLevelUpData] = useState({
    oldLevel: 0,
    newLevel: 0,
    newExp: 0,
    oldStage: 1,
    newStage: 1
  });

  const addFormRef = useRef(null);
  // Ids with a DELETE in flight — blocks a double-click from sending a second
  // request that would 404 and show a misleading failure alert.
  const deletingIds = useRef(new Set());
  // Ids with a complete POST in flight — same double-submit guard as
  // deletingIds, needed now that the confirm modal doesn't block the thread.
  const completingIds = useRef(new Set());
  // Ids with a PUT in flight — blocks a double Save click from firing a
  // second concurrent edit request for the same task.
  const savingIds = useRef(new Set());
  // True while a POST to create a task is in flight — blocks a double
  // "Create Quest" click from creating two identical tasks.
  const addingTask = useRef(false);

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
      debugLog('Tasks already loaded, skipping fetch');
      return;
    }

    setLoading(true);
    try {
      // Fetch tasks from backend
      const { data } = await apiRequest(API_ENDPOINTS.tasks);
      debugLog('✅ Successfully fetched', data.length, 'tasks from backend:', data);

      // Transform backend data to match our component structure.
      // reward_point is the raw, editable value straight from the backend —
      // it must NOT be reconstructed from the "reward" display string, which
      // is already halved (reward_point // 2, the amount actually granted to
      // the primary attribute; the other half is implicit "budget", plus a
      // difficulty-based Discipline bonus). Regex-extracting a number back
      // out of that string and treating it as the raw value used to silently
      // halve the stored reward_point every time an edit was saved after a
      // fetch — a real, compounding data-corruption bug. `reward` (the
      // display string) is kept as-is for showing/applying the actual grant.
      const transformedTasks = data
        .filter(task => !task.completed) // Only get uncompleted tasks for active tab
        .map(task => ({
          id: task.id,
          title: task.title,
          description: task.tip || '',
          reward_point: task.reward_point ?? 0,
          reward: task.reward || '',
          difficulty: task.difficulty || 1,
          attribute: task.attribute || 'discipline'
        }));

      updateTasksState(transformedTasks);

    } catch (error) {
      console.error('❌ Error fetching tasks:', error);
      console.log('🔄 Falling back to static task data');
      // Fallback to static data if API fails
      updateTasksState([
        {id: 1, title: "🧹 Organise workspace", description: "Clean and organise your desk", reward_point: 4, reward: "+2 Discipline", difficulty: 1, attribute: "discipline"},
        {id: 2, title: "📝 Write journal entry", description: "Reflect on today's experiences", reward_point: 3, reward: "+1 Discipline", difficulty: 1, attribute: "discipline"},
        {id: 3, title: "🏃‍♂️ 30-minute workout", description: "Include cardio and strength training", reward_point: 5, reward: "+2 Energy, +1 Discipline", difficulty: 2, attribute: "energy"},
        {id: 4, title: "📚 Learn something new", description: "Read an educational article or watch a tutorial", reward_point: 4, reward: "+2 Intelligence", difficulty: 1, attribute: "intelligence"},
        {id: 5, title: "🧘‍♀️ Meditation session", description: "10 minutes of mindfulness meditation", reward_point: 3, reward: "+1 Energy", difficulty: 1, attribute: "energy"}
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompletedHistory = async () => {
    try {
      debugLog('🔍 Fetching completed tasks history from API...');
      const { data } = await apiRequest(`${API_ENDPOINTS.completedHistory}?limit=50`);

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
        debugLog('✅ Loaded', transformedHistory.length, 'completed tasks from API');
      } else {
        debugLog('⚠️ No completed tasks found in API response');
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
  }, [currentUser]); // Remove function dependencies to prevent infinite re-renders

  const handleAddTask = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!newTask.title.trim() || addingTask.current) {
      return;
    }

    addingTask.current = true;
    try {
      // apiRequest (not raw fetch) so a validation failure's specific
      // message (e.g. "Title must be 150 characters or fewer") reaches the
      // alert below instead of a bare HTTP status code.
      const { data: createdTask } = await apiRequest(API_ENDPOINTS.tasks, {
        method: 'POST',
        body: JSON.stringify(newTask),
      });

      // Transform the response to match our component structure. Use the
      // raw reward_point the backend echoes back, not a reconstruction from
      // the (already halved) display string — see fetchAllTasks for why.
      const transformedTask = {
        id: createdTask.id,
        title: createdTask.title,
        description: createdTask.tip || '',
        reward_point: createdTask.reward_point ?? 0,
        reward: createdTask.reward || '',
        difficulty: createdTask.difficulty || 1,
        attribute: createdTask.attribute || 'discipline'
      };

      updateTasksState(prev => [...prev, transformedTask]);
      setNewTask({ title: '', description: '', reward_point: '', difficulty: 1, attribute: 'discipline' });
      setShowAddForm(false);

    } catch (error) {
      console.error('Error adding task:', error);
      // Show user-friendly error message
      alert(`Error creating task: ${error.message}`);
      // Don't hide the form so user can try again
    } finally {
      addingTask.current = false;
    }
  };

  const handleEditTask = async (taskId, updatedData) => {
    if (savingIds.current.has(taskId)) return;
    savingIds.current.add(taskId);
    try {
      // Persist first, then update the list — a locally-only edit used to
      // reappear as the pre-edit version on the next reload.
      const { data } = await apiRequest(`${API_ENDPOINTS.tasks}${taskId}/`, {
        method: 'PUT',
        body: JSON.stringify(updatedData),
      });
      // Merge the server's response, not the raw form data — it recomputes
      // `reward` (the display string) from the edited values, which a plain
      // merge of updatedData would leave stale until the next full fetch.
      // Functional update — a concurrent delete of another task (which reads
      // live state) could otherwise be clobbered by this request resolving
      // against the stale `tasks` snapshot captured when editing started.
      updateTasksState(prev => prev.map(task =>
        task.id === taskId
          ? { ...task, title: data.title, description: data.tip || '', reward_point: data.reward_point ?? 0, reward: data.reward || '', difficulty: data.difficulty, attribute: data.attribute }
          : task
      ));
      setEditingTask(null);
      setEditData(null);
    } catch (error) {
      console.error('Error editing task:', error);
      alert(`Failed to save changes: ${error.message}. Please try again.`);
    } finally {
      savingIds.current.delete(taskId);
    }
  };

  const handleCompleteTask = (task, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (completingIds.current.has(task.id)) return;
    setConfirmModal({ type: 'complete', task });
  };

  const performCompleteTask = async (task) => {
    // The confirm modal closes as soon as it's clicked (unlike the old
    // blocking window.confirm()), so a fast second click could otherwise
    // fire a second POST while the first is still in flight — and the
    // backend endpoint toggles completion on/off, so a second call doesn't
    // just double the reward, it silently reverses it server-side while the
    // UI shows two "completed" entries.
    if (completingIds.current.has(task.id)) return;
    completingIds.current.add(task.id);
    try {
      debugLog('🎯 Attempting to complete task:', task.id, task.title);

      const response = await fetch(API_ENDPOINTS.taskComplete, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ task_id: task.id }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      debugLog('📡 Backend response:', data);

      if (data.success) {
        const completedTask = {
          ...task,
          completedAt: new Date().toISOString().split('T')[0]
        };

        // Use the backend's own reward string — it's already the exact
        // amount granted (reward_point // 2 to the primary attribute, plus
        // any difficulty-based Discipline bonus), matching what the server
        // actually applied. Reconstructing "+{reward_point} {attribute}"
        // from the raw value here would overstate the grant (reward_point
        // is a budget, not the granted amount) and silently drop the
        // difficulty bonus. Every task now carries `reward` from the
        // backend, so the fallback only matters for the static mock data
        // used when the API is unreachable — mirror the same //2 math there
        // rather than the raw value, to stay consistent.
        const rewardString = task.reward || `+${Math.floor((task.reward_point || 0) / 2)} ${task.attribute}`;
        applyStatChanges(rewardString);

        // Check for level up from API response
        if (data.user_stats && data.user_stats.level_up) {
          debugLog('🎉 Level up detected in TaskManager!', data.user_stats);
          const oldStage = getAvatarStage(data.user_stats.old_level);
          const newStage = getAvatarStage(data.user_stats.level);

          setLevelUpData({
            oldLevel: data.user_stats.old_level,
            newLevel: data.user_stats.level,
            newExp: data.user_stats.exp,
            oldStage,
            newStage
          });
          setShowLevelUpModal(true);
        }

        // Update user stats with level and EXP data
        if (data.user_stats) {
          updateUserStats({
            currentStreak: data.streak,
            level: data.user_stats.level,
            exp: data.user_stats.exp
          });
        } else {
          updateUserStats({ currentStreak: data.streak || 0 });
        }

        // RewardPopup shows a single number for the primary attribute —
        // reward_point // 2 is what's actually granted to it (see the note
        // on applyStatChanges above), not the raw reward_point.
        const primaryAttrGrant = Math.floor((task.reward_point || 0) / 2);
        const newTotalPoints = getAttributePoints(task.attribute) + primaryAttrGrant;

        // Show reward popup with updated stats
        setRewardData({
          taskTitle: task.title,
          rewardPoints: primaryAttrGrant,
          attribute: task.attribute,
          totalPoints: newTotalPoints,
          currentStreak: data.streak || 0
        });
        setShowRewardPopup(true);

        // Update task lists - move task from active to completed.
        // Functional updates — this fires from an unawaited async call
        // (the confirm modal closes immediately), so another task's
        // complete/delete could resolve first and change `tasks`/
        // `completedTasks` before this one finishes; reading the closure
        // value here would silently clobber that change.
        updateTasksState(prev => prev.filter(t => t.id !== task.id));
        updateCompletedTasksState(prev => [completedTask, ...prev]);

        debugLog('✅ Task completed successfully, refreshing weekly stats in 0.5s');

        // Delay refresh to ensure backend has processed the completion
        setTimeout(() => {
          setRefreshTrigger(prev => prev + 1);
          debugLog('🔄 Weekly stats refresh triggered');
        }, 500);

        debugLog('📈 Applied stat changes:', rewardString);
      } else {
        throw new Error(data.message || 'Failed to complete task');
      }
    } catch (error) {
      console.error('Error completing task:', error);
      alert(`Failed to complete task: ${error.message}. Please try again.`);
    } finally {
      completingIds.current.delete(task.id);
    }
  };

  const handleDeleteTask = (task, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (deletingIds.current.has(task.id)) return;
    setConfirmModal({ type: 'delete', task });
  };

  const performDeleteTask = async (taskId) => {
    if (deletingIds.current.has(taskId)) return;
    deletingIds.current.add(taskId);
    try {
      // Persist first, then update the list — a delete that only touched
      // local state used to reappear on the next reload.
      await apiRequest(`${API_ENDPOINTS.tasks}${taskId}/`, { method: 'DELETE' });
      updateTasksState(prev => prev.filter(task => task.id !== taskId));
    } catch (error) {
      // "Task not found" means it's already gone server-side (e.g. the
      // cold-start retry resent a DELETE that had in fact succeeded) —
      // that's a completed deletion, not a failure.
      if (error.message === 'Task not found') {
        updateTasksState(prev => prev.filter(task => task.id !== taskId));
      } else {
        console.error('Error deleting task:', error);
        alert(`Failed to delete task: ${error.message}. Please try again.`);
      }
    } finally {
      deletingIds.current.delete(taskId);
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
      <div className="paper-bg min-h-screen flex items-center justify-center">
        <p className="text-ink-soft font-display text-lg tracking-wide animate-pulse">
          Loading Quest Log…
        </p>
      </div>
    );
  }

  return (
    <div className="paper-bg min-h-screen pb-20 page-enter">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-5">
        {/* Page header */}
        <header>
          <h1 className="font-display text-2xl text-ink tracking-wide mb-0.5">Quest Log</h1>
          <p className="text-sm text-ink-mute">Manage your quests and track your progress</p>
        </header>

        {/* Weekly diary */}
        <div className="rpg-window">
          <div className="rpg-header">This Week's Diary</div>
          <WeeklyTaskStats currentUser={currentUser} refreshTrigger={refreshTrigger} />
        </div>

        {/* Tab switcher */}
        <div
          className="rpg-window-light flex p-1 gap-1"
        >
          {[
            { id: 'active', label: `Active Quests (${tasks.length})` },
            { id: 'history', label: `Completed History (${completedTasks.length})` },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'history' && completedTasks.length === 0) fetchCompletedHistory();
              }}
              className="flex-1 py-2 px-3 rounded-sm text-xs font-semibold uppercase tracking-wider transition-colors"
              style={
                activeTab === tab.id
                  ? { background: 'var(--frame)', color: 'var(--paper)' }
                  : { color: 'var(--ink-soft)' }
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'active' && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="rpg-btn-primary w-full"
            >
              <Plus size={16} /> Add New Quest
            </button>

            {showAddForm && (
              <div className="rpg-window">
                <div className="rpg-header">Create New Quest</div>
                <form onSubmit={handleAddTask} ref={addFormRef} className="px-5 py-4 space-y-3">
                  <input
                    type="text"
                    value={newTask.title}
                    onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                    className="rpg-input"
                    placeholder="Quest title (e.g., 30-minute workout)"
                    maxLength={150}
                  />
                  <input
                    type="text"
                    value={newTask.description}
                    onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                    className="rpg-input"
                    placeholder="Description or tip"
                    maxLength={500}
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
                    className="rpg-input"
                    placeholder="Reward points (1–5)"
                    min="1"
                    max="5"
                  />
                  <div className="flex gap-3">
                    <select
                      value={newTask.difficulty}
                      onChange={(e) => setNewTask(prev => ({ ...prev, difficulty: parseInt(e.target.value) }))}
                      className="rpg-select flex-1"
                    >
                      {difficultyOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <select
                      value={newTask.attribute}
                      onChange={(e) => setNewTask(prev => ({ ...prev, attribute: e.target.value }))}
                      className="rpg-select flex-1"
                    >
                      {attributeOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.emoji} {opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-3 pt-1">
                    <button type="submit" className="rpg-btn-sage flex-1">Create Quest</button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddForm(false);
                        setNewTask({ title: '', description: '', reward_point: '', difficulty: 1, attribute: 'discipline' });
                      }}
                      className="rpg-btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div>
              <h2 className="font-display text-base text-ink mb-3">Active Quests</h2>
              {tasks.length === 0 ? (
                <p className="text-center py-8 text-sm text-ink-mute italic">
                  No active quests — create your first one above!
                </p>
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
            <h2 className="font-display text-base text-ink mb-3">Completed History</h2>
            {completedTasks.length === 0 ? (
              <div className="text-center py-8 text-ink-mute">
                <CheckCircle size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm italic">No completed quests yet — get going!</p>
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

      {/* Level Up Modal */}
      <LevelUpModal
        isOpen={showLevelUpModal}
        onClose={() => setShowLevelUpModal(false)}
        oldLevel={levelUpData.oldLevel}
        newLevel={levelUpData.newLevel}
        newExp={levelUpData.newExp}
        oldStage={levelUpData.oldStage}
        newStage={levelUpData.newStage}
      />

      {/* Complete/Delete confirmation — in-app modal instead of window.confirm() */}
      {confirmModal && (
        <Modal
          isOpen={true}
          onClose={() => setConfirmModal(null)}
          onConfirm={() => {
            if (confirmModal.type === 'complete') performCompleteTask(confirmModal.task);
            else performDeleteTask(confirmModal.task.id);
            setConfirmModal(null);
          }}
          title={confirmModal.type === 'complete' ? 'Complete Quest?' : 'Delete Quest?'}
          message={
            confirmModal.type === 'complete'
              ? `Complete "${cleanTaskTitle(confirmModal.task.title)}"?`
              : `Are you sure you want to delete "${cleanTaskTitle(confirmModal.task.title)}"?`
          }
          confirmText={confirmModal.type === 'complete' ? 'Complete' : 'Delete'}
          type={confirmModal.type === 'complete' ? 'success' : 'danger'}
        />
      )}
    </div>
  );
}
