# Use the official Bun image as a base
FROM oven/bun:1 as base

# Set the working directory in the container
WORKDIR /app

# Copy root package files and lockfile
COPY package.json bun.lock ./

# Copy source code for all apps and packages
# Needed because the build script runs from the root
COPY apps apps
COPY packages packages
COPY turbo.json ./

# Install all dependencies for the monorepo
RUN bun install --frozen-lockfile

# Run the build script from the root (builds all packages)
# Mount the .env secret and export variables for the build process
RUN --mount=type=secret,id=dotenv,target=/app/.env \
    export $(grep -v '^#' /app/.env | xargs) && \
    bun run build

# Use a smaller image for the final stage
FROM oven/bun:1-slim as release

# Set the working directory
WORKDIR /app

# Copy installed dependencies and built artifacts from the base stage
COPY --from=base /app/node_modules node_modules
COPY --from=base /app/packages/api/dist ./packages/api/dist
COPY --from=base /app/packages/api/package.json ./packages/api/package.json
COPY --from=base /app/packages/common/dist ./packages/common/dist
COPY --from=base /app/packages/common/package.json ./packages/common/package.json

# Set environment variables for production
ENV NODE_ENV=production
ENV PORT=3021

# Set the working directory to the API package for running the command
WORKDIR /app/packages/api

# Expose the port the API will run on (internal to Docker)
EXPOSE 3021

# Command to start the API server using the package.json script
CMD ["bun", "run", "start"]
