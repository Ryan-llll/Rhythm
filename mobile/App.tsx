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
  Share,
  Platform,
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
  Download,
  Upload,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Check,
  Minus,
  Mail,
  Lock,
  Moon,
  Sun,
  X,
  Clock,
  Compass
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
  const [viewMode, setViewMode] = useState<'weekly' | 'heatmaps'>('heatmaps');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [weekOffset, setWeekOffset] = useState(0);

  // Modals / Details
  const [activeDetailsHabit, setActiveDetailsHabit] = useState<Habit | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);

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

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    logoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    logoText: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.textPrimary,
    },
    themeBtn: {
      padding: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    authContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
      backgroundColor: colors.bg,
    },
    authCard: {
      width: '100%',
      maxWidth: 400,
      padding: 24,
      borderRadius: 12,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 16,
    },
    authTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    authTabRow: {
      flexDirection: 'row',
      backgroundColor: colors.inputBg,
      borderRadius: 8,
      padding: 3,
      marginBottom: 8,
    },
    authTab: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 6,
    },
    authTabActive: {
      backgroundColor: colors.border,
    },
    authTabText: {
      color: colors.textSecondary,
      fontWeight: '600',
      fontSize: 14,
    },
    authTabTextActive: {
      color: colors.accent,
    },
    inputWrapper: {
      gap: 6,
    },
    inputLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    input: {
      height: 48,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 8,
      paddingHorizontal: 12,
      color: colors.textPrimary,
      backgroundColor: colors.inputBg,
    },
    authBtn: {
      height: 48,
      borderRadius: 8,
      backgroundColor: colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 8,
    },
    authBtnText: {
      color: '#18181b',
      fontWeight: 'bold',
      fontSize: 15,
    },
    orText: {
      textAlign: 'center',
      color: colors.textMuted,
      fontSize: 12,
      marginVertical: 4,
    },
    offlineBtn: {
      height: 48,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'transparent',
    },
    offlineBtnText: {
      color: colors.textSecondary,
      fontWeight: 'bold',
      fontSize: 14,
    },
    // Main App Styles
    navigationRow: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingHorizontal: 16,
    },
    navTab: {
      flex: 1,
      paddingVertical: 14,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    navTabActive: {
      borderBottomColor: colors.accent,
    },
    navTabText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    navTabTextActive: {
      color: colors.textPrimary,
    },
    viewContainer: {
      flex: 1,
    },
    habitCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
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
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    habitName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
      flex: 1,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: 'bold',
      color: '#18181b',
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
      marginTop: 6,
    },
    dayCell: {
      flex: 1,
      aspectRatio: 1,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'transparent',
    },
    dayNumText: {
      fontSize: 10,
      color: colors.textMuted,
      marginBottom: 2,
    },
    slotsRatioText: {
      fontSize: 9,
      fontWeight: 'bold',
    },
    // Heatmap Styles
    heatmapOverviewTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.textPrimary,
      marginHorizontal: 16,
      marginTop: 16,
    },
    heatmapCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 16,
      marginHorizontal: 16,
      marginTop: 12,
    },
    heatmapTitleBlock: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    heatmapName: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
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
      borderTopColor: colors.border,
      backgroundColor: colors.card,
    },
    footerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    footerBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    fab: {
      position: 'absolute',
      right: 20,
      bottom: 80,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    },
  });

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
      setCompletions([]);
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

  // Generate 6-Month Heatmap cells
  const generateHeatmapWeeks = (habit: Habit) => {
    const weeksCount = 26; // Approx 6 months
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
            <Text style={colors.textSecondary}>DEVELOPER HABIT TRACKER</Text>
            
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

      {/* Dashboard Lists */}
      <ScrollView style={styles.viewContainer}>
        {viewMode === 'weekly' ? (
          // Weekly Checkoff View
          habits.map((habit) => {
            const streak = getHabitStreak(habit);
            return (
              <View key={habit.id} style={styles.habitCard}>
                <View style={styles.habitHeader}>
                  <View style={styles.habitTitleWrapper}>
                    <View style={[styles.colorDot, { backgroundColor: CATEGORY_COLORS[habit.category] }]} />
                    <Text style={styles.habitName} numberOfLines={1}>{habit.name}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <View style={[styles.badge, { backgroundColor: `${CATEGORY_COLORS[habit.category]}33` }]}>
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
                        onPress={() => handleToggleCompletion(habit.id, dateStr)}
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
          // Heatmap list (mocks contribution graph vertically)
          <View>
            <Text style={styles.heatmapOverviewTitle}>Contribution Heatmaps (6-Months)</Text>
            {habits.map((habit) => {
              const weeks = generateHeatmapWeeks(habit);
              return (
                <View key={habit.id} style={styles.heatmapCard}>
                  <View style={styles.heatmapTitleBlock}>
                    <Text style={styles.heatmapName}>{habit.name}</Text>
                    <View style={[styles.badge, { backgroundColor: `${CATEGORY_COLORS[habit.category]}33` }]}>
                      <Text style={[styles.badgeText, { color: CATEGORY_COLORS[habit.category] }]}>{habit.category}</Text>
                    </View>
                  </View>

                  {/* Horizontal Scrollable Heatmap Weeks */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.heatmapRow}>
                      {weeks.map((week, wIdx) => (
                        <View key={wIdx} style={styles.heatmapCol}>
                          {week.map((day) => {
                            // Calculate colors matching the CSS color-mix logic
                            const opacities = [0, 0.25, 0.5, 0.75, 1];
                            const baseCol = CATEGORY_COLORS[habit.category];
                            let cellBg = colors.border;
                            
                            if (day.intensity > 0) {
                              // Mix color with background
                              cellBg = baseCol; // React Native doesn't support css color-mix, we can use hex opacity instead
                            }

                            return (
                              <View
                                key={day.dateStr}
                                style={[
                                  styles.heatmapCell,
                                  {
                                    backgroundColor: day.isFuture ? 'transparent' : cellBg,
                                    borderColor: day.isFuture ? colors.border : 'transparent',
                                    opacity: day.isFuture ? 0.3 : opacities[day.intensity] || 1,
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
            })}
          </View>
        )}
      </ScrollView>

      {/* Footer / Info & Sign Out */}
      <View style={styles.footerActions}>
        <View style={{ flexDirection: 'column' }}>
          <Text style={{ fontSize: 10, color: colors.textMuted }}>PERSISTENCE</Text>
          <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.textPrimary }}>
            {session ? session.user.email : 'Local Storage'}
          </Text>
        </View>
        <TouchableOpacity style={styles.footerBtn} onPress={handleSignOut}>
          <LogOut size={12} color={colors.textSecondary} />
          <Text style={styles.footerBtnText}>{session ? 'Sign Out' : 'Sign In'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
