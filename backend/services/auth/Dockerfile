FROM node:24

WORKDIR /app/backend

# Install backend root dependencies
COPY backend/package*.json ./
RUN npm install

# Copy Auth service package files
COPY backend/services/auth/package*.json ./services/auth/

# Install Auth service dependencies
WORKDIR /app/backend/services/auth
RUN npm install

# Copy Auth service source code
COPY backend/services/auth ./ 

# Copy shared modules
COPY backend/shared /app/backend/shared

# Run Auth service
EXPOSE 8001

CMD ["npm", "start"]