import { useState } from 'react'
import type { ViewMode } from './types'
import GlobeView from './components/GlobeView'
import TimelineView from './components/TimelineView'

export default function App() {
  const [view, setView] = useState<ViewMode>('globe')

  return (
    <div className="w-full h-full flex flex-col bg-[#0a0a0f]">
      {/* Top nav */}
      <header className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-white/10 bg-black/60 backdrop-blur-sm z-30">
        <div className="flex items-center gap-3">
          <span className="text-base font-bold text-white tracking-tight">
            History of the World
          </span>
          <span className="text-xs text-slate-600 hidden sm:inline">
            Explore any place, any time
          </span>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1 border border-white/10">
          <button
            onClick={() => setView('globe')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all cursor-pointer ${
              view === 'globe'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Globe
          </button>
          <button
            onClick={() => setView('timeline')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all cursor-pointer ${
              view === 'timeline'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Timeline
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 relative overflow-hidden">
        {view === 'globe' ? <GlobeView /> : <TimelineView />}
      </main>
    </div>
  )
}
