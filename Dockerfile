FROM node:14

RUN mkdir /bot
WORKDIR /bot
COPY ./ /bot/
RUN npm install
CMD node --trace-warnings index.js

