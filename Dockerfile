FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8787 DATABASE_FILE=/data/asf.db DATA_FILE=/data/db.json UPLOADS_DIR=/data/uploads
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
# Run as an unprivileged user that owns only the app and its data directory.
RUN addgroup -S asf && adduser -S -D -H -h /app -G asf asf \
  && mkdir -p /data \
  && chown -R asf:asf /app /data
USER asf
VOLUME /data
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" > /dev/null || exit 1
# node:sqlite is stable in practice but still flagged experimental in Node 22; keep the logs quiet.
CMD ["node", "--disable-warning=ExperimentalWarning", "dist-server/index.js"]
