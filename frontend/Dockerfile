FROM node:20

WORKDIR /app

# Skopíruj package.json a inštaluj závislosti
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install

# Prebuildni esbuild pre aktuálnu platformu
RUN npm rebuild esbuild

# Skopíruj zvyšok aplikácie
COPY frontend/ .

# Spusti dev server
CMD ["npm", "run", "dev"]
