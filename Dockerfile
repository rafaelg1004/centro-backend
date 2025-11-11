# Usa una imagen oficial de Node.js
FROM node:18

# Instala LibreOffice y dependencias
RUN apt-get update && \
    apt-get install -y libreoffice && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 8080

CMD [ "node", "index.js" ]