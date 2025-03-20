# Use an official Node.js runtime as a parent image
FROM node:18

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json before installing dependencies (for better caching)
COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm install 

# Copy the rest of the application files
COPY . .

# Expose port 5002 for the checklist service
EXPOSE 5002

# Define the command to run the app
CMD ["node", "./src/server.js"]
