FROM node:24

WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm install

COPY backend/gateway/package*.json ./gateway/
RUN cd gateway && npm install

COPY backend/gateway ./gateway
COPY backend/shared ./shared

WORKDIR /app/backend/gateway

EXPOSE 8000

CMD ["npm", "start"]