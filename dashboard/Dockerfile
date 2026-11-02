# Dashboard container for the home server. Build from the repository root:
#   docker compose -f compose.dashboard.yml up -d --build
# Secrets come from the environment at runtime; none are baked into the image.

FROM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY site/package.json site/
COPY dashboard/package.json dashboard/
# The website workspace is included: the dashboard builds previews of it.
RUN npm ci --workspace dashboard --workspace site --include-workspace-root=false
COPY shared shared
COPY dashboard dashboard
COPY site site
RUN npm run build --workspace dashboard \
 && npm prune --omit=dev --workspace dashboard --workspace site --include-workspace-root=false

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
COPY --from=build /app/site site
# Preview builds work in site/.astro (a tmpfs in compose.dashboard.yml, the container is read-only).
RUN mkdir -p /data site/.astro && chown node:node /data site/.astro
USER node
EXPOSE 4322
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:4322/healthz || exit 1
CMD ["node", "dashboard/dist/server/entry.mjs"]
