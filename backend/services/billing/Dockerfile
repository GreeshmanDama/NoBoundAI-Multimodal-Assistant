FROM node:24

WORKDIR /app/backend

# Install backend root dependencies
COPY backend/package*.json ./
RUN npm install

# Copy billing service package files
COPY backend/services/billing/package*.json ./services/billing/

# Install billing service dependencies
WORKDIR /app/backend/services/billing
RUN npm install

# Copy billing service source code
COPY backend/services/billing ./ 

# Copy shared modules
COPY backend/shared /app/backend/shared

# Run billing service
EXPOSE 8004

CMD ["npm", "start"]