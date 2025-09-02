FROM node:18-slim

# Install required system dependencies for Prisma
RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN npx prisma generate

EXPOSE 3001

# Add a shell script that runs migrations and starts the app
CMD ["sh", "-c", "npx prisma db push --skip-generate && npm run start:prod"]