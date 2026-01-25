# Use Node 20 as base
FROM node:20-slim

WORKDIR /app

# Copy package files first for better caching
COPY package.json package-lock.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Build the application (for production)
# If this is for dev only, we could skip this, but usually good to check build in CI
RUN npm run build --if-present

EXPOSE 5173

# Default command for development
CMD ["npm", "run", "dev", "--", "--host"]
