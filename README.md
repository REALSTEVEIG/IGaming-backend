# iGaming Backend

A NestJS-based backend API for the iGaming platform providing user authentication, game session management, and leaderboard functionality.

## Technology Stack

- **Framework**: NestJS
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT tokens
- **Real-time**: Socket.IO for WebSocket connections
- **Language**: TypeScript

## Project Structure

```
src/
├── auth/                 # Authentication module
│   ├── dto/             # Data transfer objects
│   ├── guards/          # JWT auth guards
│   └── strategies/      # JWT strategy
├── game/                # Game session management
│   ├── dto/             # Game-related DTOs
│   └── game.gateway.ts  # WebSocket gateway
├── leaderboard/         # Leaderboard functionality
├── prisma/              # Database configuration
└── main.ts              # Application entry point
```

## Prerequisites

- Node.js (version 18 or higher)
- PostgreSQL database
- npm or yarn package manager

## Environment Variables

Create a `.env` file in the root directory:

```
DATABASE_URL="postgresql://username:password@localhost:5432/igaming"
JWT_SECRET="your-jwt-secret-key"
JWT_EXPIRES_IN="24h"
PORT=3001
```

## Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev
```

## Running the Application

```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod

# Debug mode
npm run start:debug
```

## API Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/register` - User registration

### Leaderboard
- `GET /leaderboard/top-players` - Get top players
- `GET /leaderboard/sessions` - Get recent game sessions
- `GET /leaderboard/winners?period=day|week|month` - Get winners by period

### Game Management
- WebSocket connection on `/socket.io` for real-time game events

## Database Schema

Key models:
- **User**: Player information and credentials
- **GameSession**: Game session data with participants
- **SessionParticipant**: Player participation in sessions

## Development Commands

```bash
# Run tests
npm run test

# Run e2e tests
npm run test:e2e

# Database operations
npx prisma studio          # Open database browser
npx prisma migrate reset    # Reset database
npx prisma db seed         # Seed database (if configured)

# Code formatting
npm run format
npm run lint
```

## Docker Support

```bash
# Build image
docker build -t igaming-backend .

# Run container
docker run -p 3001:3001 igaming-backend
```

## Production Considerations

- Set strong JWT_SECRET in production
- Use connection pooling for database
- Enable CORS for frontend domain
- Configure proper logging
- Set up health checks
- Use environment-specific configuration

## Troubleshooting

### Common Issues

1. **Database Connection**: Verify PostgreSQL is running and DATABASE_URL is correct
2. **JWT Issues**: Ensure JWT_SECRET is set and consistent
3. **WebSocket Problems**: Check firewall settings for Socket.IO connections
4. **Migration Errors**: Run `npx prisma migrate reset` to reset database

### Logs

Application logs are output to console. In production, configure proper log aggregation.

## Contributing

1. Follow TypeScript best practices
2. Use Prisma for database operations
3. Implement proper error handling
4. Add unit tests for new features
5. Follow NestJS module structure