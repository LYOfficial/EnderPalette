FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4999

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=node:node server.js ./
COPY --chown=node:node public ./public

USER node

EXPOSE 4999

CMD ["npm", "start"]
