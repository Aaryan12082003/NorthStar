FROM node:22-bookworm-slim

WORKDIR /app

COPY server/package.json server/package-lock.json /app/server/
COPY client/package.json client/package-lock.json /app/client/

RUN cd /app/server && npm ci \
  && cd /app/client && npm ci --legacy-peer-deps

COPY server /app/server
COPY client /app/client

RUN cd /app/client && npm run build

WORKDIR /app/server
ENV NODE_ENV=production
ENV PORT=4732
EXPOSE 4732

CMD ["sh", "-c", "i=0; until npx prisma db migrate --yes; do i=$((i+1)); if [ \"$i\" -ge 15 ]; then exit 1; fi; sleep 2; done; exec npx tsx src/index.ts"]
