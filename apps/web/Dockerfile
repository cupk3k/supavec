# Use the official Bun image as a base for building
FROM oven/bun:1 as builder

# Set the working directory
WORKDIR /app

# Copy root package files and lockfile
COPY package.json bun.lock ./

# Copy source code for all apps and packages
COPY apps apps
COPY packages packages
COPY turbo.json ./

# Install all dependencies for the monorepo
RUN bun install --frozen-lockfile

# Build the entire monorepo (including the Next.js app)
# Mount the .env secret and export variables for the build process
RUN --mount=type=secret,id=dotenv,target=/app/.env \
    export $(grep -v '^#' /app/.env | xargs) && \
    bun run build

# --- Production Stage ---
FROM oven/bun:1-slim as runner

# Set the working directory
WORKDIR /app

ENV NODE_ENV=production
# Prevent Turbo cache generation in the container
ENV NEXT_TELEMETRY_DISABLED 1

# Copy necessary files from the builder stage
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder /app/node_modules ./node_modules

# Set the working directory to the web app
WORKDIR /app/apps/web

# Expose the port the app runs on (internal to Docker)
# Set to 3020 as requested
EXPOSE 3300

# Set the host to 0.0.0.0 to accept connections from outside the container
ENV HOSTNAME "0.0.0.0"

# Command to start the Next.js production server
# Use bunx to execute next, listening on port 3020
CMD ["bunx", "next", "start", "-p", "330"]
