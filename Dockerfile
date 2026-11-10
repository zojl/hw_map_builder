FROM node:24

RUN mkdir /bot
WORKDIR /bot
COPY package.json package-lock.json /bot/
RUN npm ci --no-audit --no-fund
COPY ./ /bot/
CMD node --trace-warnings index.js
