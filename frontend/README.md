# Predix Frontend

A mobile-first React application for Predix, built with Vite, TypeScript, and Privy authentication.

## Features

- ⚡ Vite for fast development and optimized builds
- ⚛️ React 18 with TypeScript
- 🔐 Privy authentication integration
- 📱 Mobile-first responsive design
- 🚀 React Router for client-side routing

## Prerequisites

- Node.js (v16 or higher recommended)
- npm or yarn

## Environment Variables

Create a `.env` file in the frontend directory with the following variables:

```env
VITE_PRIVY_APP_ID=your-privy-app-id-here
```

See `.env.example` for reference.

## Installation

```bash
npm install
```

## Development

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173` (or another port if 5173 is in use).

## Build

Build the application for production:

```bash
npm run build
```

The built files will be in the `dist` directory.

## Preview

Preview the production build locally:

```bash
npm run preview
```

## Deployment

This project is configured to work with Vercel's default settings. Simply connect your repository to Vercel, and it will automatically:

1. Install dependencies with `npm install`
2. Build the project with `npm run build`
3. Serve the built files from the `dist` directory

### Vercel Configuration

No additional configuration is needed. The default Vercel settings will:
- Detect Vite automatically
- Use Node.js 18.x or higher
- Install dependencies and run the build command
- Deploy the output directory (`dist`)

Make sure to set your environment variables in the Vercel dashboard:
- `VITE_PRIVY_APP_ID`: Your Privy application ID

## Project Structure

```
frontend/
├── src/
│   ├── pages/          # Page components
│   │   ├── home.tsx
│   │   ├── login.tsx
│   │   └── portfolio.tsx
│   ├── App.tsx         # Main app component with Privy provider
│   ├── main.tsx        # Entry point
│   ├── styles.css      # Global styles
│   └── vite-env.d.ts   # TypeScript environment definitions
├── index.html          # HTML template
├── package.json
├── tsconfig.json       # TypeScript configuration
├── tsconfig.node.json  # TypeScript config for Node
└── vite.config.ts      # Vite configuration
```

## Technologies

- **Vite**: Build tool and development server
- **React**: UI library
- **TypeScript**: Type-safe JavaScript
- **Privy**: Web3 authentication
- **React Router**: Client-side routing
