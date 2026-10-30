# Dashboard container for the home server. Build from the repository root:
#   docker compose -f compose.dashboard.yml up -d --build
# Secrets come from the environment at runtime; none are baked into the image.

FROM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY site/package.json site/
COPY dashboard/package.json dashboard/
RUN npm ci --workspace dashboard --include-workspace-root=false
COPY shared shared
COPY dashboard dashboard
RUN npm run build --workspace dashboard \
 && npm prune --omit=dev --workspace dashboard --include-workspace-root=false

FROM node:26-alpine
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4322 \
    DASHBOARD_DATA_DIR=/data
WORKDIR /app
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/shared shared
COPY --from=build /app/dashboard/package.json dashboard/
COPY --from=build /app/dashboard/dist dashboard/dist
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 4322
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:4322/healthz || exit 1
CMD ["node", "dashboard/dist/server/entry.mjs"]
