
FROM node:24

WORKDIR /app

# Install backend root dependencies
COPY package*.json ./
RUN npm install

# Install agent dependencies
COPY services/agent/package*.json ./services/agent/

WORKDIR /app/services/agent
RUN npm install

# Copy application source code
WORKDIR /app
COPY services/agent ./services/agent
COPY shared ./shared

WORKDIR /app/services/agent

EXPOSE 8003

CMD ["npm", "start"]
