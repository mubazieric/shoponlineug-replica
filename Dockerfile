FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# Install server dependencies first for better layer caching.
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev

# Copy the whole app: frontend at the repo root + the Express API in server/.
COPY . .

# Persistent state lives here. Mount a Railway volume at /data so the
# JSON database and uploaded images survive redeploys.
ENV SOU_DATA_DIR=/data
ENV SOU_UPLOAD_DIR=/data/uploads
RUN mkdir -p /data/uploads

EXPOSE 3000

CMD ["node", "server/server.js"]
