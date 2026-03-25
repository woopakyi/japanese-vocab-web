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