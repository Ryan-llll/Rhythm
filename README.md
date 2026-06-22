# Rhythm — Developer Habit Tracker

Rhythm is a clean, developer-centric habit tracker featuring a premium dark/light theme, GitHub-style contribution heatmaps, streaks, multi-slot completions, local storage fallback, and cross-platform clients for Web, Android, iOS, and macOS.

---

## 📸 Screenshots

*Placeholder for App Screenshots: Desktop Grid, Heatmap Overview List, and Mobile App screens.*

---

## 🛠️ Features

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

---

## 🚀 How to Run Locally

### 1. Prerequisites
Ensure you have **Node.js** (v18+) and **NPM** installed.

### 2. Configure Environment Keys
Create a file named `.env` in the `frontend/` directory:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

### 3. Run Web App
```bash
# Install all workspace dependencies
npm install

# Run the dev server
npm run dev
```

### 4. Run macOS Desktop App
```bash
# Build the web assets
npm run build

# Start Electron wrapper
cd desktop
npm install
npm start
```

### 5. Run Mobile App (Expo)
```bash
# Start the Expo development server
cd mobile
npm install
npm start
```

---

## 📱 How to Build the Standalone Android APK

We have set up an automated **GitHub Actions** workflow that builds a debug-signed APK on every push to the `main` branch:
1. Push your changes to GitHub.
2. GitHub Actions compiles the app using native Gradle toolchains.
3. The built APK is pushed back into the `frontend/public/rhythm.apk` folder and deployed to Vercel.
4. Users can download it directly from your landing page.

To build the APK locally, run:
```bash
cd mobile
npx eas build --platform android --profile preview --local
```
*(Requires JDK 17 and Android SDK configured locally.)*

---

## 🍏 How to Sideload on iPhone via Xcode (Free Apple ID)

You can sideload Rhythm onto an iPhone for free using Xcode (re-signs automatically every 7 days):
1. Navigate to the mobile folder: `cd mobile`
2. Generate native iOS project files: `npx expo prebuild --platform ios`
3. Open the `mobile/ios/mobile.xcworkspace` folder in the **Xcode** app on your Mac.
4. Connect your iPhone to your Mac via USB.
5. In Xcode, go to **Project Settings > Signing & Capabilities**:
   * Select your free Apple ID under **Team**.
   * Change the bundle identifier if needed.
6. Trust your developer profile on your iPhone: **Settings > General > VPN & Device Management**.
7. Click the **Run** (Play) button in Xcode to install the app on your iPhone.

---

## 🌐 How to Deploy to Vercel

The monorepo contains a `vercel.json` file in the root directory that routes all requests directly to the web build output.
To deploy manually:
1. Connect your GitHub repository to Vercel.
2. Configure environment variables (`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`) in the Vercel dashboard.
3. Set the **Build Command** to: `npm run build`
4. Set the **Output Directory** to: `frontend/dist`
5. Vercel will automatically trigger a new deployment on every commit to the `main` branch.
