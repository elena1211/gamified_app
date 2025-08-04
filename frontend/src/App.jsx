import { useState, useEffect } from 'react'
import React from 'react';

function App() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Load tasks automatically when page loads
  useEffect(() => {
    fetchTasks()
  }, [])

  const fetchTasks = async () => {
    try {
      setLoading(true)
      const response = await fetch('http://127.0.0.1:8001/api/tasks/')
      if (response.ok) {
        const data = await response.json()
        setTasks(data)
        setError(null)
      } else {
        setError('Unable to fetch task data')
      }
    } catch (err) {
      setError('Connection error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleTask = (taskId) => {
    setTasks(tasks.map(task => 
      task.id === taskId 
        ? { ...task, completed: !task.completed }
        : task
    ))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-400 via-blue-500 to-green-400 flex items-center justify-center">
        <div className="text-white text-xl">🎮 Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-400 via-blue-500 to-green-400 flex items-center justify-center">
        <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg">
          ❌ {error}
          <button 
            onClick={fetchTasks}
            className="ml-4 bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const completedTasks = tasks.filter(task => task.completed).length
  const totalTasks = tasks.length

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-400 via-blue-500 to-green-400">
      <div className="container mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            🎮 Level Up
          </h1>
          <p className="text-white/80 text-lg">
            Complete tasks, gain experience, level up your life!
          </p>
        </div>

        {/* Progress Statistics */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 mb-8 text-white">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{completedTasks}/{totalTasks}</div>
              <div className="text-white/80">Tasks Completed</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {tasks.reduce((exp, task) => exp + (task.completed ? 5 : 0), 0)}
              </div>
              <div className="text-white/80">Experience Gained</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {Math.floor(tasks.reduce((exp, task) => exp + (task.completed ? 5 : 0), 0) / 100) + 1}
              </div>
              <div className="text-white/80">Current Level</div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="w-full bg-white/20 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-yellow-400 to-orange-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${(completedTasks / totalTasks) * 100}%` }}
              ></div>
            </div>
            <div className="text-center mt-2 text-white/80 text-sm">
              Completion Progress: {Math.round((completedTasks / totalTasks) * 100)}%
            </div>
          </div>
        </div>

        {/* Task List */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {tasks.map(task => (
            <div 
              key={task.id} 
              className={`bg-white/10 backdrop-blur-md rounded-xl p-6 border-2 transition-all duration-300 hover:scale-105 ${
                task.completed 
                  ? 'border-green-400 bg-green-500/20' 
                  : 'border-white/20 hover:border-white/40'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-xl font-bold text-white pr-4">
                  {task.title}
                </h3>
                <button
                  onClick={() => toggleTask(task.id)}
                  className={`flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                    task.completed 
                      ? 'bg-green-500 border-green-500 text-white' 
                      : 'border-white/40 hover:border-white text-white hover:bg-white/10'
                  }`}
                >
                  {task.completed && '✓'}
                </button>
              </div>
              
              <div className="mb-4">
                <p className="text-white/80 text-sm mb-2">💡 Tip:</p>
                <p className="text-white text-sm">{task.tip}</p>
              </div>
              
              <div className="mb-4">
                <p className="text-green-300 font-medium text-sm">
                  🏆 Reward: {task.reward}
                </p>
              </div>
              
              <div className="flex justify-between items-center">
                <span 
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    task.completed 
                      ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                      : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                  }`}
                >
                  {task.completed ? '✅ Completed' : '⏳ In Progress'}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Refresh Button */}
        <div className="text-center mt-8">
          <button 
            onClick={fetchTasks}
            className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl border border-white/20 backdrop-blur-md transition-all duration-300 hover:scale-105"
          >
            🔄 Refresh Tasks
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;