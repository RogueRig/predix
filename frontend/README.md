# Predix Frontend

Portfolio management platform with Privy authentication.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
```

Edit `.env` and set your Privy App ID:
```
VITE_PRIVY_APP_ID=your_privy_app_id_here
```

To get a Privy App ID:
- Sign up at https://dashboard.privy.io
- Create a new app
- Copy the App ID from your dashboard

## Development

Start the development server:
```bash
npm run dev
```

The app will be available at http://localhost:5173

## Build

Build for production:
```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

## Features

- **Privy Authentication**: Secure login with email and wallet support
- **Protected Routes**: Portfolio page requires authentication
- **User State Management**: User info stored in React state (no backend auth yet)
- **Responsive Design**: Works on desktop and mobile

## Project Structure

```
src/
├── App.tsx                 # Main app with routing
├── main.tsx               # Entry point with PrivyProvider
├── pages/
│   ├── home.tsx          # Public home page
│   ├── login.tsx         # Login page with Privy trigger
│   └── portfolio.tsx     # Protected portfolio page
└── styles.css            # Global styles
```

## Authentication Flow

1. User visits login page
2. Clicks "Login with Privy" button
3. Privy modal appears for authentication
4. User authenticates via email or wallet
5. User is redirected to portfolio page
6. User info is displayed from React state (via usePrivy hook)

## Environment Variables

- `VITE_PRIVY_APP_ID` - Your Privy application ID (required)

## Notes

- Privy runs ONLY in the frontend
- User authentication state is managed by Privy's React hooks
- No backend token verification is implemented
- User info is stored in React state only
