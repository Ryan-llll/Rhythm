import React, { useState } from 'react';
import type { Habit, CompletionLog } from '../types';
import { X, Flame, CheckCircle, Edit, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

interface HabitDetailsProps {
  habit: Habit;
  completions: CompletionLog;
  onClose: () => void;
  onEdit: (habit: Habit) => void;
  onDelete: (habitId: string) => void;
  onToggleCompletion: (habitId: string, dateStr: string, slotIndex?: number) => void;
}

export const HabitDetails: React.FC<HabitDetailsProps> = ({
  habit,
  completions,
  onClose,
  onEdit,
  onDelete,
  onToggleCompletion,
}) => {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  
  const habitCompletions = completions[habit.id] || {};

  // Formats date to YYYY-MM-DD
  const formatDateStr = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // 1. Calculate Total Completions
  const calculateTotalCompletions = (): number => {
    let total = 0;
    Object.values(habitCompletions).forEach((comp) => {
      if (habit.timesPerDay > 1) {
        total += comp.slots?.filter((s) => s).length || 0;
      } else {
        total += comp.count || 0;
      }
    });
    return total;
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

  // Helper to check if habit was completed on checkDate
  const isCompleted = (dStr: string): boolean => {
    const comp = habitCompletions[dStr];
    if (!comp) return false;
    if (habit.timesPerDay > 1) {
      return comp.slots?.every(s => s) ?? false;
    }
    return comp.count > 0;
  };

  // 2. Calculate Streaks
  const calculateStreaks = (): { current: number; best: number } => {
    const todayStr = formatDateStr(new Date());
    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;

    // We need to evaluate every day from habit creation date to today.
    const createdDate = new Date(habit.createdAt + 'T00:00:00');
    const todayDate = new Date(todayStr + 'T00:00:00');
    
    // Iterate from createdDate to todayDate
    const tempDate = new Date(createdDate);
    while (tempDate <= todayDate) {
      const dStr = formatDateStr(tempDate);
      if (isDue(tempDate)) {
        if (isCompleted(dStr)) {
          tempStreak++;
          if (tempStreak > bestStreak) {
            bestStreak = tempStreak;
          }
        } else {
          // If it is today and not completed yet, the current streak is not broken yet
          if (dStr !== todayStr) {
            tempStreak = 0;
          }
        }
      }
      tempDate.setDate(tempDate.getDate() + 1);
    }

    // Now calculate current streak by counting backwards from today
    let checkDate = new Date();
    let startFromToday = isCompleted(todayStr) || !isDue(checkDate);
    
    if (!startFromToday) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = formatDateStr(yesterday);
      if (isDue(yesterday) && !isCompleted(yesterdayStr)) {
        currentStreak = 0;
      } else {
        // If yesterday was not due, or was completed, we can search backwards
        let checkPrev = new Date(yesterday);
        let foundDueAndUncompleted = false;
        for (let i = 0; i < 30; i++) {
          if (isDue(checkPrev)) {
            const checkPrevStr = formatDateStr(checkPrev);
            if (!isCompleted(checkPrevStr)) foundDueAndUncompleted = true;
            break;
          }
          checkPrev.setDate(checkPrev.getDate() - 1);
        }
        if (foundDueAndUncompleted) currentStreak = 0;
        else startFromToday = true;
      }
    }

    if (startFromToday || isCompleted(todayStr)) {
      checkDate = new Date();
      let safeCount = 0;
      while (safeCount < 365) {
        const dStr = formatDateStr(checkDate);
        if (dStr < habit.createdAt) break;

        if (isDue(checkDate)) {
          if (isCompleted(dStr)) {
            currentStreak++;
          } else {
            if (dStr !== todayStr) {
              break;
            }
          }
        }
        checkDate.setDate(checkDate.getDate() - 1);
        safeCount++;
      }
    }

    return { current: currentStreak, best: Math.max(bestStreak, currentStreak) };
  };

  const { current: currentStreak, best: bestStreak } = calculateStreaks();
  const totalCompletions = calculateTotalCompletions();

  // 3. Generate GitHub style contribution heatmap data (last 6 months, align to Sunday)
  const generateHeatmapData = () => {
    const today = new Date();
    const weeks = 26; // 6 months is approx 26 weeks
    const days = [];
    
    // Find Sunday of 26 weeks ago
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - weeks * 7);
    const startDay = startDate.getDay();
    startDate.setDate(startDate.getDate() - startDay); // Align to Sunday
    startDate.setHours(0, 0, 0, 0);

    const totalDays = weeks * 7 + (today.getDay() + 1);
    const cursor = new Date(startDate);
    
    for (let i = 0; i < totalDays; i++) {
      const dStr = formatDateStr(cursor);
      const log = habitCompletions[dStr] || { count: 0 };
      
      let intensity = 0; // 0 to 4 scale
      let label = '0 completions';

      if (habit.timesPerDay > 1) {
        const checkedCount = log.slots?.filter(s => s).length || 0;
        if (checkedCount > 0) {
          const ratio = checkedCount / habit.timesPerDay;
          if (ratio <= 0.25) intensity = 1;
          else if (ratio <= 0.5) intensity = 2;
          else if (ratio <= 0.75) intensity = 3;
          else intensity = 4;
          label = `${checkedCount}/${habit.timesPerDay} slots completed`;
        }
      } else {
        const count = log.count;
        if (count > 0) {
          if (count === 1) intensity = 1;
          else if (count === 2) intensity = 2;
          else if (count === 3) intensity = 3;
          else intensity = 4;
          label = `${count} completion${count > 1 ? 's' : ''}`;
        }
      }

      days.push({
        date: new Date(cursor),
        dateStr: dStr,
        intensity,
        label: `${dStr}: ${label}`,
        isFuture: cursor > today,
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    // Group into weeks (arrays of 7 days)
    const heatmapWeeks = [];
    for (let i = 0; i < days.length; i += 7) {
      heatmapWeeks.push(days.slice(i, i + 7));
    }
    return heatmapWeeks;
  };

  const heatmapWeeks = generateHeatmapData();

  // 4. Generate Monthly Calendar Grid
  const generateMonthGrid = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun, 1 = Mon, etc.
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    const grid = [];
    
    // Empty cells before the first day of the month
    for (let i = 0; i < firstDayIndex; i++) {
      grid.push(null);
    }
    
    // Days of the month
    for (let day = 1; day <= totalDays; day++) {
      grid.push(new Date(year, month, day));
    }
    
    return grid;
  };

  const monthGrid = generateMonthGrid();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handleMonthPrev = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleMonthNext = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  // Get color intensity for heatmap cell
  const getCellColor = (intensity: number) => {
    if (intensity === 0) return 'var(--card-border)';
    const pct = [0, 25, 50, 75, 100][intensity];
    return `color-mix(in srgb, var(--color-${habit.category.toLowerCase()}) ${pct}%, transparent)`;
  };

  const handleDeleteClick = () => {
    if (window.confirm(`Are you sure you want to delete "${habit.name}"?`)) {
      onDelete(habit.id);
      onClose();
    }
  };

  // Monthly stats helper
  const getMonthlyCompletionRate = (): number => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    let dueCount = 0;
    let completedCount = 0;
    
    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(year, month, d);
      const dateStr = formatDateStr(date);
      if (isDue(date)) {
        dueCount++;
        if (isCompleted(dateStr)) {
          completedCount++;
        }
      }
    }
    
    if (dueCount === 0) return 0;
    return Math.round((completedCount / dueCount) * 100);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content habit-details-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="details-header-title">
            <span className="habit-color-pill" style={{ backgroundColor: `var(--color-${habit.category.toLowerCase()})` }}></span>
            <div>
              <h3>{habit.name}</h3>
              <span className={`badge badge-${habit.category.toLowerCase()}`} style={{ marginTop: '4px' }}>
                {habit.category}
              </span>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Streak & Stats Grid */}
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-icon-wrapper" style={{ color: `var(--color-${habit.category.toLowerCase()})`, backgroundColor: `color-mix(in srgb, var(--color-${habit.category.toLowerCase()}) 8%, transparent)` }}>
                <Flame size={20} fill={currentStreak > 0 ? `var(--color-${habit.category.toLowerCase()})` : 'transparent'} />
              </div>
              <div className="stat-info">
                <span className="stat-value font-mono">{currentStreak}d</span>
                <span className="stat-label">Current Streak</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon-wrapper" style={{ color: '#fb923c', backgroundColor: 'rgba(251, 146, 60, 0.1)' }}>
                <Flame size={20} fill={bestStreak > 0 ? '#fb923c' : 'transparent'} />
              </div>
              <div className="stat-info">
                <span className="stat-value font-mono">{bestStreak}d</span>
                <span className="stat-label">Best Streak</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon-wrapper" style={{ color: '#4ade80', backgroundColor: 'rgba(74, 222, 128, 0.1)' }}>
                <CheckCircle size={20} />
              </div>
              <div className="stat-info">
                <span className="stat-value font-mono">{totalCompletions}</span>
                <span className="stat-label">Total Checks</span>
              </div>
            </div>
          </div>

          {/* GitHub Heatmap section */}
          <div className="details-section">
            <h4 className="section-title">6-Month History</h4>
            <div className="heatmap-container">
              <div className="heatmap-week-labels">
                <span>Sun</span>
                <span>Tue</span>
                <span>Thu</span>
                <span>Sat</span>
              </div>
              <div className="heatmap-grid-scroll">
                <div className="heatmap-grid">
                  {heatmapWeeks.map((week, wIdx) => (
                    <div key={wIdx} className="heatmap-column">
                      {week.map((day) => (
                        <div
                          key={day.dateStr}
                          className={`heatmap-cell ${day.isFuture ? 'cell-future' : ''}`}
                          style={{
                            backgroundColor: day.isFuture ? 'transparent' : getCellColor(day.intensity),
                            borderColor: day.isFuture ? 'rgba(39, 39, 42, 0.3)' : 'transparent',
                          }}
                          title={day.label}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="heatmap-legend">
              <span>Less</span>
              <div className="legend-cells">
                <div className="heatmap-cell" style={{ backgroundColor: 'var(--card-border)' }} />
                <div className="heatmap-cell" style={{ backgroundColor: `color-mix(in srgb, var(--color-${habit.category.toLowerCase()}) 25%, transparent)` }} />
                <div className="heatmap-cell" style={{ backgroundColor: `color-mix(in srgb, var(--color-${habit.category.toLowerCase()}) 50%, transparent)` }} />
                <div className="heatmap-cell" style={{ backgroundColor: `color-mix(in srgb, var(--color-${habit.category.toLowerCase()}) 75%, transparent)` }} />
                <div className="heatmap-cell" style={{ backgroundColor: `var(--color-${habit.category.toLowerCase()})` }} />
              </div>
              <span>More</span>
            </div>
          </div>

          {/* Monthly Calendar View */}
          <div className="details-section">
            <div className="calendar-section-header">
              <h4 className="section-title">Monthly Log</h4>
              <div className="calendar-rate badge font-mono" style={{ backgroundColor: `color-mix(in srgb, var(--color-${habit.category.toLowerCase()}) 8%, transparent)`, color: `var(--color-${habit.category.toLowerCase()})`, borderColor: `color-mix(in srgb, var(--color-${habit.category.toLowerCase()}) 15%, transparent)` }}>
                Month Completion: {getMonthlyCompletionRate()}%
              </div>
              <div className="calendar-nav">
                <button className="btn-icon" onClick={handleMonthPrev}>
                  <ChevronLeft size={16} />
                </button>
                <span className="current-month-label font-mono">
                  {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </span>
                <button className="btn-icon" onClick={handleMonthNext}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="calendar-weekday-labels">
              <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
            </div>

            <div className="calendar-grid">
              {monthGrid.map((date, idx) => {
                if (!date) return <div key={`empty-${idx}`} className="calendar-cell cell-empty" />;
                
                const dStr = formatDateStr(date);
                const log = habitCompletions[dStr];
                const due = isDue(date);
                
                let checkCount = 0;
                let full = false;

                if (log) {
                  if (habit.timesPerDay > 1) {
                    checkCount = log.slots?.filter(s => s).length || 0;
                    full = checkCount === habit.timesPerDay;
                  } else {
                    checkCount = log.count || 0;
                    full = checkCount > 0;
                  }
                }

                return (
                  <button
                    key={dStr}
                    disabled={date > new Date()}
                    onClick={() => onToggleCompletion(habit.id, dStr)}
                    className={`calendar-cell ${!due ? 'cal-not-due' : ''} ${full ? 'cal-completed' : ''}`}
                    style={{
                      borderColor: full ? `var(--color-${habit.category.toLowerCase()})` : due ? 'var(--input-border)' : 'transparent',
                      backgroundColor: full ? `color-mix(in srgb, var(--color-${habit.category.toLowerCase()}) 11%, transparent)` : 'transparent',
                    }}
                  >
                    <span className="cal-day-num">{date.getDate()}</span>
                    {checkCount > 0 && (
                      <span className="cal-check-indicator" style={{ color: `var(--color-${habit.category.toLowerCase()})` }}>
                        {habit.timesPerDay > 1 ? `${checkCount}/${habit.timesPerDay}` : checkCount > 1 ? `x${checkCount}` : <CheckCircle size={10} />}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="calendar-info-tip">
              💡 Tip: Click on any active calendar day to toggle completion for that date.
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <div className="action-buttons-left">
            <button className="btn btn-danger" onClick={handleDeleteClick}>
              <Trash2 size={16} />
              Delete Habit
            </button>
          </div>
          <div className="action-buttons-right">
            <button className="btn btn-secondary" onClick={() => onEdit(habit)}>
              <Edit size={16} />
              Edit Settings
            </button>
            <button className="btn btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .habit-details-modal {
          max-width: 680px;
        }
        .details-header-title {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .habit-color-pill {
          width: 6px;
          height: 32px;
          border-radius: 3px;
        }
        .stats-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }
        .stat-card {
          background-color: #27272a30;
          border: 1px solid var(--card-border);
          border-radius: var(--border-radius);
          padding: 12px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .stat-icon-wrapper {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .stat-info {
          display: flex;
          flex-direction: column;
        }
        .stat-value {
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1.2;
        }
        .stat-label {
          font-size: 0.72rem;
          color: var(--text-secondary);
        }
        .details-section {
          margin-bottom: 24px;
        }
        .section-title {
          font-size: 0.875rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 12px;
        }
        
        /* Heatmap Styles */
        .heatmap-container {
          display: flex;
          gap: 6px;
          background-color: #27272a15;
          border: 1px solid var(--card-border);
          border-radius: var(--border-radius);
          padding: 16px;
        }
        .heatmap-week-labels {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          font-size: 0.65rem;
          color: var(--text-muted);
          padding: 4px 0;
          text-align: right;
          width: 24px;
        }
        .heatmap-grid-scroll {
          overflow-x: auto;
          flex-grow: 1;
        }
        .heatmap-grid {
          display: flex;
          gap: 3px;
        }
        .heatmap-column {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .heatmap-cell {
          width: 10px;
          height: 10px;
          border-radius: 2px;
          background-color: var(--card-border);
          transition: transform var(--transition-fast);
        }
        .heatmap-cell:hover {
          transform: scale(1.3);
          z-index: 10;
          box-shadow: 0 0 4px rgba(255,255,255,0.2);
        }
        .cell-future {
          background-color: transparent;
          border: 1px dashed rgba(63, 63, 70, 0.4);
        }
        .heatmap-legend {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 6px;
          font-size: 0.68rem;
          color: var(--text-muted);
          margin-top: 6px;
        }
        .legend-cells {
          display: flex;
          gap: 3px;
        }

        /* Monthly Calendar Styles */
        .calendar-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          flex-wrap: wrap;
          gap: 8px;
        }
        .calendar-section-header .section-title {
          margin-bottom: 0;
        }
        .calendar-rate {
          font-size: 0.75rem;
        }
        .calendar-nav {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .current-month-label {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-primary);
          min-width: 120px;
          text-align: center;
        }
        .calendar-weekday-labels {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 6px;
          text-align: center;
          font-size: 0.7rem;
          color: var(--text-muted);
          text-transform: uppercase;
          margin-bottom: 6px;
        }
        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 6px;
        }
        .calendar-cell {
          aspect-ratio: 1.1;
          background: #27272a20;
          border: 1px solid var(--card-border);
          border-radius: 6px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 6px;
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .calendar-cell:not(:disabled):hover {
          border-color: var(--accent-color) !important;
          background: #27272a40;
        }
        .calendar-cell:disabled {
          cursor: not-allowed;
          opacity: 0.3;
        }
        .cell-empty {
          background: transparent;
          border: none;
          cursor: default;
        }
        .cal-not-due {
          opacity: 0.5;
        }
        .cal-day-num {
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--text-secondary);
        }
        .cal-check-indicator {
          font-size: 0.65rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: flex-end;
        }
        .calendar-info-tip {
          font-size: 0.72rem;
          color: var(--text-muted);
          margin-top: 10px;
          text-align: center;
        }

        .modal-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .action-buttons-right {
          display: flex;
          gap: 12px;
        }
        
        @media (max-width: 600px) {
          .stats-row {
            grid-template-columns: 1fr;
          }
          .calendar-section-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .calendar-nav {
            width: 100%;
            justify-content: space-between;
          }
        }
      `}</style>
    </div>
  );
};
