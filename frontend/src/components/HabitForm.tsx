import React, { useState, useEffect } from 'react';
import type { Habit, Category, Frequency } from '../types';
import { X } from 'lucide-react';

interface HabitFormProps {
  habitToEdit?: Habit;
  onClose: () => void;
  onSave: (habitData: Omit<Habit, 'id' | 'createdAt'> & { id?: string }) => void;
}

const CATEGORY_COLORS: Record<Category, string> = {
  Faith: '#d8c3a5',    // Gold
  Health: '#a78bfa',   // Purple
  Study: '#60a5fa',    // Blue
  Language: '#fb923c', // Orange
  Family: '#f87171',   // Soft Red
  Life: '#4ade80',     // Green
};

const DAYS_OF_WEEK = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
];

export const HabitForm: React.FC<HabitFormProps> = ({ habitToEdit, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('Faith');
  const [color, setColor] = useState('#d8c3a5');
  const [freqType, setFreqType] = useState<'daily' | 'weekly' | 'interval'>('daily');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri by default
  const [intervalDays, setIntervalDays] = useState(3);
  const [timesPerDay, setTimesPerDay] = useState(1);
  const [slotNames, setSlotNames] = useState<string[]>([]);
  const [hasReminder, setHasReminder] = useState(false);
  const [reminderTime, setReminderTime] = useState('14:00');

  // Populate data when editing
  useEffect(() => {
    if (habitToEdit) {
      setName(habitToEdit.name);
      setCategory(habitToEdit.category);
      setColor(habitToEdit.color);
      setFreqType(habitToEdit.frequency.type);
      if (habitToEdit.frequency.daysOfWeek) {
        setDaysOfWeek(habitToEdit.frequency.daysOfWeek);
      }
      if (habitToEdit.frequency.intervalDays) {
        setIntervalDays(habitToEdit.frequency.intervalDays);
      }
      setTimesPerDay(habitToEdit.timesPerDay);
      setSlotNames(habitToEdit.slotNames || []);
      if (habitToEdit.reminderTime) {
        setHasReminder(true);
        setReminderTime(habitToEdit.reminderTime);
      }
    }
  }, [habitToEdit]);

  // Auto-set default color when category changes (unless customized by user)
  const handleCategoryChange = (cat: Category) => {
    setCategory(cat);
    setColor(CATEGORY_COLORS[cat]);
    
    // Automatically preset Faith with 5 slots if changing to Faith and creating a new habit
    if (!habitToEdit && cat === 'Faith') {
      setTimesPerDay(5);
      setSlotNames(['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']);
      setHasReminder(true);
      setReminderTime('14:00');
    } else if (!habitToEdit) {
      setTimesPerDay(1);
      setSlotNames([]);
      setHasReminder(false);
    }
  };

  // Adjust slot inputs size based on timesPerDay
  const handleTimesPerDayChange = (times: number) => {
    const validTimes = Math.max(1, Math.min(10, times));
    setTimesPerDay(validTimes);
    
    const newSlots = [...slotNames];
    if (validTimes > newSlots.length) {
      // Add empty slots
      for (let i = newSlots.length; i < validTimes; i++) {
        if (category === 'Faith' && validTimes === 5) {
          const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
          newSlots.push(prayers[i]);
        } else {
          newSlots.push(`Slot ${i + 1}`);
        }
      }
    } else if (validTimes < newSlots.length) {
      // Shrink slots
      newSlots.splice(validTimes);
    }
    setSlotNames(newSlots);
  };

  const toggleDayOfWeek = (dayVal: number) => {
    if (daysOfWeek.includes(dayVal)) {
      setDaysOfWeek(daysOfWeek.filter((d) => d !== dayVal));
    } else {
      setDaysOfWeek([...daysOfWeek, dayVal].sort());
    }
  };

  const handleSlotNameChange = (index: number, newName: string) => {
    const updated = [...slotNames];
    updated[index] = newName;
    setSlotNames(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const frequency: Frequency = {
      type: freqType,
      daysOfWeek: freqType === 'weekly' ? daysOfWeek : undefined,
      intervalDays: freqType === 'interval' ? intervalDays : undefined,
    };

    onSave({
      id: habitToEdit?.id,
      name: name.trim(),
      category,
      color,
      frequency,
      timesPerDay,
      slotNames: timesPerDay > 1 ? slotNames : undefined,
      reminderTime: hasReminder ? reminderTime : undefined,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal-content habit-form-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="modal-header">
          <h3>{habitToEdit ? 'Edit Habit' : 'Create New Habit'}</h3>
          <button type="button" className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Habit Name */}
          <div className="form-group">
            <label className="form-label" htmlFor="habit-name">Habit Name</label>
            <input
              type="text"
              id="habit-name"
              className="form-input"
              placeholder="e.g. Morning Workout"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-grid-2">
            {/* Category */}
            <div className="form-group">
              <label className="form-label" htmlFor="habit-category">Category</label>
              <select
                id="habit-category"
                className="form-select"
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value as Category)}
              >
                <option value="Faith">Faith (Prayers)</option>
                <option value="Health">Health / Workout</option>
                <option value="Study">Study / Coding</option>
                <option value="Language">Language</option>
                <option value="Family">Family / Social</option>
                <option value="Life">Life / Tasks</option>
              </select>
            </div>

            {/* Color Palette Choice */}
            <div className="form-group">
              <label className="form-label">Color Theme</label>
              <div className="color-palette-grid">
                {Object.entries(CATEGORY_COLORS).map(([catName, colorHex]) => (
                  <button
                    key={catName}
                    type="button"
                    className={`palette-color-btn ${color === colorHex ? 'active' : ''}`}
                    style={{ backgroundColor: colorHex }}
                    onClick={() => setColor(colorHex)}
                    title={catName}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Frequency Type */}
          <div className="form-group">
            <label className="form-label">Frequency</label>
            <div className="tab-control">
              <button
                type="button"
                className={`tab-btn ${freqType === 'daily' ? 'active' : ''}`}
                onClick={() => setFreqType('daily')}
              >
                Daily
              </button>
              <button
                type="button"
                className={`tab-btn ${freqType === 'weekly' ? 'active' : ''}`}
                onClick={() => setFreqType('weekly')}
              >
                Specific Days
              </button>
              <button
                type="button"
                className={`tab-btn ${freqType === 'interval' ? 'active' : ''}`}
                onClick={() => setFreqType('interval')}
              >
                Every X Days
              </button>
            </div>

            {/* Weekly Days Selector */}
            {freqType === 'weekly' && (
              <div className="week-days-select">
                {DAYS_OF_WEEK.map((day) => {
                  const isSelected = daysOfWeek.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      className={`day-select-btn ${isSelected ? 'active' : ''}`}
                      style={{
                        borderColor: isSelected ? color : 'var(--card-border)',
                        backgroundColor: isSelected ? `${color}20` : 'transparent',
                        color: isSelected ? color : 'var(--text-secondary)',
                      }}
                      onClick={() => toggleDayOfWeek(day.value)}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Interval Selector */}
            {freqType === 'interval' && (
              <div className="interval-select">
                <span>Repeat every</span>
                <input
                  type="number"
                  min="1"
                  max="90"
                  className="form-input number-input inline font-mono"
                  value={intervalDays}
                  onChange={(e) => setIntervalDays(Math.max(1, parseInt(e.target.value) || 1))}
                />
                <span>days</span>
              </div>
            )}
          </div>

          {/* Times Per Day (Multi-slot indicator) */}
          <div className="form-group">
            <div className="times-per-day-row">
              <div>
                <label className="form-label">Times Per Day</label>
                <span className="form-help-text">Number of slots to check off daily</span>
              </div>
              <input
                type="number"
                min="1"
                max="10"
                className="form-input number-input font-mono"
                value={timesPerDay}
                onChange={(e) => handleTimesPerDayChange(parseInt(e.target.value) || 1)}
              />
            </div>

            {timesPerDay > 1 && (
              <div className="slot-names-grid">
                <span className="form-help-label">Slot Titles:</span>
                {slotNames.map((slotName, sIdx) => (
                  <div key={sIdx} className="slot-name-input-wrapper">
                    <span className="slot-num-label font-mono">#{sIdx + 1}</span>
                    <input
                      type="text"
                      className="form-input slot-name-input"
                      value={slotName}
                      onChange={(e) => handleSlotNameChange(sIdx, e.target.value)}
                      placeholder={`Slot ${sIdx + 1}`}
                      required
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reminders */}
          <div className="form-group checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={hasReminder}
                onChange={(e) => setHasReminder(e.target.checked)}
              />
              <span>Set daily reminder time</span>
            </label>
            
            {hasReminder && (
              <input
                type="time"
                className="form-input time-input font-mono"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
              />
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" style={{ backgroundColor: color }}>
            {habitToEdit ? 'Save Changes' : 'Create Habit'}
          </button>
        </div>
      </form>

      <style>{`
        .color-palette-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 8px;
          height: 38px;
          align-items: center;
        }
        .palette-color-btn {
          height: 24px;
          width: 24px;
          border-radius: 50%;
          border: 2px solid transparent;
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .palette-color-btn:hover {
          transform: scale(1.15);
        }
        .palette-color-btn.active {
          border-color: var(--text-primary);
        }
        
        .tab-control {
          display: flex;
          background-color: var(--input-bg);
          border: 1px solid var(--input-border);
          border-radius: var(--border-radius);
          padding: 3px;
          margin-bottom: 12px;
        }
        .tab-btn {
          flex: 1;
          background: transparent;
          border: none;
          padding: 8px;
          font-size: 0.82rem;
          font-weight: 500;
          color: var(--text-secondary);
          cursor: pointer;
          border-radius: 6px;
          transition: all var(--transition-fast);
        }
        .tab-btn:hover {
          color: var(--text-primary);
        }
        .tab-btn.active {
          background-color: var(--card-border);
          color: var(--text-primary);
        }
        
        .week-days-select {
          display: flex;
          justify-content: space-between;
          gap: 6px;
        }
        .day-select-btn {
          flex: 1;
          padding: 8px 0;
          font-size: 0.75rem;
          font-weight: 500;
          border-radius: 6px;
          border: 1px solid var(--card-border);
          background-color: transparent;
          cursor: pointer;
          transition: all var(--transition-fast);
          text-align: center;
        }
        .day-select-btn:hover {
          transform: translateY(-1px);
        }
        .day-select-btn.active {
          border-width: 1px;
        }

        .interval-select {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 0.875rem;
          color: var(--text-secondary);
        }
        .inline {
          display: inline-block;
          width: auto;
        }
        
        .times-per-day-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        .form-help-text {
          display: block;
          font-size: 0.72rem;
          color: var(--text-muted);
          margin-top: 2px;
        }
        .number-input {
          width: 70px;
          text-align: center;
        }
        
        .slot-names-grid {
          display: flex;
          flex-direction: column;
          gap: 6px;
          background-color: #27272a30;
          border: 1px solid var(--card-border);
          border-radius: var(--border-radius);
          padding: 12px;
        }
        .form-help-label {
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--text-secondary);
          margin-bottom: 4px;
        }
        .slot-name-input-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .slot-num-label {
          font-size: 0.75rem;
          color: var(--text-muted);
          width: 24px;
        }
        .slot-name-input {
          flex-grow: 1;
          padding: 6px 10px;
          font-size: 0.8rem;
        }
        
        .checkbox-group {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 24px;
        }
        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.875rem;
          color: var(--text-secondary);
          cursor: pointer;
        }
        .checkbox-label input {
          cursor: pointer;
          accent-color: var(--accent-color);
        }
        .time-input {
          width: 120px;
          padding: 8px 10px;
        }
      `}</style>
    </div>
  );
};
