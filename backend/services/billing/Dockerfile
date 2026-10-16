
FROM node:24

WORKDIR /app

# Install backend root dependencies
COPY package*.json ./
RUN npm install

# Copy billing service package files into the correct directory
COPY services/billing/package*.json ./services/billing/

# Install billing service dependencies
WORKDIR /app/services/billing
RUN npm install

# Copy billing service source code
WORKDIR /app
COPY services/billing ./services/billing

# Copy shared modules
COPY shared ./shared

# Run the billing service
WORKDIR /app/services/billing

EXPOSE 8004

CMD ["npm", "start"]
