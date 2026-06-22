# Rhythm — Developer Habit Tracker

Rhythm is a clean, developer-centric habit tracker featuring a premium dark/light theme, GitHub-style contribution heatmaps, streaks, multi-slot completions, local storage fallback, and cross-platform clients for Web, Android, iOS, and macOS.

---

## 💡 Concept & Features

1. **GitHub-Style Heatmaps**: Stacked 6-month contribution grids showing your habit consistency at a glance, loaded globally on the web dashboard Heatmaps tab.
2. **Weekly Grid Checkoffs**: Quick checkbox ticks on the weekly dashboard grid.
3. **Multi-Slot Tracking**: Track multi-stage habits (like prayer times, daily exercises, or meals) with sub-slots.
4. **Multi-Completions**: Backfill or increment habit check-ins (`x2`, `x3`) for customizable tracking.
5. **Dynamic Themes**: Beautiful, modern **Dutch Gold & Dark Coal** (default) or **Silver & Pure White** (light) designs.
6. **Cross-Platform Sync**: Cloud sync using **Supabase** database and authentication, with automatic offline backup caching in **LocalStorage/AsyncStorage**.
7. **Re-architected Mobile Dashboard (Expo)**: Re-designed for separate, clean "windows" (views):
   * **Weekly Grid Screen**: Contains only the week check-off cells, search, and a Floating Action Button (FAB) for new habits.
   * **Heatmaps Screen**: Renders a distraction-free, dedicated horizontal scrolling graph for each habit.
   * **Custom Modals**: Includes clean screens for slot check-ins, detail stats, and creation forms.

---

## 💻 Tech Stack

* **Web Frontend**: React, Vite, TypeScript, Vanilla CSS
* **Mobile (Android/iOS)**: React Native, Expo, Expo Secure Store, AsyncStorage
* **Desktop (macOS)**: Electron
* **Database & Auth**: Supabase (Postgres, Row Level Security)
* **Hosting & CI/CD**: Vercel, GitHub Actions (Automated APK compiling)
