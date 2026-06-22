import React, { useState, useEffect } from 'react';
import type { Habit, Category, CompletionLog, HabitCompletion } from './types';
import { HabitCard } from './components/HabitCard';
import { HabitDetails } from './components/HabitDetails';
import { HabitForm } from './components/HabitForm';
import { 
  Plus, Search, Download, Upload, Calendar, 
  CheckSquare, Sparkles, ChevronLeft, ChevronRight, Trash2, LogOut, Flame
} from 'lucide-react';
import { supabase } from './lib/supabase';
import { Auth } from './components/Auth';
import type { Session } from '@supabase/supabase-js';

// Helper to format date safely as YYYY-MM-DD
const formatDateStr = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function App() {
  // 1. Session and Auth State
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // 2. Habits and Completions State
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<CompletionLog>({});
  
  // Dashboard view mode
  const [viewMode, setViewMode] = useState<'weekly' | 'heatmaps'>('heatmaps');

  // Filters & Offsets
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [weekOffset, setWeekOffset] = useState(0);

  // Modals
  const [activeDetailsHabit, setActiveDetailsHabit] = useState<Habit | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editHabit, setEditHabit] = useState<Habit | undefined>(undefined);

  // 3. Listen to auth state changes on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingSession(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 4. Fetch data from Supabase when session changes
  useEffect(() => {
    if (!session) {
      setHabits([]);
      setCompletions({});
      return;
    }
    
    const fetchUserData = async () => {
      try {
        // Fetch habits
        const { data: dbHabits, error: habitsErr } = await supabase
          .from('habits')
          .select('*')
          .order('created_at', { ascending: true });
          
        if (habitsErr) throw habitsErr;
        
        const mappedHabits: Habit[] = (dbHabits || []).map(h => ({
          id: h.id,
          name: h.name,
          category: h.category as Category,
          color: h.color,
          frequency: {
            type: h.frequency_type as any,
            daysOfWeek: h.frequency_days_of_week || undefined,
            intervalDays: h.frequency_interval_days || undefined,
          },
          timesPerDay: h.times_per_day,
          slotNames: h.slot_names || undefined,
          reminderTime: h.reminder_time || undefined,
          createdAt: h.created_at.split('T')[0],
        }));
        setHabits(mappedHabits);

        // Fetch completions
        const { data: dbCompletions, error: completionsErr } = await supabase
          .from('completions')
          .select('*');
          
        if (completionsErr) throw completionsErr;

        const log: CompletionLog = {};
        (dbCompletions || []).forEach(c => {
          if (!log[c.habit_id]) log[c.habit_id] = {};
          log[c.habit_id][c.date] = {
            count: c.count,
            slots: c.slots || undefined
          };
        });
        setCompletions(log);
      } catch (error) {
        console.error('Error fetching user data from Supabase:', error);
      }
    };

    fetchUserData();
  }, [session]);

  // 5. Generate Week Dates based on Offset
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

  // 6. Quick streak finder per habit
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

  // Helper to fetch total completions for a specific habit
  const getHabitTotalChecks = (habit: Habit): number => {
    let total = 0;
    const habitComps = completions[habit.id] || {};
    Object.values(habitComps).forEach((comp) => {
      if (habit.timesPerDay > 1) {
        total += comp.slots?.filter((s) => s).length || 0;
      } else {
        total += comp.count || 0;
      }
    });
    return total;
  };

  // Generate 6-Month Heatmap grid cells for a habit
  const generateHeatmapDataForOverview = (habit: Habit) => {
    const today = new Date();
    const weeks = 26; // 6 months
    const days = [];
    const habitCompletions = completions[habit.id] || {};
    
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
          label = `${checkedCount}/${habit.timesPerDay} slots`;
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
        dateStr: dStr,
        intensity,
        label: `${dStr}: ${label}`,
        isFuture: cursor > today,
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    const heatmapWeeks = [];
    for (let i = 0; i < days.length; i += 7) {
      heatmapWeeks.push(days.slice(i, i + 7));
    }
    return heatmapWeeks;
  };

  const getCellColorForOverview = (colorHex: string, intensity: number) => {
    if (intensity === 0) return 'var(--card-border)';
    const opacities = [0, 0.25, 0.5, 0.75, 1];
    return `${colorHex}${Math.floor(opacities[intensity] * 255).toString(16).padStart(2, '0')}`;
  };

  // Calculations for Sidebar Statistics
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
    let longestStreak = 0;

    habits.forEach((habit) => {
      const streak = getHabitStreak(habit);
      if (streak > longestStreak) longestStreak = streak;
    });

    return { totalChecks, weeklyRate, longestStreak };
  };

  const { totalChecks, weeklyRate, longestStreak } = calculateStats();

  // 7. Completion Toggle Handlers (Synced to Supabase)
  const handleToggleCompletion = async (habitId: string, dateStr: string, slotIndex?: number) => {
    if (!session) return;
    const userId = session.user.id;

    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    const habitComps = completions[habitId] || {};
    const current = habitComps[dateStr] || { count: 0 };

    let updated: HabitCompletion;

    if (habit.timesPerDay > 1) {
      const slots = [...(current.slots || Array(habit.timesPerDay).fill(false))];
      if (slotIndex !== undefined) {
        slots[slotIndex] = !slots[slotIndex];
      }
      const count = slots.filter(s => s).length;
      updated = { count, slots };
    } else {
      const count = current.count > 0 ? 0 : 1;
      updated = { count };
    }

    const { error } = await supabase
      .from('completions')
      .upsert({
        user_id: userId,
        habit_id: habitId,
        date: dateStr,
        count: updated.count,
        slots: updated.slots || null
      }, { onConflict: 'habit_id,date' });

    if (error) {
      console.error('Error syncing toggle completion to Supabase:', error);
      alert(`Sync failed: ${error.message}`);
      return;
    }

    setCompletions((prev) => {
      const newComps = { ...prev };
      newComps[habitId] = {
        ...habitComps,
        [dateStr]: updated
      };
      return newComps;
    });
  };

  const handleIncrementCompletion = async (habitId: string, dateStr: string) => {
    if (!session) return;
    const userId = session.user.id;

    const habitComps = completions[habitId] || {};
    const current = habitComps[dateStr] || { count: 0 };
    const newCount = current.count + 1;

    const { error } = await supabase
      .from('completions')
      .upsert({
        user_id: userId,
        habit_id: habitId,
        date: dateStr,
        count: newCount,
        slots: null
      }, { onConflict: 'habit_id,date' });

    if (error) {
      console.error('Error syncing increment to Supabase:', error);
      return;
    }

    setCompletions((prev) => {
      const newComps = { ...prev };
      newComps[habitId] = {
        ...habitComps,
        [dateStr]: { count: newCount }
      };
      return newComps;
    });
  };

  const handleDecrementCompletion = async (habitId: string, dateStr: string) => {
    if (!session) return;
    const userId = session.user.id;

    const habitComps = completions[habitId] || {};
    const current = habitComps[dateStr] || { count: 0 };
    if (current.count <= 0) return;
    const newCount = Math.max(0, current.count - 1);

    const { error } = await supabase
      .from('completions')
      .upsert({
        user_id: userId,
        habit_id: habitId,
        date: dateStr,
        count: newCount,
        slots: null
      }, { onConflict: 'habit_id,date' });

    if (error) {
      console.error('Error syncing decrement to Supabase:', error);
      return;
    }

    setCompletions((prev) => {
      const newComps = { ...prev };
      newComps[habitId] = {
        ...habitComps,
        [dateStr]: { count: newCount }
      };
      return newComps;
    });
  };

  // 8. Habit Add / Edit / Delete Handlers (Synced to Supabase)
  const handleSaveHabit = async (habitData: Omit<Habit, 'id' | 'createdAt'> & { id?: string }) => {
    if (!session) return;
    const userId = session.user.id;

    try {
      if (habitData.id) {
        // Edit in Supabase
        const { error } = await supabase
          .from('habits')
          .update({
            name: habitData.name,
            category: habitData.category,
            color: habitData.color,
            frequency_type: habitData.frequency.type,
            frequency_days_of_week: habitData.frequency.daysOfWeek || null,
            frequency_interval_days: habitData.frequency.intervalDays || null,
            times_per_day: habitData.timesPerDay,
            slot_names: habitData.slotNames || null,
            reminder_time: habitData.reminderTime || null
          })
          .eq('id', habitData.id);

        if (error) throw error;

        setHabits((prev) =>
          prev.map((h) =>
            h.id === habitData.id
              ? { ...h, ...habitData, slotNames: habitData.slotNames } as Habit
              : h
          )
        );
        if (activeDetailsHabit && activeDetailsHabit.id === habitData.id) {
          setActiveDetailsHabit({
            ...activeDetailsHabit,
            ...habitData,
          } as Habit);
        }
      } else {
        // Create in Supabase
        const { data, error } = await supabase
          .from('habits')
          .insert({
            user_id: userId,
            name: habitData.name,
            category: habitData.category,
            color: habitData.color,
            frequency_type: habitData.frequency.type,
            frequency_days_of_week: habitData.frequency.daysOfWeek || null,
            frequency_interval_days: habitData.frequency.intervalDays || null,
            times_per_day: habitData.timesPerDay,
            slot_names: habitData.slotNames || null,
            reminder_time: habitData.reminderTime || null
          })
          .select()
          .single();

        if (error) throw error;

        const newHabit: Habit = {
          id: data.id,
          name: data.name,
          category: data.category as Category,
          color: data.color,
          frequency: {
            type: data.frequency_type as any,
            daysOfWeek: data.frequency_days_of_week || undefined,
            intervalDays: data.frequency_interval_days || undefined,
          },
          timesPerDay: data.times_per_day,
          slotNames: data.slot_names || undefined,
          reminderTime: data.reminder_time || undefined,
          createdAt: data.created_at.split('T')[0],
        };

        setHabits((prev) => [...prev, newHabit]);
      }
      setShowFormModal(false);
      setEditHabit(undefined);
    } catch (err: any) {
      alert(`Failed to save habit: ${err.message}`);
    }
  };

  const handleDeleteHabit = async (habitId: string) => {
    try {
      const { error } = await supabase
        .from('habits')
        .delete()
        .eq('id', habitId);

      if (error) throw error;

      setHabits((prev) => prev.filter((h) => h.id !== habitId));
      setCompletions((prev) => {
        const copy = { ...prev };
        delete copy[habitId];
        return copy;
      });
    } catch (err: any) {
      alert(`Failed to delete habit: ${err.message}`);
    }
  };

  // 9. Reset / Clear All Data
  const handleClearAllData = async () => {
    if (!session) return;
    if (window.confirm("Are you sure you want to delete all habits and completions from the cloud? This cannot be undone.")) {
      try {
        const { error } = await supabase
          .from('habits')
          .delete()
          .eq('user_id', session.user.id);

        if (error) throw error;

        setHabits([]);
        setCompletions({});
        alert("All cloud data deleted successfully!");
      } catch (err: any) {
        alert(`Failed to clear data: ${err.message}`);
      }
    }
  };

  // 10. Backup JSON Export / Import
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

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!session) return;
    const userId = session.user.id;
    const fileReader = new FileReader();
    if (!e.target.files || e.target.files.length === 0) return;
    
    fileReader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.habits && parsed.completions) {
          if (!window.confirm("Importing a backup will merge and update your habits in the cloud. Do you want to proceed?")) return;

          const habitsToImport = parsed.habits as Habit[];
          for (const h of habitsToImport) {
            await supabase
              .from('habits')
              .upsert({
                id: h.id,
                user_id: userId,
                name: h.name,
                category: h.category,
                color: h.color,
                frequency_type: h.frequency.type,
                frequency_days_of_week: h.frequency.daysOfWeek || null,
                frequency_interval_days: h.frequency.intervalDays || null,
                times_per_day: h.timesPerDay,
                slot_names: h.slotNames || null,
                reminder_time: h.reminderTime || null,
                created_at: h.createdAt
              });
          }

          const completionsToImport = parsed.completions as CompletionLog;
          for (const [habitId, logObj] of Object.entries(completionsToImport)) {
            for (const [dateStr, compObj] of Object.entries(logObj)) {
              await supabase
                .from('completions')
                .upsert({
                  user_id: userId,
                  habit_id: habitId,
                  date: dateStr,
                  count: compObj.count,
                  slots: compObj.slots || null
                }, { onConflict: 'habit_id,date' });
            }
          }

          setSession({ ...session });
          alert("Backup successfully synced to your cloud database!");
        } else {
          alert("Invalid backup file structure.");
        }
      } catch (err) {
        alert("Failed to parse backup JSON file.");
      }
    };
    fileReader.readAsText(e.target.files[0]);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  // 11. Filtered Habit List
  const filteredHabits = habits.filter((habit) => {
    const matchesCategory = selectedCategory === 'All' || habit.category === selectedCategory;
    const matchesSearch = habit.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getWeekDatesHeaderString = () => {
    if (weekDates.length < 7) return '';
    const first = weekDates[0];
    const last = weekDates[6];
    
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${first.toLocaleDateString('en-US', options)} - ${last.toLocaleDateString('en-US', options)}, ${last.getFullYear()}`;
  };

  if (loadingSession) {
    return (
      <div className="app-loading-screen">
        <Sparkles size={36} className="logo-sparkle spinner" />
        <span className="font-mono" style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>
          Loading Rhythm...
        </span>
        <style>{`
          .app-loading-screen {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            width: 100vw;
            background-color: #09090b;
            color: #f4f4f5;
          }
          .spinner {
            animation: spin 1.2s linear infinite;
            color: #d8c3a5;
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="app-container">
      {/* Sidebar navigation, stats, and auth state */}
      <aside className="app-sidebar">
        <div className="sidebar-header">
          <div className="logo-section">
            <Sparkles size={20} className="logo-sparkle" />
            <h2 className="logo-title font-mono">Rhythm</h2>
          </div>
          <span className="app-subtitle">Synced to Cloud</span>
        </div>

        {/* User Account / Sign Out Section */}
        <div className="sidebar-section">
          <div className="user-profile-box font-mono">
            <span className="user-email-label" title={session.user.email}>
              {session.user.email}
            </span>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="sidebar-section">
          <h3 className="section-label">View Mode</h3>
          <div className="tab-control">
            <button
              type="button"
              className={`tab-btn ${viewMode === 'weekly' ? 'active' : ''}`}
              onClick={() => setViewMode('weekly')}
            >
              Weekly Grid
            </button>
            <button
              type="button"
              className={`tab-btn ${viewMode === 'heatmaps' ? 'active' : ''}`}
              onClick={() => setViewMode('heatmaps')}
            >
              Heatmaps
            </button>
          </div>
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

        {/* Actions / Export & Sign Out */}
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
            <span>Clear Cloud Data</span>
          </button>

          <button className="sidebar-action-btn sidebar-signout-btn" onClick={handleSignOut}>
            <LogOut size={14} />
            <span>Sign Out</span>
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

        {/* Week navigation controller (only visible in Weekly Grid mode) */}
        {viewMode === 'weekly' && (
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
        )}

        {viewMode === 'weekly' ? (
          <>
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
          </>
        ) : (
          /* Heatmap Overview List View Mode */
          <div className="heatmap-overview-container">
            {filteredHabits.length > 0 ? (
              filteredHabits.map((habit) => {
                const streak = getHabitStreak(habit);
                const totalChecks = getHabitTotalChecks(habit);
                const heatmapWeeks = generateHeatmapDataForOverview(habit);

                return (
                  <div key={habit.id} className="overview-heatmap-card" onClick={() => setActiveDetailsHabit(habit)}>
                    <div className="overview-card-header">
                      <div className="overview-header-left">
                        <span className="habit-color-indicator" style={{ backgroundColor: habit.color }} />
                        <h4 className="habit-name">{habit.name}</h4>
                        <span className={`badge badge-${habit.category.toLowerCase()}`}>
                          {habit.category}
                        </span>
                      </div>
                      <div className="overview-header-right font-mono">
                        {streak > 0 && (
                          <span className="habit-streak pulse-flame" style={{ color: habit.color }}>
                            <Flame size={12} fill={habit.color} />
                            {streak}d streak
                          </span>
                        )}
                        <span className="total-checks-badge">
                          {totalChecks} check{totalChecks !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    
                    <div className="overview-card-body">
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
                                      backgroundColor: day.isFuture ? 'transparent' : getCellColorForOverview(habit.color, day.intensity),
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
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="empty-state">
                <CheckSquare size={48} className="empty-icon" />
                <h3>No habits found</h3>
                <p>Create a habit or adjust your search filters to get started.</p>
              </div>
            )}
          </div>
        )}
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

      {/* Embedded application style rules */}
      <style>{`
        /* User profile box styling */
        .user-profile-box {
          background-color: rgba(39, 39, 42, 0.3);
          border: 1px solid var(--card-border);
          border-radius: 6px;
          padding: 8px 12px;
          font-size: 0.72rem;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .user-email-label {
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
          max-width: 100%;
        }

        /* View Mode tabs styling */
        .tab-control {
          display: flex;
          background-color: var(--input-bg);
          border: 1px solid var(--input-border);
          border-radius: var(--border-radius);
          padding: 3px;
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
          box-shadow: var(--shadow-sm);
        }

        /* Heatmap Overview Cards List Styling */
        .heatmap-overview-container {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .overview-heatmap-card {
          background-color: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: var(--border-radius);
          padding: 20px;
          cursor: pointer;
          transition: border-color var(--transition-fast), transform var(--transition-fast);
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .overview-heatmap-card:hover {
          border-color: rgba(216, 195, 165, 0.3);
          transform: translateY(-1px);
        }
        .overview-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
        }
        .overview-header-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .overview-header-right {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 0.8rem;
          color: var(--text-secondary);
        }
        .total-checks-badge {
          background-color: rgba(39, 39, 42, 0.4);
          border: 1px solid var(--card-border);
          border-radius: 4px;
          padding: 2px 8px;
        }
        .overview-card-body {
          display: flex;
          flex-direction: column;
        }

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
        .sidebar-signout-btn:hover {
          border-color: var(--color-language) !important;
          color: var(--color-language) !important;
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
