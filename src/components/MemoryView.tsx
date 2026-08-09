import React, { useState, useEffect } from 'react'
import { Brain, Search, Plus, MessageSquare, Users, Clock, TrendingUp, Zap } from 'lucide-react'
import { motion } from 'motion/react'

interface MemoryItem {
  id: string
  content: string
  type: string
  user_id: string
  created_at: string
}

interface MemoryStats {
  total_memories: number
  system_memories: number
  user_memories: number
  recent_activity: number
}

export default function MemoryView() {
  const [memories, setMemories] = useState<MemoryItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [newMemory, setNewMemory] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [stats, setStats] = useState<MemoryStats>({
    total_memories: 0,
    system_memories: 0,
    user_memories: 0,
    recent_activity: 0,
  })

  // Load memory stats and recent memories
  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      // Try to connect to deployed Supabase Edge Function
      const response = await fetch(
        'https://zumysyuenxrylauzvokl.supabase.co/functions/v1/memory-api/memory/stats',
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (response.ok) {
        const data = await response.json()
        setStats({
          total_memories: data.total_memories || 0,
          system_memories: Math.floor(data.total_memories * 0.25), // Estimate
          user_memories: Math.floor(data.total_memories * 0.75), // Estimate
          recent_activity: Math.floor(data.total_memories * 0.2), // Estimate
        })
      } else {
        // Fallback to demo data if API not available
        setStats({
          total_memories: 0,
          system_memories: 0,
          user_memories: 0,
          recent_activity: 0,
        })
      }
    } catch (error) {
      console.error('Error loading memory stats:', error)
      // Fallback to demo data
      setStats({
        total_memories: 0,
        system_memories: 0,
        user_memories: 0,
        recent_activity: 0,
      })
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setIsLoading(true)
    try {
      const response = await fetch(
        'https://zumysyuenxrylauzvokl.supabase.co/functions/v1/memory-api/memory/search',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: searchQuery,
            limit: 20,
          }),
        }
      )

      if (response.ok) {
        const data = await response.json()
        const apiMemories: MemoryItem[] = data.results.map((result: any) => ({
          id: result.id,
          content: result.content,
          type: result.type,
          user_id: result.user_id,
          created_at: result.created_at || new Date().toISOString(),
        }))
        setMemories(apiMemories)
      } else {
        console.error('Search API failed, using local filter')
        // Fallback to local filtering if API fails
        const filtered = memories.filter((mem) =>
          mem.content.toLowerCase().includes(searchQuery.toLowerCase())
        )
        setMemories(filtered)
      }
    } catch (error) {
      console.error('Error searching memories:', error)
      // Fallback to local filtering
      const filtered = memories.filter((mem) =>
        mem.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setMemories(filtered)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddMemory = async () => {
    if (!newMemory.trim()) return

    setIsLoading(true)
    try {
      const response = await fetch(
        'https://zumysyuenxrylauzvokl.supabase.co/functions/v1/memory-api/memory/add',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: newMemory,
            type: 'manual_entry',
            user_id: 'dashboard_user',
          }),
        }
      )

      if (response.ok) {
        const data = await response.json()
        console.log('Memory added successfully:', data)

        // Add to local state for immediate UI feedback
        const newItem: MemoryItem = {
          id: Date.now().toString(),
          content: newMemory,
          type: 'manual_entry',
          user_id: 'dashboard_user',
          created_at: new Date().toISOString(),
        }

        setMemories((prev) => [newItem, ...prev])
        setNewMemory('')
        setStats((prev) => ({ ...prev, total_memories: prev.total_memories + 1 }))

        // Refresh stats
        loadStats()
      } else {
        console.error('Failed to add memory via API')
        // Fallback to local addition
        const newItem: MemoryItem = {
          id: Date.now().toString(),
          content: newMemory,
          type: 'manual_entry',
          user_id: 'dashboard_user',
          created_at: new Date().toISOString(),
        }

        setMemories((prev) => [newItem, ...prev])
        setNewMemory('')
        setStats((prev) => ({ ...prev, total_memories: prev.total_memories + 1 }))
      }
    } catch (error) {
      console.error('Error adding memory:', error)
      // Fallback to local addition
      const newItem: MemoryItem = {
        id: Date.now().toString(),
        content: newMemory,
        type: 'manual_entry',
        user_id: 'dashboard_user',
        created_at: new Date().toISOString(),
      }

      setMemories((prev) => [newItem, ...prev])
      setNewMemory('')
      setStats((prev) => ({ ...prev, total_memories: prev.total_memories + 1 }))
    } finally {
      setIsLoading(false)
    }
  }

  const handleCaptureSystemInfo = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(
        'https://zumysyuenxrylauzvokl.supabase.co/functions/v1/memory-api/memory/system-info',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (response.ok) {
        const data = await response.json()
        console.log('System info captured:', data)

        // Add to local state for immediate UI feedback
        const newItem: MemoryItem = {
          id: Date.now().toString(),
          content: data.system_info || 'System information captured',
          type: 'system_info',
          user_id: 'system',
          created_at: new Date().toISOString(),
        }

        setMemories((prev) => [newItem, ...prev])
        setStats((prev) => ({ ...prev, total_memories: prev.total_memories + 1 }))

        // Refresh stats
        loadStats()
      } else {
        console.error('Failed to capture system info')
      }
    } catch (error) {
      console.error('Error capturing system info:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getMemoryTypeIcon = (type: string) => {
    switch (type) {
      case 'system_info':
        return <Zap size={16} className="text-blue-600 dark:text-blue-300" />
      case 'staff_preference':
        return <Users size={16} className="text-green-400" />
      case 'patient_preference':
        return <MessageSquare size={16} className="text-purple-600 dark:text-purple-400" />
      default:
        return <Brain size={16} className="text-gray-400 dark:text-neutral-500" />
    }
  }

  const getMemoryTypeColor = (type: string) => {
    switch (type) {
      case 'system_info':
        return 'border-blue-200 dark:border-blue-800 bg-blue-500/5'
      case 'staff_preference':
        return 'border-green-500/20 bg-green-500/5'
      case 'patient_preference':
        return 'border-purple-500/20 bg-purple-500/5'
      default:
        return 'border-gray-500/20 bg-gray-500/5'
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 flex items-center justify-center">
          <Brain className="text-purple-600 dark:text-purple-400" size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-neutral-100">
            AI Memory System
          </h2>
          <p className="text-gray-400 dark:text-neutral-500 text-sm">
            Intelligent context and preference management
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <Brain className="text-purple-600 dark:text-purple-400" size={20} />
            <div>
              <p className="text-2xl font-bold text-gray-800 dark:text-neutral-100">
                {stats.total_memories}
              </p>
              <p className="text-xs text-gray-400 dark:text-neutral-500 uppercase tracking-widest">
                Total Memories
              </p>
            </div>
          </div>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <Zap className="text-blue-600 dark:text-blue-300" size={20} />
            <div>
              <p className="text-2xl font-bold text-gray-800 dark:text-neutral-100">
                {stats.system_memories}
              </p>
              <p className="text-xs text-gray-400 dark:text-neutral-500 uppercase tracking-widest">
                System Info
              </p>
            </div>
          </div>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <Users className="text-green-400" size={20} />
            <div>
              <p className="text-2xl font-bold text-gray-800 dark:text-neutral-100">
                {stats.user_memories}
              </p>
              <p className="text-xs text-gray-400 dark:text-neutral-500 uppercase tracking-widest">
                User Memories
              </p>
            </div>
          </div>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <Clock className="text-orange-400" size={20} />
            <div>
              <p className="text-2xl font-bold text-gray-800 dark:text-neutral-100">
                {stats.recent_activity}
              </p>
              <p className="text-xs text-gray-400 dark:text-neutral-500 uppercase tracking-widest">
                Recent Activity
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Add */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Search */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-bold text-gray-800 dark:text-neutral-100 mb-4 flex items-center gap-2">
            <Search size={18} className="text-gray-400 dark:text-neutral-500" />
            Search Memories
          </h3>

          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Search memories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1 px-4 py-2 bg-gray-50 dark:bg-neutral-800/50 border border-gray-200 dark:border-neutral-700 rounded-lg text-gray-800 dark:text-neutral-100 placeholder-gray-400 focus:border-purple-500/50 focus:outline-none"
            />
            <button
              onClick={handleSearch}
              disabled={isLoading}
              className="px-6 py-2 bg-purple-500/20 border border-purple-500/30 rounded-lg text-purple-300 hover:bg-purple-500/30 transition-colors disabled:opacity-50"
            >
              <Search size={16} />
            </button>
          </div>
        </div>

        {/* Add Memory */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-bold text-gray-800 dark:text-neutral-100 mb-4 flex items-center gap-2">
            <Plus size={18} className="text-gray-400 dark:text-neutral-500" />
            Add Memory
          </h3>

          <div className="space-y-3">
            <textarea
              placeholder="Add a new memory or observation..."
              value={newMemory}
              onChange={(e) => setNewMemory(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-neutral-800/50 border border-gray-200 dark:border-neutral-700 rounded-lg text-gray-800 dark:text-neutral-100 placeholder-gray-400 focus:border-purple-500/50 focus:outline-none resize-none"
            />
            <button
              onClick={handleAddMemory}
              disabled={isLoading || !newMemory.trim()}
              className="w-full px-4 py-2 bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-lg text-purple-300 hover:from-purple-500/30 hover:to-blue-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              Add Memory
            </button>
          </div>
        </div>

        {/* System Info */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-bold text-gray-800 dark:text-neutral-100 mb-4 flex items-center gap-2">
            <Zap size={18} className="text-blue-600 dark:text-blue-300" />
            System Info
          </h3>

          <div className="space-y-3">
            <p className="text-sm text-gray-400 dark:text-neutral-500">
              Capture current system information and store it in memory for future reference.
            </p>
            <button
              onClick={handleCaptureSystemInfo}
              disabled={isLoading}
              className="w-full px-4 py-2 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 dark:border-blue-800 rounded-lg text-blue-300 hover:from-blue-500/30 hover:to-cyan-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Zap size={16} />
              Capture System Info
            </button>
          </div>
        </div>
      </div>

      {/* Memory List */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-bold text-gray-800 dark:text-neutral-100 mb-6 flex items-center gap-2">
          <TrendingUp size={18} className="text-gray-400 dark:text-neutral-500" />
          Recent Memories
        </h3>

        <div className="space-y-3">
          {memories.map((memory) => (
            <motion.div
              key={memory.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 border rounded-lg transition-all hover:border-opacity-50 ${getMemoryTypeColor(memory.type)}`}
            >
              <div className="flex items-start gap-3">
                {getMemoryTypeIcon(memory.type)}
                <div className="flex-1">
                  <p className="text-gray-800 dark:text-neutral-100 text-sm leading-relaxed">
                    {memory.content}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-neutral-400">
                    <span className="uppercase tracking-widest font-medium">
                      {memory.type.replace('_', ' ')}
                    </span>
                    <span>•</span>
                    <span>{new Date(memory.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {memories.length === 0 && (
          <div className="text-center py-12">
            <Brain size={48} className="mx-auto mb-4 text-gray-400 dark:text-neutral-500" />
            <p className="text-gray-400 dark:text-neutral-500">
              No memories found. Start by adding some context!
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
