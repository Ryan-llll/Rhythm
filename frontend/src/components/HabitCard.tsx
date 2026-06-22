import React, { useState, useRef, useEffect } from 'react';
import type { Habit, CompletionLog } from '../types';
import { Flame, Clock, Plus, Minus, Check, ChevronDown } from 'lucide-react';

interface HabitCardProps {
  habit: Habit;
  weekDates: Date[];
  completions: CompletionLog;
  onToggleCompletion: (habitId: string, dateStr: string, slotIndex?: number) => void;
  onIncrementCompletion: (habitId: string, dateStr: string) => void;
  onDecrementCompletion: (habitId: string, dateStr: string) => void;
  onOpenDetails: (habit: Habit) => void;
}

export const HabitCard: React.FC<HabitCardProps> = ({
  habit,
  weekDates,
  completions,
  onToggleCompletion,
  onIncrementCompletion,
  onDecrementCompletion,
  onOpenDetails,
}) => {
  const [activePopover, setActivePopover] = useState<string | null>(null); // dateStr
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setActivePopover(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper to format date as YYYY-MM-DD safely
  const formatDateStr = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Check if a habit is due on a given day
  const isHabitDue = (date: Date): boolean => {
    const dayOfWeek = date.getDay(); // 0 = Sun, 1 = Mon, etc.
    const dateStr = formatDateStr(date);
    
    // Don't mark as not due if it started after this date
    if (dateStr < habit.createdAt) return false;

    if (habit.frequency.type === 'daily') {
      return true;
    }
    if (habit.frequency.type === 'weekly') {
      return habit.frequency.daysOfWeek?.includes(dayOfWeek) ?? false;
    }
    if (habit.frequency.type === 'interval') {
      // For interval habits, we check since the creation date.
      // Every X days means difference in days is a multiple of intervalDays.
      const created = new Date(habit.createdAt + 'T00:00:00');
      const current = new Date(dateStr + 'T00:00:00');
      const diffTime = Math.abs(current.getTime() - created.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays % (habit.frequency.intervalDays || 1) === 0;
    }
    return true;
  };

  // Get current streak
  const calculateCurrentStreak = (): number => {
    const todayStr = formatDateStr(new Date());
    let currentStreak = 0;
    let checkDate = new Date();
    
    const habitCompletions = completions[habit.id] || {};

    // Helper to check if habit was completed on checkDate
    const isCompleted = (dStr: string): boolean => {
      const comp = habitCompletions[dStr];
      if (!comp) return false;
      if (habit.timesPerDay > 1) {
        // Multi-slot: must complete all slots to count as day completed
        return comp.slots?.every(s => s) ?? false;
      }
      return comp.count > 0;
    };

    // Helper to check if habit is due on checkDate
    const isDue = (date: Date): boolean => {
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

    // If today is due but not completed, streak is still alive if completed yesterday (or last due day).
    // Let's count backwards starting from yesterday or today.
    let startFromToday = isCompleted(todayStr) || !isDue(checkDate);
    
    if (!startFromToday) {
      // Check if completed yesterday. If not, streak is broken (0).
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = formatDateStr(yesterday);
      if (isDue(yesterday) && !isCompleted(yesterdayStr)) {
        return 0;
      }
      // If yesterday was not due, go back further until we find a due day.
      let checkPrev = new Date(yesterday);
      let foundDueAndUncompleted = false;
      for (let i = 0; i < 30; i++) {
        if (isDue(checkPrev)) {
          const checkPrevStr = formatDateStr(checkPrev);
          if (!isCompleted(checkPrevStr)) {
            foundDueAndUncompleted = true;
          }
          break;
        }
        checkPrev.setDate(checkPrev.getDate() - 1);
      }
      if (foundDueAndUncompleted) return 0;
    }

    // Go backwards day by day
    let safeCount = 0;
    while (safeCount < 365) {
      const dStr = formatDateStr(checkDate);
      if (dStr < habit.createdAt) break;

      if (isDue(checkDate)) {
        if (isCompleted(dStr)) {
          currentStreak++;
        } else {
          // If it's today and not completed yet, we don't break the streak
          if (dStr !== todayStr) {
            break;
          }
        }
      }
      checkDate.setDate(checkDate.getDate() - 1);
      safeCount++;
    }

    return currentStreak;
  };

  const currentStreak = calculateCurrentStreak();

  return (
    <div className="habit-card-row">
      <div className="habit-info-col" onClick={() => onOpenDetails(habit)}>
        <div className="habit-name-wrapper">
          <span className="habit-color-indicator" style={{ backgroundColor: `var(--color-${habit.category.toLowerCase()})` }}></span>
          <h4 className="habit-name">{habit.name}</h4>
        </div>
        <div className="habit-meta">
          <span className={`badge badge-${habit.category.toLowerCase()}`}>
            {habit.category}
          </span>
          {habit.reminderTime && (
            <span className="habit-reminder">
              <Clock size={12} />
              {habit.reminderTime}
            </span>
          )}
          {currentStreak > 0 && (
            <span className="habit-streak pulse-flame" style={{ color: `var(--color-${habit.category.toLowerCase()})` }}>
              <Flame size={12} fill={`var(--color-${habit.category.toLowerCase()})`} />
              {currentStreak}d
            </span>
          )}
        </div>
      </div>

      <div className="habit-days-grid">
        {weekDates.map((date) => {
          const dateStr = formatDateStr(date);
          const isToday = formatDateStr(new Date()) === dateStr;
          const due = isHabitDue(date);
          const log = completions[habit.id]?.[dateStr] || { count: 0 };
          const completedCount = log.count;
          const isCompleted = habit.timesPerDay > 1 
            ? (log.slots?.filter(s => s).length || 0) === habit.timesPerDay
            : completedCount > 0;
          
          const completedSlotsCount = log.slots?.filter(s => s).length || 0;

          return (
            <div 
              key={dateStr} 
              className={`day-cell-container ${isToday ? 'cell-today' : ''} ${!due ? 'cell-not-due' : ''}`}
            >
              {habit.timesPerDay === 1 ? (
                // Simple Habit Cell
                <div className="cell-action-wrapper">
                  <button
                    className="day-checkbox"
                    style={{
                      borderColor: isCompleted ? `var(--color-${habit.category.toLowerCase()})` : 'var(--card-border)',
                      backgroundColor: isCompleted ? `color-mix(in srgb, var(--color-${habit.category.toLowerCase()}) 15%, transparent)` : 'transparent',
                      color: isCompleted ? `var(--color-${habit.category.toLowerCase()})` : 'transparent',
                    }}
                    onClick={() => onToggleCompletion(habit.id, dateStr)}
                  >
                    {isCompleted && <Check size={14} strokeWidth={3} />}
                  </button>

                  {completedCount > 0 && (
                    <div className="multi-count-controls">
                      <span className="count-badge" style={{ backgroundColor: `var(--color-${habit.category.toLowerCase()})` }}>
                        x{completedCount}
                      </span>
                      <div className="count-adjust-buttons">
                        <button 
                          className="adjust-btn" 
                          onClick={(e) => {
                            e.stopPropagation();
                            onIncrementCompletion(habit.id, dateStr);
                          }}
                        >
                          <Plus size={10} />
                        </button>
                        <button 
                          className="adjust-btn" 
                          onClick={(e) => {
                            e.stopPropagation();
                            onDecrementCompletion(habit.id, dateStr);
                          }}
                        >
                          <Minus size={10} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // Multi-Slot Habit Cell (Prayers)
                <div className="cell-action-wrapper">
                  <button
                    className="day-checkbox multi-slot-btn"
                    style={{
                      borderColor: completedSlotsCount > 0 ? `var(--color-${habit.category.toLowerCase()})` : 'var(--card-border)',
                      backgroundColor: isCompleted ? `color-mix(in srgb, var(--color-${habit.category.toLowerCase()}) 15%, transparent)` : 'transparent',
                      color: completedSlotsCount > 0 ? `var(--color-${habit.category.toLowerCase()})` : 'var(--text-muted)',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePopover(activePopover === dateStr ? null : dateStr);
                    }}
                  >
                    <span className="slots-ratio font-mono">
                      {completedSlotsCount}/{habit.timesPerDay}
                    </span>
                    <ChevronDown size={10} className="popover-arrow-icon" />
                  </button>

                  {/* Inline Popover for Slots */}
                  {activePopover === dateStr && (
                    <div className="slots-popover" ref={popoverRef}>
                      <div className="popover-header">
                        <span>Check off slots</span>
                      </div>
                      <div className="popover-list">
                        {Array.from({ length: habit.timesPerDay }).map((_, slotIdx) => {
                          const slotName = habit.slotNames?.[slotIdx] || `Slot ${slotIdx + 1}`;
                          const isChecked = log.slots?.[slotIdx] ?? false;
                          return (
                            <label key={slotIdx} className="slot-item">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => onToggleCompletion(habit.id, dateStr, slotIdx)}
                              />
                              <span className="slot-name">{slotName}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Styled JSX for local card layout to keep files minimalistic */}
      <style>{`
        .habit-card-row {
          display: grid;
          grid-template-columns: 260px 1fr;
          align-items: center;
          padding: 16px;
          background-color: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: var(--border-radius);
          transition: border-color var(--transition-fast), transform var(--transition-fast);
        }
        .habit-card-row:hover {
          border-color: color-mix(in srgb, var(--accent-color) 30%, transparent);
          transform: translateY(-1px);
        }
        .habit-info-col {
          display: flex;
          flex-direction: column;
          gap: 6px;
          cursor: pointer;
        }
        .habit-name-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .habit-color-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .habit-name {
          font-size: 0.95rem;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .habit-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .habit-reminder {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.75rem;
          color: var(--text-secondary);
        }
        .habit-streak {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-size: 0.75rem;
          font-weight: 600;
        }
        .habit-days-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 8px;
          width: 100%;
        }
        .day-cell-container {
          display: flex;
          justify-content: center;
          align-items: center;
          position: relative;
          padding: 6px 0;
        }
        .cell-today {
          background-color: color-mix(in srgb, var(--accent-color) 5%, transparent);
          border-radius: 6px;
        }
        .cell-not-due {
          opacity: 0.45;
        }
        .cell-action-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .day-checkbox {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 2px solid var(--card-border);
          background: transparent;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all var(--transition-fast);
        }
        .day-checkbox:hover {
          transform: scale(1.08);
          border-color: var(--accent-color) !important;
        }
        .multi-slot-btn {
          width: auto;
          min-width: 50px;
          padding: 0 8px;
          border-radius: 16px;
          font-size: 0.75rem;
          display: flex;
          gap: 4px;
        }
        .slots-ratio {
          font-weight: 500;
        }
        .popover-arrow-icon {
          opacity: 0.7;
        }
        .multi-count-controls {
          position: absolute;
          right: -18px;
          top: -6px;
          display: flex;
          align-items: center;
          gap: 2px;
          z-index: 5;
        }
        .count-badge {
          font-size: 0.65rem;
          font-weight: 700;
          color: #18181b;
          padding: 1px 4px;
          border-radius: 8px;
          line-height: 1;
        }
        .count-adjust-buttons {
          display: flex;
          flex-direction: column;
          gap: 1px;
          opacity: 0;
          transition: opacity var(--transition-fast);
        }
        .cell-action-wrapper:hover .count-adjust-buttons {
          opacity: 1;
        }
        .adjust-btn {
          background-color: var(--input-bg);
          border: 1px solid var(--card-border);
          color: var(--text-primary);
          border-radius: 3px;
          width: 13px;
          height: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .adjust-btn:hover {
          border-color: var(--accent-color);
          background-color: var(--card-border);
        }
        .slots-popover {
          position: absolute;
          top: 36px;
          left: 50%;
          transform: translateX(-50%);
          background-color: #1f1f23;
          border: 1px solid var(--card-border);
          border-radius: var(--border-radius);
          padding: 8px;
          z-index: 20;
          width: 140px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .popover-header {
          font-size: 0.7rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid var(--card-border);
          padding-bottom: 4px;
          text-align: center;
        }
        .popover-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .slot-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.75rem;
          cursor: pointer;
          padding: 2px 4px;
          border-radius: 4px;
        }
        .slot-item:hover {
          background-color: var(--card-border);
        }
        .slot-item input {
          cursor: pointer;
          accent-color: var(--accent-color);
        }
        .slot-name {
          color: var(--text-primary);
        }
        @media (max-width: 768px) {
          .habit-card-row {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          .habit-days-grid {
            gap: 4px;
          }
        }
      `}</style>
    </div>
  );
};
