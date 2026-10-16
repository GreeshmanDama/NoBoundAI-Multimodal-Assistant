FROM node:24

WORKDIR /app/backend

# Install backend root dependencies
COPY backend/package*.json ./
RUN npm install

# Copy chat service package files
COPY backend/services/chat/package*.json ./services/chat/

# Install chat service dependencies
WORKDIR /app/backend/services/chat
RUN npm install

# Copy chat service source code
COPY backend/services/chat ./ 

# Copy shared modules
COPY backend/shared /app/backend/shared

# Run chat service
EXPOSE 8001

CMD ["npm", "start"]