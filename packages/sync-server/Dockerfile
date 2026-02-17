FROM node:20-slim

WORKDIR /app

# Copy the pre-built token-beam lib (local workspace dependency)
COPY lib-dist/package.json ./lib/package.json
COPY lib-dist/dist/ ./lib/dist/

# Copy sync-server package files
COPY package.json ./
COPY tsconfig.docker.json ./tsconfig.json

# Rewrite token-beam dependency to use the local copy
RUN sed -i 's|"token-beam": "\*"|"token-beam": "file:./lib"|' package.json

# Install all dependencies (including dev for build)
RUN npm install

# Copy source files
COPY src ./src

# Build TypeScript
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# Expose application port
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:8080/health').then(r=>{if(!r.ok)throw r;process.exit(0)}).catch(()=>process.exit(1))"

# Start the server
CMD ["node", "dist/cli.js"]
