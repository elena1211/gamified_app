import { useState, useEffect } from 'react'

function TaskList() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // 從 Django API 獲取任務數據
    fetch('http://127.0.0.1:8001/api/tasks/')
      .then(response => {
        if (!response.ok) {
          throw new Error('網絡請求失敗')
        }
        return response.json()
      })
      .then(data => {
        setTasks(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="text-lg text-gray-600">載入中...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        錯誤: {error}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">🎮 遊戲化任務系統</h1>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tasks.map(task => (
          <div 
            key={task.id} 
            className={`p-6 rounded-lg border-2 transition-all hover:shadow-lg ${
              task.completed 
                ? 'bg-green-50 border-green-200' 
                : 'bg-white border-gray-200 hover:border-blue-300'
            }`}
          >
            <h3 className="text-xl font-semibold mb-3">{task.title}</h3>
            
            <div className="mb-4">
              <p className="text-gray-600 text-sm">💡 提示:</p>
              <p className="text-gray-700">{task.tip}</p>
            </div>
            
            <div className="mb-4">
              <p className="text-green-600 font-medium">🏆 獎勵: {task.reward}</p>
            </div>
            
            <div className="flex justify-between items-center">
              <span 
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  task.completed 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {task.completed ? '✅ 已完成' : '⏳ 進行中'}
              </span>
              
              {!task.completed && (
                <button 
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
                  onClick={() => {
                    // 這裡可以添加完成任務的邏輯
                    console.log('完成任務:', task.id)
                  }}
                >
                  完成任務
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {tasks.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">暫無任務數據</p>
        </div>
      )}
    </div>
  )
}

export default TaskList
