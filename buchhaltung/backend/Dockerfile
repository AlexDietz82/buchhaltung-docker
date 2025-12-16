FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Create uploads directory
RUN mkdir -p /app/uploads && chmod 777 /app/uploads

# Expose port
EXPOSE 8079

# Start the application
CMD ["node", "server.js"]
