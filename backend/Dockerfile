# Image for the Sentinel worker. The worker runs Puppeteer, which needs a
# real Chromium plus its system libraries — not present in plain Node images.
# We install Debian's Chromium and point Puppeteer at it (skipping Puppeteer's
# own bundled-Chromium download to keep the image small).
FROM node:22-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

CMD ["node", "worker.js"]
