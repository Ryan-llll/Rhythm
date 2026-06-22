import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './src/lib/supabase';
import { Session } from '@supabase/supabase-js';
import {
  Sparkles,
  Plus,
  Search,
  Flame,
  Trash2,
  LogOut,
  Check,
  Minus,
  Mail,
  Lock,
  Moon,
  Sun,
  X,
  Clock,
  Edit,
  Eye,
  ChevronLeft,
  ChevronRight
} from 'lucide-react-native';

// Categories and colors mapping matching web version
type Category = 'Faith' | 'Health' | 'Study' | 'Language' | 'Family' | 'Life';
type FrequencyType = 'daily' | 'weekly' | 'interval';

interface Frequency {
  type: FrequencyType;
  daysOfWeek?: number[];
  intervalDays?: number;
}

interface Habit {
  id: string;
  name: string;
  category: Category;
  color: string;
  frequency: Frequency;
  timesPerDay: number;
  slotNames?: string[];
  reminderTime?: string;
  createdAt: string;
}

interface HabitCompletion {
  count: number;
  slots?: boolean[];
}

interface CompletionLog {
  [habitId: string]: {
    [dateStr: string]: HabitCompletion;
  };
}

const CATEGORIES: Category[] = ['Faith', 'Health', 'Study', 'Language', 'Family', 'Life'];

const CATEGORY_COLORS: Record<Category, string> = {
  Faith: '#d8c3a5',    // Gold
  Health: '#a78bfa',   // Purple
  Study: '#60a5fa',    // Blue
  Language: '#fb923c', // Orange
  Family: '#f87171',   // Soft Red
  Life: '#4ade80',     // Green
};

const DAYS_OF_WEEK_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
  const [useOfflineMode, setUseOfflineMode] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Auth Inputs
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  // 2. Habits and Completions State
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<CompletionLog>({});
  
  // Dashboard view mode
  const [viewMode, setViewMode] = useState<'weekly' | 'heatmaps'>('weekly');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [weekOffset, setWeekOffset] = useState(0);

  // Modals / Details
  const [activeDetailsHabit, setActiveDetailsHabit] = useState<Habit | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [slotCheckoffTarget, setSlotCheckoffTarget] = useState<{ habit: Habit; dateStr: string } | null>(null);

  // Add Habit Form Inputs
  const [habitName, setHabitName] = useState('');
  const [habitCategory, setHabitCategory] = useState<Category>('Faith');
  const [habitFreqType, setHabitFreqType] = useState<FrequencyType>('daily');
  const [habitDaysOfWeek, setHabitDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri
  const [habitIntervalDays, setHabitIntervalDays] = useState(3);
  const [habitTimesPerDay, setHabitTimesPerDay] = useState(1);
  const [habitSlotNames, setHabitSlotNames] = useState<string[]>([]);
  const [habitReminder, setHabitReminder] = useState('');
  const [hasReminder, setHasReminder] = useState(false);

  // Initialize Auth Listener and Theme
  useEffect(() => {
    AsyncStorage.getItem('rhythm_theme').then((savedTheme) => {
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setTheme(savedTheme);
      }
    });

    AsyncStorage.getItem('rhythm_offline_mode').then((savedOffline) => {
      if (savedOffline === 'true') {
        setUseOfflineMode(true);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingSession(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Autosave offline data
  useEffect(() => {
    if (!session && useOfflineMode) {
      AsyncStorage.setItem('rhythm_local_habits', JSON.stringify(habits));
    }
  }, [habits, session, useOfflineMode]);

  useEffect(() => {
    if (!session && useOfflineMode) {
      AsyncStorage.setItem('rhythm_local_completions', JSON.stringify(completions));
    }
  }, [completions, session, useOfflineMode]);

  // Load Data
  useEffect(() => {
    if (!session) {
      if (useOfflineMode) {
        AsyncStorage.getItem('rhythm_local_habits').then((localHabits) => {
          if (localHabits) setHabits(JSON.parse(localHabits));
        });
        AsyncStorage.getItem('rhythm_local_completions').then((localCompletions) => {
          if (localCompletions) setCompletions(JSON.parse(localCompletions));
        });
      } else {
        setHabits([]);
        setCompletions({});
      }
      return;
    }

    const fetchUserData = async () => {
      try {
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
        console.error('Error fetching data:', error);
      }
    };

    fetchUserData();
  }, [session, useOfflineMode]);

  // Theme Colors
  const colors = {
    bg: theme === 'dark' ? '#09090b' : '#fcfcfc',
    card: theme === 'dark' ? '#18181b' : '#ffffff',
    border: theme === 'dark' ? '#27272a' : '#e2e8f0',
    inputBg: theme === 'dark' ? '#27272a' : '#f1f5f9',
    inputBorder: theme === 'dark' ? '#3f3f46' : '#cbd5e1',
    textPrimary: theme === 'dark' ? '#f4f4f5' : '#0f172a',
    textSecondary: theme === 'dark' ? '#a1a1aa' : '#475569',
    textMuted: theme === 'dark' ? '#71717a' : '#94a3b8',
    accent: theme === 'dark' ? '#d8c3a5' : '#b5986c', // Gold
  };

  const getWeekDays = (offset: number) => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(today);
    monday.setDate(diff + offset * 7);
    
    return Array.from({ length: 7 }).map((_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      return date;
    });
  };

  const weekDates = getWeekDays(weekOffset);

  // Authentication logic
  const handleAuthSubmit = async () => {
    if (!authEmail || !authPassword) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    setAuthLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
        Alert.alert('Success', 'Account created! Logging you in...');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      Alert.alert('Authentication Error', err.message || 'An error occurred.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleOfflineModeSelect = () => {
    setUseOfflineMode(true);
    AsyncStorage.setItem('rhythm_offline_mode', 'true');
  };

  const handleSignOut = async () => {
    if (session) {
      await supabase.auth.signOut();
      setSession(null);
    } else {
      setUseOfflineMode(false);
      AsyncStorage.removeItem('rhythm_offline_mode');
      setHabits([]);
      setCompletions({});
    }
  };

  // Completion Toggles (Supabase / local fallback)
  const handleToggleCompletion = async (habitId: string, dateStr: string, slotIndex?: number) => {
    if (!session && !useOfflineMode) return;

    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    const habitComps = completions[habitId] || {};
    const current = habitComps[dateStr] || { count: 0 };

    let updated: HabitCompletion;

    if (habit.timesPerDay > 1) {
      const slots = [...(current.slots || Array(habit.timesPerDay).fill(false))];
      if (slotIndex !== undefined) {
        slots[slotIndex] = !slots[slotIndex];
      } else {
        // Toggle first slot or toggle all
        const allChecked = slots.every(s => s);
        slots.fill(!allChecked);
      }
      const count = slots.filter(s => s).length;
      updated = { count, slots };
    } else {
      const count = current.count > 0 ? 0 : 1;
      updated = { count };
    }

    if (session) {
      const userId = session.user.id;
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
        console.error('Error syncing:', error);
        return;
      }
    }

    setCompletions((prev) => {
      const newComps = { ...prev };
      newComps[habitId] = {
        ...habitComps,
        [dateStr]: updated
      };
      return newComps;
    });

    // Update active checkoff modal if open
    if (slotCheckoffTarget && slotCheckoffTarget.habit.id === habitId && slotCheckoffTarget.dateStr === dateStr) {
      setSlotCheckoffTarget({ habit, dateStr });
    }
  };

  // Calculate Streak helper
  const getHabitStreak = (habit: Habit): number => {
    const habitComps = completions[habit.id] || {};
    let streak = 0;
    const checkDate = new Date();

    while (true) {
      const dStr = formatDateStr(checkDate);
      if (dStr < habit.createdAt) break;

      // Check if due
      const dayOfWeek = checkDate.getDay();
      let due = false;
      if (habit.frequency.type === 'daily') due = true;
      else if (habit.frequency.type === 'weekly') due = habit.frequency.daysOfWeek?.includes(dayOfWeek) ?? false;
      else if (habit.frequency.type === 'interval') {
        const created = new Date(habit.createdAt + 'T00:00:00');
        const curr = new Date(dStr + 'T00:00:00');
        const diffTime = Math.abs(curr.getTime() - created.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        due = diffDays % (habit.frequency.intervalDays || 1) === 0;
      }

      if (due) {
        const comp = habitComps[dStr];
        const completed = habit.timesPerDay > 1 
          ? (comp?.slots?.filter(s => s).length || 0) === habit.timesPerDay
          : (comp?.count || 0) > 0;
        
        if (completed) {
          streak++;
        } else {
          // If today and not completed yet, streak is still alive
          if (dStr !== formatDateStr(new Date())) {
            break;
          }
        }
      }
      checkDate.setDate(checkDate.getDate() - 1);
    }
    return streak;
  };

  // Get total checks count
  const getHabitTotalChecks = (habit: Habit): number => {
    const habitComps = completions[habit.id] || {};
    let total = 0;
    Object.values(habitComps).forEach((log) => {
      total += log.count;
    });
    return total;
  };

  // Generate 6-Month Heatmap cells
  const generateHeatmapWeeks = (habit: Habit) => {
    const weeksCount = 20; // 20 weeks fits well on landscape scroll
    const totalDays = weeksCount * 7;
    const days = [];
    const today = new Date();
    
    // Find the nearest Sunday to end on
    const currentDay = today.getDay();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + (6 - currentDay));

    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - totalDays + 1);

    const habitComps = completions[habit.id] || {};

    const tempDate = new Date(startDate);
    while (tempDate <= endDate) {
      const dStr = formatDateStr(tempDate);
      const isFuture = tempDate > today;
      const comp = habitComps[dStr];
      const count = comp?.count || 0;
      
      let intensity = 0;
      if (count > 0) {
        if (habit.timesPerDay > 1) {
          const ratio = (comp?.slots?.filter(s => s).length || 0) / habit.timesPerDay;
          if (ratio <= 0.25) intensity = 1;
          else if (ratio <= 0.5) intensity = 2;
          else if (ratio <= 0.75) intensity = 3;
          else intensity = 4;
        } else {
          intensity = Math.min(count, 4);
        }
      }

      days.push({
        dateStr: dStr,
        intensity,
        isFuture,
      });

      tempDate.setDate(tempDate.getDate() + 1);
    }

    const weeks = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }
    return weeks;
  };

  // Reset form inputs
  const resetForm = () => {
    setHabitName('');
    setHabitCategory('Faith');
    setHabitFreqType('daily');
    setHabitDaysOfWeek([1, 2, 3, 4, 5]);
    setHabitIntervalDays(3);
    setHabitTimesPerDay(1);
    setHabitSlotNames([]);
    setHabitReminder('');
    setHasReminder(false);
    setEditingHabitId(null);
  };

  // Category changes handler inside form
  const handleCategoryChange = (cat: Category) => {
    setHabitCategory(cat);
    if (cat === 'Faith') {
      setHabitTimesPerDay(5);
      setHabitSlotNames(['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']);
      setHasReminder(true);
      setHabitReminder('14:00');
    } else {
      setHabitTimesPerDay(1);
      setHabitSlotNames([]);
      setHasReminder(false);
      setHabitReminder('');
    }
  };

  const handleTimesPerDayChange = (times: number) => {
    const valid = Math.max(1, Math.min(10, times));
    setHabitTimesPerDay(valid);
    
    const newSlots = [...habitSlotNames];
    if (valid > newSlots.length) {
      for (let i = newSlots.length; i < valid; i++) {
        if (habitCategory === 'Faith' && valid === 5) {
          const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
          newSlots.push(prayers[i]);
        } else {
          newSlots.push(`Slot ${i + 1}`);
        }
      }
    } else if (valid < newSlots.length) {
      newSlots.splice(valid);
    }
    setHabitSlotNames(newSlots);
  };

  const toggleDayOfWeek = (dayVal: number) => {
    if (habitDaysOfWeek.includes(dayVal)) {
      setHabitDaysOfWeek(habitDaysOfWeek.filter(d => d !== dayVal));
    } else {
      setHabitDaysOfWeek([...habitDaysOfWeek, dayVal].sort());
    }
  };

  const handleSlotNameChange = (index: number, name: string) => {
    const updated = [...habitSlotNames];
    updated[index] = name;
    setHabitSlotNames(updated);
  };

  // Save/Create Habit
  const handleSaveHabit = async () => {
    if (!habitName.trim()) {
      Alert.alert('Error', 'Please enter a habit name.');
      return;
    }
    if (!session && !useOfflineMode) return;

    const frequency = {
      type: habitFreqType,
      daysOfWeek: habitFreqType === 'weekly' ? habitDaysOfWeek : undefined,
      intervalDays: habitFreqType === 'interval' ? habitIntervalDays : undefined,
    };

    const habitData = {
      name: habitName.trim(),
      category: habitCategory,
      color: CATEGORY_COLORS[habitCategory],
      frequency,
      timesPerDay: habitTimesPerDay,
      slotNames: habitTimesPerDay > 1 ? habitSlotNames : undefined,
      reminderTime: hasReminder && habitReminder ? habitReminder : undefined,
    };

    try {
      if (editingHabitId) {
        if (session) {
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
            .eq('id', editingHabitId);
          if (error) throw error;
        }
        setHabits(prev => prev.map(h => h.id === editingHabitId ? { ...h, ...habitData } as Habit : h));
      } else {
        let newHabit: Habit;
        if (session) {
          const { data, error } = await supabase
            .from('habits')
            .insert({
              user_id: session.user.id,
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
          newHabit = {
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
        } else {
          newHabit = {
            id: `local-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
            name: habitData.name,
            category: habitData.category,
            color: habitData.color,
            frequency: habitData.frequency,
            timesPerDay: habitData.timesPerDay,
            slotNames: habitData.slotNames,
            reminderTime: habitData.reminderTime,
            createdAt: formatDateStr(new Date()),
          };
        }
        setHabits(prev => [...prev, newHabit]);
      }
      setShowAddModal(false);
      resetForm();
    } catch (err: any) {
      Alert.alert('Error', `Failed to save habit: ${err.message}`);
    }
  };

  const handleEditHabit = (habit: Habit) => {
    setEditingHabitId(habit.id);
    setHabitName(habit.name);
    setHabitCategory(habit.category);
    setHabitFreqType(habit.frequency.type);
    setHabitDaysOfWeek(habit.frequency.daysOfWeek || [1, 2, 3, 4, 5]);
    setHabitIntervalDays(habit.frequency.intervalDays || 3);
    setHabitTimesPerDay(habit.timesPerDay);
    setHabitSlotNames(habit.slotNames || []);
    if (habit.reminderTime) {
      setHasReminder(true);
      setHabitReminder(habit.reminderTime);
    } else {
      setHasReminder(false);
      setHabitReminder('');
    }
    setActiveDetailsHabit(null);
    setShowAddModal(true);
  };

  const handleDeleteHabit = (habitId: string) => {
    Alert.alert(
      'Delete Habit',
      'Are you sure you want to delete this habit? All check-in history will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (session) {
                const { error } = await supabase
                  .from('habits')
                  .delete()
                  .eq('id', habitId);
                if (error) throw error;
              }
              setHabits(prev => prev.filter(h => h.id !== habitId));
              setCompletions(prev => {
                const copy = { ...prev };
                delete copy[habitId];
                return copy;
              });
              setActiveDetailsHabit(null);
            } catch (err: any) {
              Alert.alert('Error', `Failed to delete habit: ${err.message}`);
            }
          }
        }
      ]
    );
  };

  // Filter logic
  const filteredHabits = habits.filter(habit => {
    const matchesCategory = selectedCategory === 'All' || habit.category === selectedCategory;
    const matchesSearch = habit.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Render Auth Path
  if (!session && !useOfflineMode) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center' }]}>
        <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
        <View style={styles.authContainer}>
          <View style={styles.authCard}>
            <View style={styles.logoContainer}>
              <Sparkles size={24} color={colors.accent} />
              <Text style={styles.logoText}>Rhythm</Text>
            </View>
            <Text style={{ fontSize: 11, fontWeight: 'bold', color: colors.accent, textAlign: 'center', letterSpacing: 1.5, marginTop: -8 }}>
              DEVELOPER HABIT TRACKER
            </Text>
            
            <View style={styles.authTabRow}>
              <TouchableOpacity
                style={[styles.authTab, !isSignUp && styles.authTabActive]}
                onPress={() => setIsSignUp(false)}
              >
                <Text style={[styles.authTabText, !isSignUp && styles.authTabTextActive]}>Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.authTab, isSignUp && styles.authTabActive]}
                onPress={() => setIsSignUp(true)}
              >
                <Text style={[styles.authTabText, isSignUp && styles.authTabTextActive]}>Register</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="developer@rhythm.dev"
                placeholderTextColor={colors.textMuted}
                value={authEmail}
                onChangeText={setAuthEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                value={authPassword}
                onChangeText={setAuthPassword}
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity style={styles.authBtn} onPress={handleAuthSubmit} disabled={authLoading}>
              {authLoading ? (
                <ActivityIndicator color="#18181b" />
              ) : (
                <Text style={styles.authBtnText}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.orText}>or</Text>

            <TouchableOpacity style={styles.offlineBtn} onPress={handleOfflineModeSelect}>
              <Text style={styles.offlineBtnText}>Continue Offline (Local Storage)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Render Dashboard
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Sparkles size={20} color={colors.accent} />
          <Text style={styles.logoText}>Rhythm</Text>
        </View>
        <TouchableOpacity
          style={styles.themeBtn}
          onPress={() => {
            const next = theme === 'dark' ? 'light' : 'dark';
            setTheme(next);
            AsyncStorage.setItem('rhythm_theme', next);
          }}
        >
          {theme === 'dark' ? <Sun size={16} color={colors.accent} /> : <Moon size={16} color={colors.accent} />}
        </TouchableOpacity>
      </View>

      {/* Nav Tabs */}
      <View style={styles.navigationRow}>
        <TouchableOpacity
          style={[styles.navTab, viewMode === 'weekly' && styles.navTabActive]}
          onPress={() => setViewMode('weekly')}
        >
          <Text style={[styles.navTabText, viewMode === 'weekly' && styles.navTabTextActive]}>Weekly Grid</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navTab, viewMode === 'heatmaps' && styles.navTabActive]}
          onPress={() => setViewMode('heatmaps')}
        >
          <Text style={[styles.navTabText, viewMode === 'heatmaps' && styles.navTabTextActive]}>Heatmaps</Text>
        </TouchableOpacity>
      </View>

      {/* Main content body */}
      <View style={{ flex: 1 }}>
        {viewMode === 'weekly' ? (
          <View style={{ flex: 1 }}>
            {/* Search Bar & Categories are only loaded on the Weekly Grid view */}
            <View style={styles.searchFilterContainer}>
              <View style={styles.searchBox}>
                <Search size={16} color={colors.textMuted} style={styles.searchIcon} />
                <TextInput
                  placeholder="Search habits..."
                  placeholderTextColor={colors.textMuted}
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery !== '' && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <X size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Horizontal Category Filters */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                <TouchableOpacity
                  style={[styles.categoryCapsule, selectedCategory === 'All' && styles.categoryCapsuleActive]}
                  onPress={() => setSelectedCategory('All')}
                >
                  <Text style={[styles.categoryText, selectedCategory === 'All' && styles.categoryTextActive]}>All</Text>
                </TouchableOpacity>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryCapsule,
                      selectedCategory === cat && { backgroundColor: `${CATEGORY_COLORS[cat]}25`, borderColor: CATEGORY_COLORS[cat] }
                    ]}
                    onPress={() => setSelectedCategory(cat)}
                  >
                    <View style={[styles.catDot, { backgroundColor: CATEGORY_COLORS[cat] }]} />
                    <Text
                      style={[
                        styles.categoryText,
                        selectedCategory === cat && { color: CATEGORY_COLORS[cat], fontWeight: 'bold' }
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Weekly checklist grid */}
            <ScrollView style={styles.viewContainer} contentContainerStyle={{ paddingBottom: 100 }}>
              {/* Week Navigation controls */}
              <View style={styles.weekNavRow}>
                <TouchableOpacity onPress={() => setWeekOffset(prev => prev - 1)} style={styles.weekNavBtn}>
                  <ChevronLeft size={16} color={colors.textSecondary} />
                </TouchableOpacity>
                <Text style={styles.weekLabelText}>
                  {weekOffset === 0 ? 'This Week' : weekOffset === -1 ? 'Last Week' : `${weekOffset} Weeks Ago`}
                </Text>
                <TouchableOpacity onPress={() => setWeekOffset(prev => Math.min(0, prev + 1))} style={styles.weekNavBtn} disabled={weekOffset === 0}>
                  <ChevronRight size={16} color={weekOffset === 0 ? colors.textMuted : colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {filteredHabits.length > 0 ? (
                filteredHabits.map((habit) => {
                  const streak = getHabitStreak(habit);
                  return (
                    <View key={habit.id} style={styles.habitCard}>
                      <View style={styles.habitHeader}>
                        <TouchableOpacity
                          style={styles.habitTitleWrapper}
                          onPress={() => setActiveDetailsHabit(habit)}
                        >
                          <View style={[styles.colorDot, { backgroundColor: CATEGORY_COLORS[habit.category] }]} />
                          <Text style={styles.habitName} numberOfLines={1}>{habit.name}</Text>
                          <Eye size={12} color={colors.textMuted} style={{ marginLeft: 4 }} />
                        </TouchableOpacity>
                        <View style={styles.metaRow}>
                          <View style={[styles.badge, { backgroundColor: `${CATEGORY_COLORS[habit.category]}20`, borderColor: `${CATEGORY_COLORS[habit.category]}40`, borderWidth: 1 }]}>
                            <Text style={[styles.badgeText, { color: CATEGORY_COLORS[habit.category] }]}>{habit.category}</Text>
                          </View>
                          {streak > 0 && (
                            <View style={styles.streakWrapper}>
                              <Flame size={12} color={CATEGORY_COLORS[habit.category]} />
                              <Text style={[styles.streakText, { color: CATEGORY_COLORS[habit.category] }]}>{streak}d</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Week Cells */}
                      <View style={styles.weeklyGrid}>
                        {weekDates.map((date, idx) => {
                          const dateStr = formatDateStr(date);
                          const log = completions[habit.id]?.[dateStr] || { count: 0 };
                          const isCompleted = habit.timesPerDay > 1 
                            ? (log.slots?.filter(s => s).length || 0) === habit.timesPerDay
                            : log.count > 0;
                          
                          const completedSlotsCount = log.slots?.filter(s => s).length || 0;

                          return (
                            <TouchableOpacity
                              key={dateStr}
                              style={[
                                styles.dayCell,
                                isCompleted && {
                                  borderColor: CATEGORY_COLORS[habit.category],
                                  backgroundColor: `${CATEGORY_COLORS[habit.category]}1c`,
                                }
                              ]}
                              onPress={() => {
                                if (habit.timesPerDay > 1) {
                                  setSlotCheckoffTarget({ habit, dateStr });
                                } else {
                                  handleToggleCompletion(habit.id, dateStr);
                                }
                              }}
                            >
                              <Text style={styles.dayNumText}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'][idx === 0 ? 6 : idx - 1]}</Text>
                              {habit.timesPerDay > 1 ? (
                                <Text style={[styles.slotsRatioText, { color: CATEGORY_COLORS[habit.category] }]}>
                                  {completedSlotsCount}/{habit.timesPerDay}
                                </Text>
                              ) : (
                                isCompleted && <Check size={12} color={CATEGORY_COLORS[habit.category]} strokeWidth={3} />
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={{ color: colors.textMuted, fontSize: 14 }}>No habits found matching filters.</Text>
                </View>
              )}
            </ScrollView>

            {/* FAB button to create habit - ONLY on Weekly Grid */}
            <TouchableOpacity style={styles.fab} onPress={() => { resetForm(); setShowAddModal(true); }}>
              <Plus size={24} color="#18181b" strokeWidth={3} />
            </TouchableOpacity>
          </View>
        ) : (
          /* Heatmap list: shows vertical lists of heatmaps directly on screen */
          <ScrollView style={styles.viewContainer} contentContainerStyle={{ paddingBottom: 100 }}>
            <View style={styles.heatmapHeaderBox}>
              <Text style={styles.heatmapOverviewTitle}>Contribution Heatmaps</Text>
              <Text style={{ fontSize: 11, color: colors.textMuted, marginHorizontal: 16, marginTop: 4 }}>
                GitHub-style grid showing your last 20 weeks of activity.
              </Text>
            </View>

            {habits.length > 0 ? (
              habits.map((habit) => {
                const weeks = generateHeatmapWeeks(habit);
                const streak = getHabitStreak(habit);
                return (
                  <View key={habit.id} style={styles.heatmapCard}>
                    <TouchableOpacity
                      style={styles.heatmapTitleBlock}
                      onPress={() => setActiveDetailsHabit(habit)}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={[styles.colorDot, { backgroundColor: CATEGORY_COLORS[habit.category] }]} />
                        <Text style={styles.heatmapName}>{habit.name}</Text>
                        <Eye size={12} color={colors.textMuted} />
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                        <View style={[styles.badge, { backgroundColor: `${CATEGORY_COLORS[habit.category]}20`, borderColor: `${CATEGORY_COLORS[habit.category]}40`, borderWidth: 1 }]}>
                          <Text style={[styles.badgeText, { color: CATEGORY_COLORS[habit.category] }]}>{habit.category}</Text>
                        </View>
                        {streak > 0 && (
                          <View style={styles.streakWrapper}>
                            <Flame size={12} color={CATEGORY_COLORS[habit.category]} />
                            <Text style={[styles.streakText, { color: CATEGORY_COLORS[habit.category] }]}>{streak}d</Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>

                    {/* Scrollable Heatmap grid */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.heatmapRow}>
                        {weeks.map((week, wIdx) => (
                          <View key={wIdx} style={styles.heatmapCol}>
                            {week.map((day) => {
                              const opacities = [0.1, 0.35, 0.6, 0.8, 1];
                              const baseCol = CATEGORY_COLORS[habit.category];
                              let cellBg = colors.border;
                              
                              if (day.intensity > 0) {
                                cellBg = baseCol;
                              }

                              return (
                                <View
                                  key={day.dateStr}
                                  style={[
                                    styles.heatmapCell,
                                    {
                                      backgroundColor: day.isFuture ? 'transparent' : cellBg,
                                      borderColor: day.isFuture ? colors.border : 'transparent',
                                      opacity: day.isFuture ? 0.2 : opacities[day.intensity] || 1,
                                    }
                                  ]}
                                />
                              );
                            })}
                          </View>
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={{ color: colors.textMuted, fontSize: 14 }}>Create a habit to view its heatmap grid.</Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>

      {/* Footer info & sign out */}
      <View style={styles.footerActions}>
        <View style={{ flexDirection: 'column' }}>
          <Text style={{ fontSize: 9, fontWeight: 'bold', color: colors.textMuted }}>PERSISTENCE SOURCE</Text>
          <Text style={{ fontSize: 11, fontWeight: 'bold', color: colors.textPrimary }}>
            {session ? session.user.email : 'Guest Mode (Offline)'}
          </Text>
        </View>
        <TouchableOpacity style={styles.footerBtn} onPress={handleSignOut}>
          <LogOut size={12} color={colors.textSecondary} />
          <Text style={styles.footerBtnText}>{session ? 'Sign Out' : 'Connect Cloud'}</Text>
        </TouchableOpacity>
      </View>

      {/* Modal 1: Habit Form (Add / Edit) */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalWrapper}
          >
            <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Modal Header */}
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  {editingHabitId ? 'Edit Habit' : 'New Habit'}
                </Text>
                <TouchableOpacity onPress={() => setShowAddModal(false)} style={styles.closeBtn}>
                  <X size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ padding: 18 }}>
                {/* Habit Name Input */}
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Habit Name</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                    placeholder="e.g. Code for 2 hours"
                    placeholderTextColor={colors.textMuted}
                    value={habitName}
                    onChangeText={setHabitName}
                  />
                </View>

                {/* Category Selection */}
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Category</Text>
                  <View style={styles.categoryBadgeRow}>
                    {CATEGORIES.map(cat => (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.catBadgeItem,
                          habitCategory === cat && { backgroundColor: `${CATEGORY_COLORS[cat]}25`, borderColor: CATEGORY_COLORS[cat], borderWidth: 1 }
                        ]}
                        onPress={() => handleCategoryChange(cat)}
                      >
                        <View style={[styles.catDot, { backgroundColor: CATEGORY_COLORS[cat] }]} />
                        <Text style={[styles.catBadgeText, { color: habitCategory === cat ? CATEGORY_COLORS[cat] : colors.textSecondary }]}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Times Per Day (Multi-Slot selector) */}
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Goal Frequency per Day</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                    <TouchableOpacity
                      onPress={() => handleTimesPerDayChange(habitTimesPerDay - 1)}
                      style={[styles.slotCounterBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                    >
                      <Minus size={16} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.textPrimary }}>
                      {habitTimesPerDay} check-in{habitTimesPerDay > 1 ? 's' : ''} per day
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleTimesPerDayChange(habitTimesPerDay + 1)}
                      style={[styles.slotCounterBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                    >
                      <Plus size={16} color={colors.textPrimary} />
                    </TouchableOpacity>
                  </View>

                  {/* Slot customization inputs if > 1 times per day */}
                  {habitTimesPerDay > 1 && (
                    <View style={styles.slotsInputSection}>
                      <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 8, fontWeight: 'bold' }}>
                        CUSTOMIZE SLOT NAMES:
                      </Text>
                      {Array.from({ length: habitTimesPerDay }).map((_, idx) => (
                        <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <Text style={{ fontSize: 12, color: colors.textMuted, width: 50 }}>Slot {idx + 1}</Text>
                          <TextInput
                            style={[
                              styles.slotNameInput,
                              { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }
                            ]}
                            value={habitSlotNames[idx] || `Slot ${idx + 1}`}
                            onChangeText={(text) => handleSlotNameChange(idx, text)}
                          />
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* Frequency Type */}
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Frequency Type</Text>
                  <View style={styles.freqTabRow}>
                    {(['daily', 'weekly', 'interval'] as FrequencyType[]).map(type => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.freqTab,
                          habitFreqType === type && { backgroundColor: colors.border }
                        ]}
                        onPress={() => setHabitFreqType(type)}
                      >
                        <Text style={[styles.freqTabText, { color: habitFreqType === type ? colors.accent : colors.textSecondary }]}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Weekly days checkboxes */}
                  {habitFreqType === 'weekly' && (
                    <View style={{ marginTop: 12 }}>
                      <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 8, fontWeight: 'bold' }}>
                        SELECT ACTIVE DAYS:
                      </Text>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 4 }}>
                        {DAYS_OF_WEEK_LABELS.map((label, idx) => {
                          const active = habitDaysOfWeek.includes(idx);
                          return (
                            <TouchableOpacity
                              key={label}
                              style={[
                                styles.dayCheckbox,
                                { borderColor: colors.border },
                                active && { backgroundColor: colors.accent, borderColor: colors.accent }
                              ]}
                              onPress={() => toggleDayOfWeek(idx)}
                            >
                              <Text style={{ fontSize: 10, fontWeight: 'bold', color: active ? '#18181b' : colors.textSecondary }}>
                                {label.charAt(0)}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {/* Interval input */}
                  {habitFreqType === 'interval' && (
                    <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={{ fontSize: 13, color: colors.textSecondary }}>Repeat every</Text>
                      <TextInput
                        style={[
                          styles.numInput,
                          { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }
                        ]}
                        keyboardType="numeric"
                        value={String(habitIntervalDays)}
                        onChangeText={(t) => setHabitIntervalDays(Number(t) || 1)}
                      />
                      <Text style={{ fontSize: 13, color: colors.textSecondary }}>days</Text>
                    </View>
                  )}
                </View>

                {/* Reminder toggle */}
                <View style={styles.formGroup}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                    onPress={() => setHasReminder(!hasReminder)}
                  >
                    <View style={[styles.checkboxBox, { borderColor: colors.border }, hasReminder && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                      {hasReminder && <Check size={12} color="#18181b" strokeWidth={3} />}
                    </View>
                    <Text style={{ fontSize: 13, color: colors.textPrimary, fontWeight: 'bold' }}>Set Daily Reminder Time</Text>
                  </TouchableOpacity>

                  {hasReminder && (
                    <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Clock size={16} color={colors.textSecondary} />
                      <TextInput
                        style={[
                          styles.slotNameInput,
                          { width: 100, backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }
                        ]}
                        placeholder="14:00"
                        placeholderTextColor={colors.textMuted}
                        value={habitReminder}
                        onChangeText={setHabitReminder}
                      />
                    </View>
                  )}
                </View>

                <View style={{ height: 40 }} />
              </ScrollView>

              {/* Form Footer */}
              <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
                <TouchableOpacity style={[styles.footerCancelBtn, { borderColor: colors.border }]} onPress={() => setShowAddModal(false)}>
                  <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.footerSaveBtn, { backgroundColor: colors.accent }]} onPress={handleSaveHabit}>
                  <Text style={{ color: '#18181b', fontWeight: 'bold' }}>Save Habit</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Modal 2: Habit Details & Management */}
      <Modal
        visible={activeDetailsHabit !== null}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setActiveDetailsHabit(null)}
      >
        <View style={styles.modalOverlay}>
          {activeDetailsHabit && (
            <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border, maxWidth: 360 }]}>
              {/* Header */}
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <View style={[styles.colorDot, { backgroundColor: CATEGORY_COLORS[activeDetailsHabit.category] }]} />
                  <Text style={[styles.modalTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {activeDetailsHabit.name}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setActiveDetailsHabit(null)} style={styles.closeBtn}>
                  <X size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={{ padding: 18, gap: 16 }}>
                {/* Category tag */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, color: colors.textMuted, fontWeight: 'bold' }}>CATEGORY</Text>
                  <View style={[styles.badge, { backgroundColor: `${CATEGORY_COLORS[activeDetailsHabit.category]}25`, borderColor: CATEGORY_COLORS[activeDetailsHabit.category], borderWidth: 1 }]}>
                    <Text style={{ color: CATEGORY_COLORS[activeDetailsHabit.category], fontSize: 11, fontWeight: 'bold' }}>
                      {activeDetailsHabit.category}
                    </Text>
                  </View>
                </View>

                {/* Stats */}
                <View style={styles.statsCardGrid}>
                  <View style={[styles.statCardBlock, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                    <Flame size={18} color={CATEGORY_COLORS[activeDetailsHabit.category]} />
                    <Text style={[styles.statCardVal, { color: colors.textPrimary }]}>
                      {getHabitStreak(activeDetailsHabit)}d
                    </Text>
                    <Text style={{ fontSize: 10, color: colors.textSecondary }}>Current Streak</Text>
                  </View>

                  <View style={[styles.statCardBlock, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                    <Text style={[styles.statCardVal, { color: colors.textPrimary, fontSize: 18 }]}>
                      {getHabitTotalChecks(activeDetailsHabit)}
                    </Text>
                    <Text style={{ fontSize: 10, color: colors.textSecondary }}>Total Check-ins</Text>
                  </View>
                </View>

                {/* Frequency configuration info */}
                <View style={[styles.infoSectionRow, { borderBottomColor: colors.border }]}>
                  <Text style={{ fontSize: 12, color: colors.textMuted, fontWeight: 'bold' }}>FREQUENCY</Text>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                    {activeDetailsHabit.frequency.type === 'daily'
                      ? 'Everyday'
                      : activeDetailsHabit.frequency.type === 'weekly'
                      ? 'Specific days weekly'
                      : `Every ${activeDetailsHabit.frequency.intervalDays} days`}
                  </Text>
                </View>

                {/* Reminder info */}
                {activeDetailsHabit.reminderTime && (
                  <View style={[styles.infoSectionRow, { borderBottomColor: colors.border }]}>
                    <Text style={{ fontSize: 12, color: colors.textMuted, fontWeight: 'bold' }}>REMINDER</Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                      {activeDetailsHabit.reminderTime} daily
                    </Text>
                  </View>
                )}

                {/* Slots details if multi-slot */}
                {activeDetailsHabit.timesPerDay > 1 && (
                  <View>
                    <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: 'bold', marginBottom: 6 }}>
                      COMPLETION SLOTS ({activeDetailsHabit.timesPerDay})
                    </Text>
                    {activeDetailsHabit.slotNames?.map((slot, idx) => (
                      <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: CATEGORY_COLORS[activeDetailsHabit.category] }} />
                        <Text style={{ fontSize: 13, color: colors.textPrimary }}>{slot}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Action buttons */}
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                  <TouchableOpacity
                    style={[styles.detailsActionBtn, { flex: 1, borderColor: colors.border }]}
                    onPress={() => handleEditHabit(activeDetailsHabit)}
                  >
                    <Edit size={14} color={colors.textSecondary} />
                    <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>Edit Habit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.detailsActionBtn, { borderColor: '#f8717140', backgroundColor: '#f8717112' }]}
                    onPress={() => handleDeleteHabit(activeDetailsHabit.id)}
                  >
                    <Trash2 size={14} color="#f87171" />
                    <Text style={{ color: '#f87171', fontSize: 13, fontWeight: '600' }}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* Modal 3: Slot Checkoff Overlay */}
      <Modal
        visible={slotCheckoffTarget !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSlotCheckoffTarget(null)}
      >
        <View style={styles.modalOverlay}>
          {slotCheckoffTarget && (
            <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 'auto', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}>
              {/* Header */}
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: colors.accent, fontWeight: 'bold' }}>CHECK OFF SLOTS</Text>
                  <Text style={[styles.modalTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {slotCheckoffTarget.habit.name}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSlotCheckoffTarget(null)} style={styles.closeBtn}>
                  <X size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={{ padding: 18 }}>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 12 }}>
                  Date: {slotCheckoffTarget.dateStr}
                </Text>

                {/* Slots Rows */}
                {Array.from({ length: slotCheckoffTarget.habit.timesPerDay }).map((_, slotIdx) => {
                  const slotName = slotCheckoffTarget.habit.slotNames?.[slotIdx] || `Slot ${slotIdx + 1}`;
                  const isChecked = completions[slotCheckoffTarget.habit.id]?.[slotCheckoffTarget.dateStr]?.slots?.[slotIdx] ?? false;
                  
                  return (
                    <TouchableOpacity
                      key={slotIdx}
                      style={[
                        styles.slotCheckoffRow,
                        { borderColor: colors.border },
                        isChecked && { backgroundColor: `${CATEGORY_COLORS[slotCheckoffTarget.habit.category]}10` }
                      ]}
                      onPress={() => handleToggleCompletion(slotCheckoffTarget.habit.id, slotCheckoffTarget.dateStr, slotIdx)}
                    >
                      <Text style={[styles.slotRowName, { color: isChecked ? CATEGORY_COLORS[slotCheckoffTarget.habit.category] : colors.textPrimary }]}>
                        {slotName}
                      </Text>
                      <View
                        style={[
                          styles.checkboxBox,
                          { borderColor: colors.border },
                          isChecked && { backgroundColor: CATEGORY_COLORS[slotCheckoffTarget.habit.category], borderColor: CATEGORY_COLORS[slotCheckoffTarget.habit.category] }
                        ]}
                      >
                        {isChecked && <Check size={12} color="#18181b" strokeWidth={3} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  style={[styles.doneBtn, { backgroundColor: colors.accent }]}
                  onPress={() => setSlotCheckoffTarget(null)}
                >
                  <Text style={{ fontWeight: 'bold', color: '#18181b' }}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f4f4f5',
    letterSpacing: -0.5,
  },
  themeBtn: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#27272a',
    backgroundColor: '#18181b',
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  authCard: {
    width: '100%',
    maxWidth: 360,
    padding: 24,
    borderRadius: 16,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    gap: 16,
  },
  authTabRow: {
    flexDirection: 'row',
    backgroundColor: '#27272a',
    borderRadius: 8,
    padding: 3,
    marginBottom: 4,
  },
  authTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  authTabActive: {
    backgroundColor: '#3f3f46',
  },
  authTabText: {
    color: '#a1a1aa',
    fontWeight: '600',
    fontSize: 13,
  },
  authTabTextActive: {
    color: '#d8c3a5',
  },
  inputWrapper: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a1a1aa',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderRadius: 8,
    paddingHorizontal: 12,
    color: '#f4f4f5',
    backgroundColor: '#27272a',
    fontSize: 14,
  },
  authBtn: {
    height: 48,
    borderRadius: 8,
    backgroundColor: '#d8c3a5',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  authBtnText: {
    color: '#18181b',
    fontWeight: 'bold',
    fontSize: 14,
  },
  orText: {
    textAlign: 'center',
    color: '#71717a',
    fontSize: 12,
    marginVertical: 4,
  },
  offlineBtn: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#27272a',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  offlineBtnText: {
    color: '#a1a1aa',
    fontWeight: 'bold',
    fontSize: 13,
  },
  navigationRow: {
    flexDirection: 'row',
    backgroundColor: '#18181b',
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
    paddingHorizontal: 16,
  },
  navTab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  navTabActive: {
    borderBottomColor: '#d8c3a5',
  },
  navTabText: {
    fontSize: 14,
    color: '#a1a1aa',
    fontWeight: '700',
  },
  navTabTextActive: {
    color: '#f4f4f5',
  },
  viewContainer: {
    flex: 1,
  },
  searchFilterContainer: {
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderColor: '#27272a',
    borderWidth: 1,
    borderRadius: 8,
    height: 40,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#f4f4f5',
    fontSize: 14,
    padding: 0,
  },
  categoryScroll: {
    flexGrow: 0,
  },
  categoryCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#27272a',
    marginRight: 8,
  },
  categoryCapsuleActive: {
    backgroundColor: '#27272a',
    borderColor: '#d8c3a5',
  },
  categoryText: {
    fontSize: 12,
    color: '#a1a1aa',
  },
  categoryTextActive: {
    color: '#d8c3a5',
    fontWeight: 'bold',
  },
  catDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  weekNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  weekNavBtn: {
    padding: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#27272a',
    backgroundColor: '#18181b',
  },
  weekLabelText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#f4f4f5',
  },
  habitCard: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    gap: 12,
  },
  habitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  habitTitleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  habitName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f4f4f5',
    maxWidth: '85%',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  streakWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  streakText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  weeklyGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
    marginTop: 4,
  },
  dayCell: {
    flex: 1,
    aspectRatio: 0.9,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#27272a',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 4,
  },
  dayNumText: {
    fontSize: 9,
    color: '#71717a',
    marginBottom: 2,
    fontWeight: 'bold',
  },
  slotsRatioText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  heatmapHeaderBox: {
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  heatmapOverviewTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f4f4f5',
    marginHorizontal: 16,
  },
  heatmapCard: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    gap: 12,
  },
  heatmapTitleBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heatmapName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f4f4f5',
  },
  heatmapRow: {
    flexDirection: 'row',
    gap: 3,
  },
  heatmapCol: {
    gap: 3,
  },
  heatmapCell: {
    width: 10,
    height: 10,
    borderRadius: 2,
    borderWidth: 0.5,
  },
  footerActions: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#27272a',
    backgroundColor: '#18181b',
    alignItems: 'center',
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#27272a',
    backgroundColor: '#09090b',
  },
  footerBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a1a1aa',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 80,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#d8c3a5',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 9, 11, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalWrapper: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeBtn: {
    padding: 4,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  formInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  categoryBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catBadgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#27272a',
    backgroundColor: '#18181b',
  },
  catBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  slotCounterBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slotsInputSection: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#09090b',
    borderRadius: 8,
  },
  slotNameInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  freqTabRow: {
    flexDirection: 'row',
    backgroundColor: '#18181b',
    borderRadius: 8,
    padding: 3,
  },
  freqTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  freqTabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dayCheckbox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numInput: {
    width: 60,
    height: 36,
    borderWidth: 1,
    borderRadius: 6,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkboxBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    backgroundColor: 'rgba(9, 9, 11, 0.2)',
  },
  footerCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  footerSaveBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsCardGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCardBlock: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  statCardVal: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  infoSectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  detailsActionBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  slotCheckoffRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
  },
  slotRowName: {
    fontSize: 14,
    fontWeight: '600',
  },
  doneBtn: {
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  }
});
