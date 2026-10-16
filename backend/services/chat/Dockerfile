
FROM node:24

WORKDIR /app

# Install backend root dependencies
COPY package*.json ./
RUN npm install

# Copy chat service package files into the correct directory
COPY services/chat/package*.json ./services/chat/

# Install chat service dependencies
WORKDIR /app/services/chat
RUN npm install

# Copy chat service source code
WORKDIR /app
COPY services/chat ./services/chat

# Copy shared modules
COPY shared ./shared

# Run the chat service
WORKDIR /app/services/chat

EXPOSE 8002

CMD ["npm", "start"]
