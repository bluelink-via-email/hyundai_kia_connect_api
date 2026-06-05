# Quick Reference Guide

## Project Setup

```bash
cd apps/web
npm install
npm run dev
```

App runs at `http://localhost:5173` with API proxied to `http://localhost:8787`.

## Key Files by Function

### Authentication
- `src/hooks/useAuth.ts` - SignIn/SignUp/SignOut/Me queries
- `src/pages/SignIn.tsx` - Sign in UI
- `src/pages/SignUp.tsx` - Sign up UI
- `src/components/ProtectedRoute.tsx` - Route guard

### Vehicle Management
- `src/hooks/useVehicles.ts` - Vehicle CRUD and commands
- `src/pages/Vehicles.tsx` - Vehicle list
- `src/pages/AddVehicle.tsx` - Add vehicle form
- `src/pages/VehicleDetail.tsx` - Vehicle detail and commands
- `src/components/VehicleCard.tsx` - Vehicle status card

### State Management
- `src/lib/store.ts` - Zustand auth store (persisted)
- `src/lib/api.ts` - API client with Bearer token auth

### Pages/Features
- `src/pages/Dashboard.tsx` - Home dashboard
- `src/pages/History.tsx` - Command history table
- `src/pages/Settings.tsx` - User settings and defaults
- `src/pages/CustomCommands.tsx` - Custom command aliases

## Common Tasks

### Add a New Hook

1. Create file in `src/hooks/`
2. Use `useQuery()` or `useMutation()` from TanStack Query
3. Use `apiClient` from `src/lib/api.ts`
4. Invalidate related queries on mutation success

```typescript
export function useMyQuery() {
  return useQuery({
    queryKey: ['my-data'],
    queryFn: () => apiClient.get('/endpoint')
  })
}
```

### Add a New Page

1. Create file in `src/pages/`
2. Wrap in `<Layout>` component if authenticated
3. Add route in `src/App.tsx`
4. Use hooks for data fetching

```typescript
export function MyPage() {
  const { data } = useMyQuery()
  
  return (
    <Layout>
      {/* Page content */}
    </Layout>
  )
}
```

### Add a New Component

1. Create file in `src/components/`
2. Use Tailwind classes for styling
3. Import lucide-react icons
4. Export and use in pages

## API Integration

All API calls use `apiClient`:

```typescript
// GET request
const data = await apiClient.get('/vehicles')

// POST request with body
const result = await apiClient.post('/vehicles', { brand: 1, ... })

// PUT request
const updated = await apiClient.put('/vehicles/123', { nickname: 'new' })

// DELETE request
await apiClient.delete('/vehicles/123')
```

Auth header is automatically included via Bearer token from Zustand store.

## Color Scheme

Use these Tailwind classes for consistency:

- **Primary Action**: `bg-blue-600 hover:bg-blue-700`
- **Secondary**: `bg-slate-700 hover:bg-slate-600`
- **Danger**: `bg-red-600 hover:bg-red-700`
- **Success**: `text-green-500`
- **Warning**: `text-yellow-500`
- **Error**: `text-red-500`

## Forms

All forms include:
- Input validation
- Error messages
- Loading state on submit
- Success/error feedback

## Vehicle Constants

```typescript
// Brands
const BRANDS = {
  1: 'Kia',
  2: 'Hyundai',
  3: 'Genesis'
}

// Regions
const REGIONS = {
  1: 'Europe',
  2: 'Canada',
  3: 'USA',
  4: 'Australia',
  5: 'New Zealand',
  6: 'China',
  7: 'India',
  8: 'Brazil'
}
```

## Testing the App

1. **Auth Flow**: Sign up → Dashboard → Settings → Sign out → Sign in
2. **Vehicles**: Add vehicle → View list → Edit → Set default → Delete
3. **Commands**: Lock/Unlock → Climate (with settings) → Charge → Check history
4. **Settings**: Change defaults → Verify in climate control dialog

## Build & Deploy

```bash
# Development
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

## Troubleshooting

**API calls failing:**
- Check that Cloudflare Worker is running on port 8787
- Verify `vite.config.ts` proxy settings
- Check Bearer token in Zustand store

**Styles not applying:**
- Ensure Tailwind content paths in `tailwind.config.js`
- Run `npm run build` to rebuild CSS
- Check class names against Tailwind docs

**Query not updating after mutation:**
- Verify `queryClient.invalidateQueries()` is called
- Check that queryKey matches exactly
- Ensure mutation `onSuccess` callback is firing

## Type Definitions

Key interfaces used throughout:

```typescript
interface User {
  id: string
  email: string
}

interface Vehicle {
  id: string
  brand: number
  region: number
  nickname: string
  is_default: boolean
  username: string
}

interface VehicleStatus {
  locked: boolean
  engine_running: boolean
  battery_percent: number
  charging: boolean
  climate_temp: number | null
  climate_running: boolean
  odometer: number
}
```

## Performance Notes

- Vehicle status auto-refreshes every 60 seconds
- Command history auto-refreshes every 30 seconds
- Queries cached for 5 minutes
- Sidebar navigation collapses on mobile
- All mutations show loading states
