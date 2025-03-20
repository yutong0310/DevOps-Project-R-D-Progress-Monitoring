# Use Node.js base image (Use LTS version for stability)
FROM node:18 

# Set working directory inside the container
WORKDIR /app

# Copy package.json and install dependencies first (for better caching)
COPY package.json package-lock.json ./
RUN npm install --only=production

# Copy the rest of the application files
COPY . . 

# Check if `server.js` exists inside `src`
RUN ls -la src/

# Expose port 5001 to the outside world
EXPOSE 5001

# Define the command to start the service
CMD ["node", "./src/server.js"]
