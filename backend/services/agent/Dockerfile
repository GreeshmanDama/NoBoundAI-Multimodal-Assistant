FROM node:24

WORKDIR /app/backend

# Install backend root dependencies
COPY backend/package*.json ./
RUN npm install

# Copy agent service package files
COPY backend/services/agent/package*.json ./services/agent/

# Install agent service dependencies
WORKDIR /app/backend/services/agent
RUN npm install

# Copy agent service source code
COPY backend/services/agent ./ 

# Copy shared modules
COPY backend/shared /app/backend/shared

# Run agent service
EXPOSE 8001

CMD ["npm", "start"]