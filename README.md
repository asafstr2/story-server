# Story App Server

Backend API for the Magical Story app that generates personalized children's stories using AI.

## Docker Setup

The application can be run in Docker containers for easier development and deployment.

### Prerequisites

- Docker
- Docker Compose

### Development Environment

To run the application in development mode with hot reloading:

```bash
# Start the development containers
docker-compose -f docker-compose.dev.yml up

# Start in detached mode
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop the containers
docker-compose -f docker-compose.dev.yml down
```

### Production Build

To build and run the production version:

```bash
# Build and start the production containers
docker-compose up --build

# Start in detached mode
docker-compose up -d

# Stop the containers
docker-compose down
```

### Health Check

The application includes a health check endpoint at `/health` that returns:
- Database connection status
- System information
- Application status

You can access it at http://localhost:8085/health when the container is running.

## Environment Variables

The Docker setup uses the following environment variables:

- `NODE_ENV`: Application environment (development, production)
- `PORT`: The port the server will run on (default: 8085)
- `MONGODB_URI`: MongoDB connection string
- `CLIENT_URL`: Frontend application URL

## Manual Setup (without Docker)

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Run in production mode
npm start
``` 