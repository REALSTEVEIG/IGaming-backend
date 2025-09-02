FROM node:18-slim

# Install required system dependencies for Prisma
RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build the application first
RUN npm run build

# Generate Prisma client with a dummy DATABASE_URL
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npx prisma generate

EXPOSE 3001

# Generate Prisma client and run migrations at runtime with actual environment variables
CMD ["sh", "-c", "npx prisma generate && npx prisma db push --skip-generate && npm run start:prod"]