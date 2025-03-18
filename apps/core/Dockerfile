# Stage 1: Build
FROM docker.io/node:lts-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build:all

# Stage 2: Final image
FROM docker.io/node:lts-alpine

WORKDIR /app

RUN addgroup --system core && adduser --system -G core core

COPY --from=builder /app/dist/apps/core core/

RUN chown -R core:core .

RUN npm --prefix core --omit=dev -f install

CMD [ "node", "core/main.js" ]
