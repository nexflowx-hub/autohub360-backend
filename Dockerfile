FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S autohub && adduser -S autohub -G autohub
COPY --from=build --chown=autohub:autohub /app/package.json ./package.json
COPY --from=build --chown=autohub:autohub /app/node_modules ./node_modules
COPY --from=build --chown=autohub:autohub /app/dist ./dist
USER autohub
EXPOSE 8090
CMD ["node", "dist/server.js"]
