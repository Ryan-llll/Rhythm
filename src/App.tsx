import React, { useState, useEffect } from 'react';
import type { Habit, Category, CompletionLog, HabitCompletion } from './types';
import { HabitCard } from './components/HabitCard';
import { HabitDetails } from './components/HabitDetails';
import { HabitForm } from './components/HabitForm';
import { 
  Plus, Search, Download, Upload, Calendar, 
  CheckSquare, Sparkles, ChevronLeft, ChevronRight, Trash2 
} from 'lucide-react';

// Default preloaded habits (starts empty as requested)
const DEFAULT_HABITS: Habit[] = [];

// Helper to format date safely as YYYY-MM-DD
const formatDateStr = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function App() {
  // 1. Initial State Loading
  const [habits, setHabits] = useState<Habit[]>(() => {
    const local = localStorage.getItem('rhythm_habits');
    return local ? JSON.parse(local) : DEFAULT_HABITS;
  });

  const [completions, setCompletions] = useState<CompletionLog>(() => {
    const local = localStorage.getItem('rhythm_completions');
    return local ? JSON.parse(local) : {};
  });

  // Filters & Offsets
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [weekOffset, setWeekOffset] = useState(0);

  // Modals
  const [activeDetailsHabit, setActiveDetailsHabit] = useState<Habit | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editHabit, setEditHabit] = useState<Habit | undefined>(undefined);

  // 2. Sync States to LocalStorage
  useEffect(() => {
    localStorage.setItem('rhythm_habits', JSON.stringify(habits));
  }, [habits]);

  useEffect(() => {
    localStorage.setItem('rhythm_completions', JSON.stringify(completions));
  }, [completions]);

  // 3. Generate Week Dates based on Offset
  const getWeekDates = (offset: number): Date[] => {
    const today = new Date();
    const day = today.getDay(); // 0 is Sun, 1 is Mon, etc.
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Get Monday
    const monday = new Date(today);
    monday.setDate(diff + offset * 7);
    monday.setHours(0, 0, 0, 0);

    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  const weekDates = getWeekDates(weekOffset);

  // 4. Calculations for Sidebar Statistics
  const calculateStats = () => {
    let totalChecks = 0;
    
    // Total Completions
    Object.values(completions).forEach((habitComp) => {
      Object.values(habitComp).forEach((comp) => {
        if (comp.slots) {
          totalChecks += comp.slots.filter(s => s).length;
        } else {
          totalChecks += comp.count || 0;
        }
      });
    });

    // Weekly Completion Rate (current visible week)
    let totalScheduledSlots = 0;
    let completedScheduledSlots = 0;

    const isDue = (habit: Habit, date: Date): boolean => {
      const dayOfWeek = date.getDay();
      const dStr = formatDateStr(date);
      if (dStr < habit.createdAt) return false;
      if (habit.frequency.type === 'daily') return true;
      if (habit.frequency.type === 'weekly') return habit.frequency.daysOfWeek?.includes(dayOfWeek) ?? false;
      if (habit.frequency.type === 'interval') {
        const created = new Date(habit.createdAt + 'T00:00:00');
        const current = new Date(dStr + 'T00:00:00');
        const diffTime = Math.abs(current.getTime() - created.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays % (habit.frequency.intervalDays || 1) === 0;
      }
      return true;
    };

    habits.forEach((habit) => {
      weekDates.forEach((date) => {
        const dateStr = formatDateStr(date);
        if (isDue(habit, date)) {
          totalScheduledSlots += habit.timesPerDay;
          const log = completions[habit.id]?.[dateStr];
          if (log) {
            if (habit.timesPerDay > 1 && log.slots) {
              completedScheduledSlots += log.slots.filter(s => s).length;
            } else {
              completedScheduledSlots += Math.min(log.count, habit.timesPerDay);
            }
          }
        }
      });
    });

    const weeklyRate = totalScheduledSlots > 0 ? Math.round((completedScheduledSlots / totalScheduledSlots) * 100) : 0;

    // Longest Streak across all habits
    let longestStreak = 0;
    
    // Quick streak finder per habit
    const getHabitStreak = (habit: Habit): number => {
      const todayStr = formatDateStr(new Date());
      let currentStreak = 0;
      let checkDate = new Date();
      const habitCompletions = completions[habit.id] || {};

      const isCompleted = (dStr: string): boolean => {
        const comp = habitCompletions[dStr];
        if (!comp) return false;
        if (habit.timesPerDay > 1) return comp.slots?.every(s => s) ?? false;
        return comp.count > 0;
      };

      const isHabitDue = (date: Date): boolean => {
        const dayOfWeek = date.getDay();
        const dStr = formatDateStr(date);
        if (dStr < habit.createdAt) return false;
        if (habit.frequency.type === 'daily') return true;
        if (habit.frequency.type === 'weekly') return habit.frequency.daysOfWeek?.includes(dayOfWeek) ?? false;
        if (habit.frequency.type === 'interval') {
          const created = new Date(habit.createdAt + 'T00:00:00');
          const current = new Date(dStr + 'T00:00:00');
          const diffTime = Math.abs(current.getTime() - created.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return diffDays % (habit.frequency.intervalDays || 1) === 0;
        }
        return true;
      };

      let startFromToday = isCompleted(todayStr) || !isHabitDue(checkDate);
      if (!startFromToday) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = formatDateStr(yesterday);
        if (isHabitDue(yesterday) && !isCompleted(yesterdayStr)) {
          return 0;
        }
        let checkPrev = new Date(yesterday);
        let foundDueAndUncompleted = false;
        for (let i = 0; i < 30; i++) {
          if (isHabitDue(checkPrev)) {
            const checkPrevStr = formatDateStr(checkPrev);
            if (!isCompleted(checkPrevStr)) foundDueAndUncompleted = true;
            break;
          }
          checkPrev.setDate(checkPrev.getDate() - 1);
        }
        if (foundDueAndUncompleted) return 0;
      }

      let safeCount = 0;
      while (safeCount < 365) {
        const dStr = formatDateStr(checkDate);
        if (dStr < habit.createdAt) break;
        if (isHabitDue(checkDate)) {
          if (isCompleted(dStr)) {
            currentStreak++;
          } else {
            if (dStr !== todayStr) break;
          }
        }
        checkDate.setDate(checkDate.getDate() - 1);
        safeCount++;
      }
      return currentStreak;
    };

    habits.forEach((habit) => {
      const streak = getHabitStreak(habit);
      if (streak > longestStreak) longestStreak = streak;
    });

    return { totalChecks, weeklyRate, longestStreak };
  };

  const { totalChecks, weeklyRate, longestStreak } = calculateStats();

  // 5. Completion Toggle Handlers
  const handleToggleCompletion = (habitId: string, dateStr: string, slotIndex?: number) => {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    setCompletions((prev) => {
      const habitComps = { ...(prev[habitId] || {}) };
      const current = habitComps[dateStr] || { count: 0 };

      let updated: HabitCompletion;

      if (habit.timesPerDay > 1) {
        // Multi-slot
        const slots = [...(current.slots || Array(habit.timesPerDay).fill(false))];
        if (slotIndex !== undefined) {
          slots[slotIndex] = !slots[slotIndex];
        }
        const count = slots.filter(s => s).length;
        updated = { count, slots };
      } else {
        // Single slot toggle (0 or 1)
        const count = current.count > 0 ? 0 : 1;
        updated = { count };
      }

      habitComps[dateStr] = updated;
      
      const newComps = { ...prev };
      newComps[habitId] = habitComps;
      return newComps;
    });
  };

  const handleIncrementCompletion = (habitId: string, dateStr: string) => {
    setCompletions((prev) => {
      const habitComps = { ...(prev[habitId] || {}) };
      const current = habitComps[dateStr] || { count: 0 };
      
      habitComps[dateStr] = {
        count: current.count + 1,
      };

      const newComps = { ...prev };
      newComps[habitId] = habitComps;
      return newComps;
    });
  };

  const handleDecrementCompletion = (habitId: string, dateStr: string) => {
    setCompletions((prev) => {
      const habitComps = { ...(prev[habitId] || {}) };
      const current = habitComps[dateStr] || { count: 0 };
      
      if (current.count <= 0) return prev;

      habitComps[dateStr] = {
        count: Math.max(0, current.count - 1),
      };

      const newComps = { ...prev };
      newComps[habitId] = habitComps;
      return newComps;
    });
  };

  // 6. Habit Add / Edit / Delete Handlers
  const handleSaveHabit = (habitData: Omit<Habit, 'id' | 'createdAt'> & { id?: string }) => {
    if (habitData.id) {
      // Edit
      setHabits((prev) =>
        prev.map((h) =>
          h.id === habitData.id
            ? { ...h, ...habitData, slotNames: habitData.slotNames } as Habit
            : h
        )
      );
      // Update details modal reference if open
      if (activeDetailsHabit && activeDetailsHabit.id === habitData.id) {
        setActiveDetailsHabit({
          ...activeDetailsHabit,
          ...habitData,
        } as Habit);
      }
    } else {
      // Add
      const newHabit: Habit = {
        ...habitData,
        id: Math.random().toString(36).substr(2, 9),
        createdAt: formatDateStr(new Date()),
      } as Habit;
      setHabits((prev) => [...prev, newHabit]);
    }
    setShowFormModal(false);
    setEditHabit(undefined);
  };

  const handleDeleteHabit = (habitId: string) => {
    setHabits((prev) => prev.filter((h) => h.id !== habitId));
    setCompletions((prev) => {
      const copy = { ...prev };
      delete copy[habitId];
      return copy;
    });
  };

  // 7. Backup Export & Import Utilities
  const handleExportBackup = () => {
    const jsonString = JSON.stringify({ habits, completions }, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.download = `rhythm_backup_${formatDateStr(new Date())}.json`;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    
    document.body.removeChild(downloadAnchor);
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (!e.target.files || e.target.files.length === 0) return;
    
    fileReader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.habits && parsed.completions) {
          setHabits(parsed.habits);
          setCompletions(parsed.completions);
          alert("Backup imported successfully!");
        } else {
          alert("Invalid backup file structure.");
        }
      } catch (err) {
        alert("Failed to parse backup JSON file.");
      }
    };
    fileReader.readAsText(e.target.files[0]);
  };

  const handleClearAllData = () => {
    if (window.confirm("Are you sure you want to delete all habits and completions? This will reset the app.")) {
      setHabits([]);
      setCompletions({});
      localStorage.removeItem('rhythm_habits');
      localStorage.removeItem('rhythm_completions');
    }
  };

  // 8. Filtered Habit List
  const filteredHabits = habits.filter((habit) => {
    const matchesCategory = selectedCategory === 'All' || habit.category === selectedCategory;
    const matchesSearch = habit.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Dates Text Formatting
  const getWeekDatesHeaderString = () => {
    if (weekDates.length < 7) return '';
    const first = weekDates[0];
    const last = weekDates[6];
    
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${first.toLocaleDateString('en-US', options)} - ${last.toLocaleDateString('en-US', options)}, ${last.getFullYear()}`;
  };

  return (
    <div className="app-container">
      {/* Sidebar navigation and statistics */}
      <aside className="app-sidebar">
        <div className="sidebar-header">
          <div className="logo-section">
            <Sparkles size={20} className="logo-sparkle" />
            <h2 className="logo-title font-mono">Rhythm</h2>
          </div>
          <span className="app-subtitle">Habit Tracker v1.0</span>
        </div>

        {/* Global Statistics Section */}
        <div className="sidebar-section">
          <h3 className="section-label">Global Stats</h3>
          <div className="stats-box-grid">
            <div className="stat-box">
              <span className="box-val font-mono">{totalChecks}</span>
              <span className="box-lbl">Total Checks</span>
            </div>
            <div className="stat-box">
              <span className="box-val font-mono" style={{ color: 'var(--accent-color)' }}>
                {longestStreak}d
              </span>
              <span className="box-lbl">Best Streak</span>
            </div>
          </div>
          
          <div className="weekly-rate-wrapper">
            <div className="rate-text-row">
              <span className="rate-lbl">Week Completion</span>
              <span className="rate-val font-mono">{weeklyRate}%</span>
            </div>
            <div className="rate-bar-bg">
              <div 
                className="rate-bar-fill" 
                style={{ width: `${weeklyRate}%`, backgroundColor: 'var(--accent-color)' }}
              />
            </div>
          </div>
        </div>

        {/* Category Filters */}
        <div className="sidebar-section">
          <h3 className="section-label">Categories</h3>
          <div className="filter-list">
            <button 
              className={`filter-btn ${selectedCategory === 'All' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('All')}
            >
              <CheckSquare size={14} />
              <span>All Habits</span>
              <span className="filter-count font-mono">{habits.length}</span>
            </button>

            {(['Faith', 'Health', 'Study', 'Language', 'Family', 'Life'] as Category[]).map((cat) => {
              const count = habits.filter(h => h.category === cat).length;
              return (
                <button
                  key={cat}
                  className={`filter-btn filter-btn-${cat.toLowerCase()} ${selectedCategory === cat ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  <span className="category-dot" />
                  <span>{cat}</span>
                  <span className="filter-count font-mono">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Backup / Export Actions */}
        <div className="sidebar-footer">
          <button className="sidebar-action-btn" onClick={handleExportBackup}>
            <Download size={14} />
            <span>Export Backup</span>
          </button>
          
          <label className="sidebar-action-btn import-btn">
            <Upload size={14} />
            <span>Import Backup</span>
            <input 
              type="file" 
              accept=".json" 
              onChange={handleImportBackup} 
              style={{ display: 'none' }} 
            />
          </label>

          <button className="sidebar-action-btn sidebar-clear-btn" onClick={handleClearAllData}>
            <Trash2 size={14} />
            <span>Clear All Data</span>
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <main className="app-main">
        {/* Navigation & Search Row */}
        <header className="main-header">
          <div className="search-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search habits..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          <button 
            className="btn btn-primary"
            onClick={() => {
              setEditHabit(undefined);
              setShowFormModal(true);
            }}
          >
            <Plus size={16} />
            New Habit
          </button>
        </header>

        {/* Week navigation controller */}
        <div className="week-controller-bar">
          <div className="week-range-title">
            <Calendar size={18} className="calendar-icon" />
            <h3 className="font-mono">{getWeekDatesHeaderString()}</h3>
          </div>
          <div className="week-nav-actions">
            <button className="btn btn-secondary nav-btn" onClick={() => setWeekOffset(prev => prev - 1)}>
              <ChevronLeft size={16} />
            </button>
            <button 
              className={`btn btn-secondary today-btn ${weekOffset === 0 ? 'active' : ''}`} 
              onClick={() => setWeekOffset(0)}
            >
              Today
            </button>
            <button className="btn btn-secondary nav-btn" onClick={() => setWeekOffset(prev => prev + 1)}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Grid Header containing weekdays alignment */}
        <div className="dashboard-grid-header">
          <div className="habit-header-col">Habits</div>
          <div className="days-header-grid">
            {weekDates.map((date) => {
              const dateStr = formatDateStr(date);
              const isToday = formatDateStr(new Date()) === dateStr;
              const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
              return (
                <div key={dateStr} className={`day-header-cell ${isToday ? 'today-highlight' : ''}`}>
                  <span className="day-name">{weekdays[date.getDay()]}</span>
                  <span className="day-number font-mono">{date.getDate()}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Habits Cards Row Grid list */}
        <div className="habits-list-container">
          {filteredHabits.length > 0 ? (
            filteredHabits.map((habit) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                weekDates={weekDates}
                completions={completions}
                onToggleCompletion={handleToggleCompletion}
                onIncrementCompletion={handleIncrementCompletion}
                onDecrementCompletion={handleDecrementCompletion}
                onOpenDetails={setActiveDetailsHabit}
              />
            ))
          ) : (
            <div className="empty-state">
              <CheckSquare size={48} className="empty-icon" />
              <h3>No habits found</h3>
              <p>Create a habit or adjust your search filters to get started.</p>
            </div>
          )}
        </div>
      </main>

      {/* Details Heatmap/Calendar Modal */}
      {activeDetailsHabit && (
        <HabitDetails
          habit={activeDetailsHabit}
          completions={completions}
          onClose={() => setActiveDetailsHabit(null)}
          onEdit={(h) => {
            setEditHabit(h);
            setShowFormModal(true);
          }}
          onDelete={handleDeleteHabit}
          onToggleCompletion={handleToggleCompletion}
        />
      )}

      {/* Add / Edit Form Modal */}
      {showFormModal && (
        <HabitForm
          habitToEdit={editHabit}
          onClose={() => {
            setShowFormModal(false);
            setEditHabit(undefined);
          }}
          onSave={handleSaveHabit}
        />
      )}

      {/* Embedded application style rules for the overall App grid structure */}
      <style>{`
        /* Sidebar styles */
        .app-sidebar {
          background-color: var(--card-bg);
          border-right: 1px solid var(--card-border);
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 28px;
          overflow-y: auto;
        }
        .sidebar-header {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .logo-section {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .logo-sparkle {
          color: var(--accent-color);
        }
        .logo-title {
          font-size: 1.4rem;
          font-weight: 700;
          color: var(--text-primary);
        }
        .app-subtitle {
          font-size: 0.72rem;
          color: var(--text-muted);
          font-weight: 500;
        }

        /* Sidebar Section Labels */
        .sidebar-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .section-label {
          font-size: 0.72rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 600;
        }

        /* Global Stats boxes */
        .stats-box-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .stat-box {
          background-color: rgba(39, 39, 42, 0.3);
          border: 1px solid var(--card-border);
          border-radius: 6px;
          padding: 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .box-val {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--text-primary);
        }
        .box-lbl {
          font-size: 0.65rem;
          color: var(--text-secondary);
        }

        /* Weekly Completion meter in sidebar */
        .weekly-rate-wrapper {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: 6px;
        }
        .rate-text-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          color: var(--text-secondary);
        }
        .rate-bar-bg {
          height: 6px;
          background-color: var(--card-border);
          border-radius: 3px;
          overflow: hidden;
        }
        .rate-bar-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 0.4s ease-out;
        }

        /* Filter list button tabs */
        .filter-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .filter-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          background: transparent;
          border: none;
          padding: 8px 12px;
          border-radius: var(--border-radius);
          cursor: pointer;
          color: var(--text-secondary);
          font-size: 0.85rem;
          font-weight: 500;
          text-align: left;
          transition: all var(--transition-fast);
        }
        .filter-btn:hover {
          background-color: rgba(39, 39, 42, 0.3);
          color: var(--text-primary);
        }
        .filter-btn.active {
          background-color: var(--accent-muted);
          color: var(--accent-color);
          font-weight: 600;
        }
        .category-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .filter-btn-faith .category-dot { background-color: #d8c3a5; }
        .filter-btn-health .category-dot { background-color: #a78bfa; }
        .filter-btn-study .category-dot { background-color: #60a5fa; }
        .filter-btn-language .category-dot { background-color: #fb923c; }
        .filter-btn-family .category-dot { background-color: #f87171; }
        .filter-btn-life .category-dot { background-color: #4ade80; }
        
        .filter-count {
          margin-left: auto;
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        /* Sidebar Footer / Backup buttons */
        .sidebar-footer {
          margin-top: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .sidebar-action-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 8px;
          font-size: 0.78rem;
          font-weight: 500;
          color: var(--text-secondary);
          border: 1px dashed var(--card-border);
          background-color: transparent;
          border-radius: 6px;
          cursor: pointer;
          transition: all var(--transition-fast);
          width: 100%;
        }
        .sidebar-action-btn:hover {
          border-color: var(--accent-color);
          color: var(--text-primary);
        }
        .sidebar-clear-btn:hover {
          border-color: var(--color-family) !important;
          color: var(--color-family) !important;
        }

        /* Main app layout area */
        .app-main {
          padding: 32px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        /* Main Header with Search */
        .main-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .search-wrapper {
          position: relative;
          max-width: 320px;
          flex-grow: 1;
        }
        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
        }
        .search-input {
          width: 100%;
          padding: 10px 12px 10px 38px;
          background-color: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: var(--border-radius);
          color: var(--text-primary);
          font-family: var(--font-sans);
          font-size: 0.875rem;
          transition: all var(--transition-fast);
        }
        .search-input:focus {
          outline: none;
          border-color: var(--accent-color);
          box-shadow: 0 0 8px rgba(216, 195, 165, 0.15);
        }

        /* Week Navigation Controller bar */
        .week-controller-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 20px;
          background-color: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: var(--border-radius);
        }
        .week-range-title {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--text-primary);
        }
        .calendar-icon {
          color: var(--accent-color);
        }
        .week-range-title h3 {
          font-size: 0.95rem;
        }
        .week-nav-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .nav-btn {
          padding: 6px 10px;
          border-radius: 6px;
        }
        .today-btn {
          font-size: 0.8rem;
          font-weight: 600;
          padding: 6px 14px;
          border-radius: 6px;
        }
        .today-btn.active {
          border-color: var(--accent-color);
          color: var(--accent-color);
          background-color: var(--accent-muted);
        }

        /* Weekdays Header Grid row */
        .dashboard-grid-header {
          display: grid;
          grid-template-columns: 260px 1fr;
          align-items: center;
          padding: 0 16px;
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
          font-weight: 600;
        }
        .days-header-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 8px;
          width: 100%;
        }
        .day-header-cell {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 8px 0;
          border-radius: 6px;
        }
        .day-name {
          font-size: 0.65rem;
        }
        .day-number {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text-secondary);
          margin-top: 2px;
        }
        .today-highlight {
          background-color: var(--accent-muted);
          color: var(--accent-color);
        }
        .today-highlight .day-number {
          color: var(--accent-color);
        }

        /* Habits listing stack container */
        .habits-list-container {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        
        /* Empty states */
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 24px;
          background-color: var(--card-bg);
          border: 1px dashed var(--card-border);
          border-radius: var(--border-radius);
          text-align: center;
          gap: 12px;
        }
        .empty-icon {
          color: var(--card-border);
        }
        .empty-state h3 {
          font-size: 1.1rem;
          color: var(--text-primary);
        }
        .empty-state p {
          font-size: 0.85rem;
          color: var(--text-secondary);
          max-width: 280px;
        }

        @media (max-width: 1024px) {
          .app-main {
            padding: 20px;
          }
        }
        @media (max-width: 768px) {
          .dashboard-grid-header {
            display: none; /* Hide grid headers on mobile, stack is row based */
          }
          .main-header {
            flex-direction: column;
            align-items: stretch;
          }
          .search-wrapper {
            max-width: none;
          }
          .week-controller-bar {
            flex-direction: column;
            gap: 12px;
            align-items: stretch;
          }
          .week-nav-actions {
            justify-content: space-between;
          }
        }
      `}</style>
    </div>
  );
}
