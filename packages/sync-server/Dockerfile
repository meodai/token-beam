FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy built files
COPY dist ./dist

# Expose port (Fly.io will inject PORT env var)
EXPOSE 8080

# Start the server
CMD ["node", "dist/cli.js"]
