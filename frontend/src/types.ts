export type Category = 'Faith' | 'Health' | 'Study' | 'Language' | 'Family' | 'Life';

export interface Frequency {
  type: 'daily' | 'weekly' | 'interval';
  daysOfWeek?: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  intervalDays?: number; // for interval frequency (every X days)
}

export interface Habit {
  id: string;
  name: string;
  category: Category;
  color: string; // hex code
  frequency: Frequency;
  timesPerDay: number; // default is 1, e.g. 5 for prayers
  slotNames?: string[]; // names of each slot (e.g. ["Fajr", "Dhuhr", ...])
  reminderTime?: string; // HH:MM
  createdAt: string; // YYYY-MM-DD
}

export interface HabitCompletion {
  count: number; // For single slot habits, how many times completed.
  slots?: boolean[]; // For multi-slot habits, which slots are checked.
}

// Maps habitId -> dateString (YYYY-MM-DD) -> HabitCompletion
export type CompletionLog = Record<string, Record<string, HabitCompletion>>;
