# Stage 1: Build
FROM node:lts-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install --legacy-peer-deps

WORKDIR /app/apps/core

COPY apps/core/package*.json ./

RUN npm install --legacy-peer-deps

COPY . .

RUN npm run build:all

# Stage 2: Final image
FROM node:lts-alpine

WORKDIR /app

RUN addgroup --system core && adduser --system -G core core

COPY --from=builder /app/dist/apps/core core/

RUN chown -R core:core .

RUN npm --prefix core install --omit=dev --legacy-peer-deps

CMD [ "node", "core/main.js" ]
