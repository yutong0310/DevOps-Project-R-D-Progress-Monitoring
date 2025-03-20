# Use Ubuntu as base image
FROM ubuntu:latest

# Set working directory
WORKDIR /app

# Install dependencies including ca-certificates
RUN apt update && apt install -y \
    curl \
    ca-certificates \
    && update-ca-certificates

# Install latest Node.js from NodeSource
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt install -y nodejs && apt install wget

# Verify installation
RUN node -v && npm -v

# Copy package.json and install dependencies
COPY package.json package-lock.json ./
RUN npm install --production

# Copy application files
COPY . .

RUN wget -O /usr/local/share/ca-certificates/ISRG_Root_X1.crt https://letsencrypt.org/certs/isrgrootx1.pem

# Copy SSL certificates (if necessary)
COPY fullchain.pem /usr/local/share/ca-certificates/fullchain.crt

# Add the custom certificate to the system's trusted CA store
RUN update-ca-certificates

# Set environment variable to explicitly trust this certificate
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt

# Expose port
EXPOSE 5001

# Start application
CMD ["node", "./src/server.js"]
