# React + Vite

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