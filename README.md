# NearbyConnect Platform

A social platform for connecting with people nearby, built with React Native (Expo) and Hono backend with Clerk authentication.

## Features

- 🔐 **Clerk Authentication**: Secure user authentication and authorization
- 👤 **User Profiles**: Complete user profile management with location tracking
- 📱 **React Native Frontend**: Modern mobile app with Expo
- ⚡ **Hono Backend**: Fast backend with Cloudflare Workers
- 🗄️ **Database Integration**: SQLite database with Drizzle ORM
- 🛡️ **Protected Routes**: Authentication-protected screens and API endpoints

## Project Structure

```
├── backend/                 # Hono backend with Cloudflare Workers
│   ├── src/
│   │   ├── lib/
│   │   │   ├── auth.ts      # Clerk authentication middleware
│   │   │   ├── user-service.ts # User profile management
│   │   │   └── database.ts  # Database connection
│   │   ├── db/
│   │   │   └── schema.ts    # Database schema with Clerk integration
│   │   └── index.ts         # Main application entry point
├── client/                  # React Native Expo app
│   ├── app/
│   │   ├── _layout.tsx      # Root layout with ClerkProvider
│   │   ├── sign-in.tsx      # Sign in screen
│   │   ├── sign-up.tsx      # Sign up screen
│   │   └── (tabs)/          # Protected tab screens
│   ├── components/
│   │   ├── UserProfile.tsx  # User profile component
│   │   ├── ProtectedRoute.tsx # Route protection wrapper
│   │   └── ErrorBoundary.tsx # Error handling
│   ├── hooks/
│   │   ├── useAuth.ts       # Authentication hook
│   │   ├── useApi.ts        # API service hook
│   │   └── useUserService.ts # User service hook
│   └── utils/
│       └── token-cache.ts   # Secure token storage
```

## Setup Instructions

### Backend Setup

1. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Environment Configuration:**
   - Copy `.env.example` to `.env`
   - Add your Clerk Secret Key:
     ```
     CLERK_SECRET_KEY=your_clerk_secret_key_here
     ```

3. **Database Setup:**
   ```bash
   npm run db:generate
   npm run db:migrate
   ```

4. **Development:**
   ```bash
   npm run dev
   ```

### Frontend Setup

1. **Install dependencies:**
   ```bash
   cd client
   npm install
   ```

2. **Environment Configuration:**
   - Copy `.env.example` to `.env`
   - Add your Clerk Publishable Key:
     ```
     EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key_here
     EXPO_PUBLIC_API_URL=http://localhost:8787
     ```

3. **Install Clerk SDK:**
   ```bash
   npx expo install @clerk/clerk-expo expo-secure-store
   ```

4. **Development:**
   ```bash
   npm start
   ```

## Clerk Configuration

### 1. Create Clerk Application

1. Go to [clerk.com](https://clerk.com) and create a new application
2. Copy the API keys to your environment files

### 2. Configure Authentication

- **Backend**: Uses Clerk's JWT verification for API protection
- **Frontend**: Uses ClerkProvider for session management
- **Database**: Users table uses Clerk ID as primary key

### 3. Environment Variables

**Backend (.env):**
```
CLERK_SECRET_KEY=sk_test_...
```

**Frontend (.env):**
```
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_API_URL=http://localhost:8787
```

## API Endpoints

### Protected Routes (require authentication)

- `GET /api/profile` - Get current user profile
- `PUT /api/profile` - Update user profile
- `PUT /api/location` - Update user location
- `PUT /api/status` - Update online status

### Public Routes

- `GET /health` - Health check
- `GET /ready` - Readiness check

## Authentication Flow

1. **Sign In/Up**: Users authenticate via Clerk's hosted UI
2. **Token Verification**: Backend verifies JWT tokens from Clerk
3. **Profile Creation**: User profile is created/updated with Clerk data
4. **Protected Access**: Authenticated users can access protected routes

## Database Schema

The users table includes:
- `id` (Primary Key) - Clerk user ID
- `clerkId` - Clerk user ID (unique)
- `email` - User email address
- `username` - Optional username
- `displayName` - User's display name
- `avatar` - Profile picture URL
- `bio` - User biography
- `latitude/longitude` - Location coordinates
- `isOnline` - Online status
- `lastSeenAt` - Last seen timestamp
- `createdAt/updatedAt` - Timestamps

## Development

### Running Both Services

1. **Backend:**
   ```bash
   cd backend && npm run dev
   ```

2. **Frontend:**
   ```bash
   cd client && npm start
   ```

### Testing Authentication

1. Start both services
2. Open the app and sign in/up
3. Check that user profile is created in database
4. Verify protected routes require authentication

## Deployment

### Backend (Cloudflare Workers)

```bash
cd backend
npm run deploy
```

### Frontend (Expo)

Follow Expo's deployment guide for your target platform.

## Security Features

- JWT token verification on all protected routes
- Secure token storage using expo-secure-store
- Error boundaries for graceful error handling
- Input validation and sanitization
- Protected API endpoints with authentication middleware

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.