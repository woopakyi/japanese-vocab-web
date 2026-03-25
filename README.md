# Japanese Vocabulary Web

Japanese vocabulary practice app for JPSE learners, built with React, Vite, Firebase Auth, and Firestore.

## Features

- Browse chapters grouped by Japanese I to VI on [src/pages/Home.jsx](src/pages/Home.jsx).
- View chapter vocabulary and run two exercise types on [src/pages/Chapter.jsx](src/pages/Chapter.jsx).
- Complete exercises and review answers on [src/pages/Exercise.jsx](src/pages/Exercise.jsx) and [src/pages/Results.jsx](src/pages/Results.jsx).
- Track past attempts (with details and pagination) on [src/pages/Records.jsx](src/pages/Records.jsx).
- View progress charts and per-chapter best scores on [src/pages/Profile.jsx](src/pages/Profile.jsx).
- Sign in with Google only, with local-record sync to account on [src/components/Auth.jsx](src/components/Auth.jsx).

## Tech Stack

- React 18
- Vite 8
- React Router 6
- Firebase Auth + Firestore
- Chart.js + react-chartjs-2

## Prerequisites

- Node.js 18+ (recommended)
- npm
- A Firebase project with:
    - Authentication (Google provider enabled)
    - Firestore database

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Create a .env file in the project root with your Firebase web config:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

3. Start development server:

```bash
npm run dev
```

4. Build production bundle:

```bash
npm run build
```

5. Preview production build locally:

```bash
npm run preview
```

## App Routes

Defined in [src/App.jsx](src/App.jsx):

- / -> Home
- /chapter/:chapterId -> Chapter vocabulary and exercise entry
- /exercise/:chapterId/:exerciseType -> Exercise session
- /results -> Result summary and answer review
- /records -> Past attempts
- /profile -> Profile and progress chart

Navigation layout is in [src/components/Layout.jsx](src/components/Layout.jsx).

## Data Model (Firestore)

Main collections used by the app:

- chapters
    - Example doc id: ch1
    - Typical fields: name, chapterNumber, group
- chapters/{chapterId}/vocabularies
    - Typical fields: word, kanji, meaning, type, originalOrder
- exerciseRecords
    - Typical fields: userId, chapterId, exerciseType, score, totalQuestions, results, completedAt
- users
    - Typical fields: uid, email, displayName, createdAt

## Guest vs Signed-in Behavior

- Not signed in:
    - Records are saved in localStorage under key exerciseRecords.
- Signed in:
    - Records are saved to Firestore collection exerciseRecords.
- On Google sign-in:
    - Existing local records are uploaded to Firestore and removed from localStorage.

Auth setup lives in [src/config/firebase.js](src/config/firebase.js) and [src/components/Auth.jsx](src/components/Auth.jsx).

## Firestore Read Cost Optimization

The app uses two strategies to minimize daily Firestore read quota consumption on the Spark plan:

### 0. Static Content from CSV (Recommended when CSV rarely changes)

Since chapter/vocabulary content is stable, the app can serve learning content from static JSON files in [public/data](public/data) instead of Firestore.

Generate static files from CSV:

```bash
cd scripts
npm install
npm run generate:static-data
```

This creates:

- [public/data/chapters.json](public/data/chapters.json)
- [public/data/scoreTotals.json](public/data/scoreTotals.json)
- [public/data/vocab](public/data/vocab) (one JSON file per chapter)

Runtime behavior after this setup:

- Home/Chapter/Exercise read chapter content from static files.
- Firestore is used mainly for user data (auth, exercise records, user summaries).

### 1. Client-Side Caching with LocalStorage

A time-based cache layer ([src/utils/cache.js](src/utils/cache.js)) stores Firestore reads in localStorage, reducing repeated document fetches:

- **Chapter metadata & vocabularies**: cached for 24 hours
  - Chapters list: reused across Home, Chapter, Exercise pages
  - Chapter metadata (type counts): used by Profile without per-chapter vocab scans
- **User best-score summaries**: cached for 1 minute
  - Allows stale score display with rapid cache invalidation after new results
- **User exercise records**: cached for 5 minutes (Records page)

Cache is automatically invalidated when:
- A new exercise result is saved
- A user signs in (syncing local records to Firestore)
- User navigates to specific cache-aware pages

### 2. Per-User Best-Score Summary Document

Instead of reading all exerciseRecords to compute best scores, the app maintains a lightweight summary in each user doc:

- **Location**: `users/{uid}.bestScoresByChapterType`
- **Format**: map of `"chapterId-exerciseType"` to `{ score, totalQuestions, ... }`
- **Updated**: automatically when a new result is saved or local records are synced during sign-in

This single-doc read replaces full exerciseRecords collection scans:
- **Profile page**: reads 1 doc (user summary) + 1 doc (chapters meta) instead of ~38 vocab subcollections + exerciseRecords collection
- **Chapter page**: reads 1 doc (user summary) instead of filtered exerciseRecords query

### 3. Chapter Vocabulary Counts in Metadata

When uploading chapters via [scripts/upload.js](scripts/upload.js), the script now stores `type1Count` and `type2Count` on each chapter doc. This avoids Profile needing to scan vocabulary subcollections for full-mark totals.

If your vocabulary CSVs are stable and you want to pre-calculate max marks once, run:

```bash
cd scripts
npm install
npm run upload:score-metadata
```

This uploads pre-calculated values from CSV to Firestore:

- Per chapter (`chapters/{chapterId}`):
    - `type1Count`
    - `type2Count`
    - `exercise1Max`
    - `exercise2Max`
    - `chapterMaxScore`
- Global totals (`appMeta/scoreTotals`):
    - `totalExercise1Max`
    - `totalExercise2Max`
    - `totalChapterMaxScore`
    - `groupTotals`
    - `chapterTotals`
    - `groupTotals[*].shareOfTotalPct`
    - `chapterTotals[*].shareOfTotalPct`

### Migration for Existing Users

To backfill summary docs for users with existing exercise records:

```bash
cd scripts
npm install
node backfillUserSummaries.js
```

This one-time script creates `bestScoresByChapterType` summaries from all historical exerciseRecords without changing user data.

### Expected Read Reduction

With these optimizations:
- **Home page**: ~1 read (cached chapters, rarely invalidated)
- **Chapter page**: ~2 reads instead of ~38+ (meta cache + user summary cache)
- **Exercise page**: ~2 reads (vocab cached, no record reads during exercise)
- **Profile page**: ~2 reads instead of ~100+ (meta + summary, no per-chapter vocab scans)
- **Results page**: 1 write to exerciseRecords + 1 write to user summary (no extra reads)

Total estimated daily savings: ~50–70% reduction in read count vs. full-record queries.

Note: On the website, record-based score updates may take up to 1 minute to appear because of summary cache refresh.

## Optional: Upload Chapter CSV Data

The scripts folder includes a Node script that uploads chapter and vocabulary data from CSV files.

- Script: [scripts/upload.js](scripts/upload.js)
- CSV source folder: [scripts/data](scripts/data)
- Script dependencies: [scripts/package.json](scripts/package.json)

Steps:

1. Put a Firebase Admin SDK service account key JSON at [scripts/serviceAccountKey.json](scripts/serviceAccountKey.json).
2. Install script dependencies:

```bash
cd scripts
npm install
```

3. Run uploader:

```bash
node upload.js
```

Important:

- The uploader loops through chapters 1 to 38.
- For each chapter, existing vocabulary docs are cleared and replaced.
- Do not commit serviceAccountKey.json to source control.

## Project Structure
```
japanese-vocab-web/
├── public/
└── src/
    ├── assets/
    │   └── (images, etc.)
    ├── components/
    │   ├── Auth.jsx          # Login/Signup form
    │   ├── Layout.jsx        # Main layout with Navbar
    │   ├── HexagonChart.jsx  # The profile chart
    │   └── RequireAuth.jsx   # Protects routes like Profile
    ├── config/
    │   └── firebase.js       # Your Firebase configuration
    ├── hooks/
    │   └── useAuth.js        # Custom hook for auth state
    ├── pages/
    │   ├── Home.jsx
    │   ├── Chapter.jsx
    │   ├── Exercise.jsx
    │   ├── Results.jsx
    │   └── Profile.jsx
    ├── App.jsx               # Main router setup
    └── main.jsx              # Entry point
```
## Notes

- If Firebase env vars are missing, the app throws an error from [src/config/firebase.js](src/config/firebase.js).
- If Firestore rules block reads, pages show permission-related error messages.