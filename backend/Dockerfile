FROM node:20-alpine

WORKDIR /app

# Dépendances système pour better-sqlite3
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install --production

COPY . .

# Créer le dossier de données persistant
RUN mkdir -p /app/data

EXPOSE 3001

CMD ["node", "server.js"]
