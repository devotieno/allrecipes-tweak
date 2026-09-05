FROM mcr.microsoft.com/playwright:v1.62.1-jammy

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# playwright-core (not the full "playwright" package) is a dependency here,
# so we install browsers via its own CLI -- this guarantees the browser
# build matches the exact version pinned in package.json.
RUN npx playwright-core install --with-deps chromium

RUN npm run build

EXPOSE 8080
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

CMD ["node", ".next/standalone/server.js"]
