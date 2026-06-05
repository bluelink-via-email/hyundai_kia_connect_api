# Hyundai/Kia Vehicle Control Web App

A complete React frontend for controlling Hyundai and Kia vehicles through a web interface.

## Features

- **Vehicle Management**: Add, view, and manage multiple connected vehicles
- **Climate Control**: Start/stop climate control with customizable temperature, duration, and defrost settings
- **Lock/Unlock**: Remotely lock and unlock your vehicles
- **Charging Management**: Start and stop charging for electric vehicles
- **Command History**: Track all commands sent to your vehicles
- **Custom Commands**: Create personalized command aliases
- **Settings**: Customize default climate control preferences
- **Dark Theme**: Modern dark UI built with Tailwind CSS

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development and optimized builds
- **TanStack Query v5** for server state management
- **Zustand** for client state management
- **React Router v6** for client-side routing
- **Tailwind CSS** for styling (dark theme with blue/teal accents)
- **Lucide React** for icons

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

This will start a development server at `http://localhost:5173` with API requests proxied to `http://localhost:8787`.

### Build

```bash
npm run build
```

Builds the app for production to the `dist/` directory.

### Preview

```bash
npm run preview
```

Preview the production build locally.

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Layout.tsx       # App shell with navigation
│   ├── ProtectedRoute.tsx # Route guard for auth
│   ├── VehicleCard.tsx  # Vehicle status card
│   └── CommandButton.tsx # Reusable command button
├── hooks/              # Custom React hooks
│   ├── useAuth.ts      # Authentication queries/mutations
│   ├── useVehicles.ts  # Vehicle operations
│   ├── useSettings.ts  # Settings queries/mutations
│   ├── useHistory.ts   # Command history query
│   └── useCustomCommands.ts # Custom commands operations
├── lib/
│   ├── api.ts          # API client with auth interceptor
│   └── store.ts        # Zustand store for auth state
├── pages/              # Page components
│   ├── SignIn.tsx
│   ├── SignUp.tsx
│   ├── Dashboard.tsx
│   ├── Vehicles.tsx
│   ├── AddVehicle.tsx
│   ├── VehicleDetail.tsx
│   ├── History.tsx
│   ├── Settings.tsx
│   └── CustomCommands.tsx
├── App.tsx             # Route definitions
├── main.tsx            # Entry point
└── index.css           # Global styles
```

## API Integration

The app communicates with a Cloudflare Worker backend at `/api`. All requests include an `Authorization: Bearer {sessionId}` header.

### Key Endpoints

**Authentication:**
- `POST /api/auth/signin`
- `POST /api/auth/signup`
- `POST /api/auth/signout`
- `GET /api/auth/me`

**Vehicles:**
- `GET /api/vehicles`
- `POST /api/vehicles`
- `GET /api/vehicles/:id`
- `PUT /api/vehicles/:id`
- `DELETE /api/vehicles/:id`
- `POST /api/vehicles/:id/default`
- `GET /api/vehicles/:id/status`

**Commands:**
- `POST /api/commands/:vehicleId/lock`
- `POST /api/commands/:vehicleId/unlock`
- `POST /api/commands/:vehicleId/start`
- `POST /api/commands/:vehicleId/stop`
- `POST /api/commands/:vehicleId/charge-start`
- `POST /api/commands/:vehicleId/charge-stop`
- `GET /api/commands/:vehicleId/status`

**Other:**
- `GET /api/history`
- `GET /api/settings`
- `PUT /api/settings`
- `GET /api/custom-commands`
- `POST /api/custom-commands`
- `DELETE /api/custom-commands/:id`

## State Management

### Zustand Store (`lib/store.ts`)

Manages authentication state persisted to localStorage:
- `sessionId`: Current user session ID
- `user`: Current user info (id, email)
- `setSession()`: Update session after login
- `clearSession()`: Clear session on logout

### TanStack Query

Manages all server state:
- Automatic caching and synchronization
- Query invalidation after mutations
- Automatic refetching for status queries
- Stale time: 5 minutes
- Retry logic for failed requests

## Vehicle Constants

**Brands:**
- 1 = Kia
- 2 = Hyundai
- 3 = Genesis

**Regions:**
- 1 = Europe
- 2 = Canada
- 3 = USA
- 4 = Australia
- 5 = New Zealand
- 6 = China
- 7 = India
- 8 = Brazil

## Design System

### Colors

Dark theme with slate and blue accents:
- Background: `slate-900`
- Borders: `slate-700`
- Cards: `slate-800`
- Text: `slate-50` / `slate-300` / `slate-400`
- Primary Action: `blue-600`
- Secondary: `slate-700`
- Success: `green-500`
- Danger: `red-600`
- Warning: `yellow-500`

### Components

All components feature:
- Dark backgrounds with slate color scheme
- Blue accent buttons
- Smooth transitions
- Loading states
- Error handling
- Mobile responsive layout
- Accessibility considerations

## Features Detailed

### Dashboard
- Welcome message for authenticated users
- Default vehicle card with status
- Quick action buttons (Lock/Unlock, Start/Stop Climate)
- Recent command history (last 5 commands)
- Quick info sidebar with vehicle stats

### Vehicles Page
- List all connected vehicles
- Set default vehicle
- Edit vehicle nickname
- Delete vehicles
- Add new vehicles button

### Add Vehicle
- Form with brand and region dropdowns
- Vehicle account credentials input
- Optional PIN field
- Password show/hide toggle
- Form validation

### Vehicle Detail
- Edit vehicle nickname
- Full vehicle status display
- Climate control settings (temp, duration, defrost)
- All vehicle commands (lock, unlock, start climate, stop climate, charge)
- Temperature slider (62-82°F)
- Duration slider (1-30 minutes)

### Command History
- Table of all executed commands
- Timestamp for each command
- Command name and result status
- Visual status indicators (success/failed/pending)

### Settings
- Account information display
- Default climate control settings
- Customize default temperature and duration
- Default defrost preference
- Email commands reference section

### Custom Commands
- Create command aliases
- Select from available commands
- List all custom commands
- Delete custom commands

## Error Handling

The app includes comprehensive error handling:
- API error messages displayed in forms
- Loading states for all async operations
- Graceful fallbacks for missing data
- Authentication redirects for unauthorized access
- 404 page for invalid routes

## Performance Optimizations

- Vite for fast builds and HMR
- Query caching with TanStack Query
- Lazy route loading via code splitting
- Tailwind CSS for optimized styling
- Minimal bundle size with tree shaking

## Browser Support

Modern browsers with ES2020 support:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

The codebase is fully typed with TypeScript and follows React best practices:
- Functional components with hooks
- Custom hooks for logic reuse
- Proper error boundaries
- Loading states on all async operations
- Clean component composition

## License

Proprietary - All rights reserved
