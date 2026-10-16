
FROM node:24

WORKDIR /app

# Install backend root dependencies
COPY package*.json ./
RUN npm install

# Copy auth service package files into the correct directory
COPY services/auth/package*.json ./services/auth/

# Install auth service dependencies
WORKDIR /app/services/auth
RUN npm install

# Copy auth service source code
WORKDIR /app
COPY services/auth ./services/auth

# Copy shared modules
COPY shared ./shared

# Run the auth service
WORKDIR /app/services/auth

EXPOSE 8001

CMD ["npm", "start"]
