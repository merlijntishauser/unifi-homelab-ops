FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm install

COPY . .

CMD ["node_modules/.bin/vite", "--host", "0.0.0.0"]
