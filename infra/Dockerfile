# Salary AI API — one container serving the API + static web client.
# All workspace packages ship TypeScript source (run via tsx), so there is no
# compile step. Build from the repository root:
#   docker build -f infra/Dockerfile -t salary-ai-api .
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    CYPRESS_INSTALL_BINARY=0
# tsx (root devDependency) runs the server; skip only the heavy cypress binary.
COPY package.json package-lock.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN npm ci --no-audit --no-fund
# Snapshot persistence: mount a volume here and set DATA_DIR=/data (optional)
RUN mkdir -p /data
EXPOSE 3000
CMD ["npm", "run", "start:api"]
