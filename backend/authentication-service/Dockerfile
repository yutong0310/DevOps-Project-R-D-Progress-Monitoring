# Use Ubuntu as base image
FROM ubuntu:latest

# Set working directory
WORKDIR /app

# add this line to always accept installs
ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies including ca-certificates
RUN apt update && apt install -y \
    curl \
    ca-certificates \
   && update-ca-certificates && apt install -y cron

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

# Ensure Let's Encrypt Root Certificate is present
RUN wget -O /usr/local/share/ca-certificates/ISRG_Root_X1.crt https://letsencrypt.org/certs/isrgrootx1.pem

# Add the custom certificate to the system's trusted CA store
RUN update-ca-certificates

# Create a cron job to update certificates automatically every year
RUN echo "0 0 1 1 * root apt update && apt install -y ca-certificates && update-ca-certificates" > /etc/cron.d/cert-update \
    && chmod 0644 /etc/cron.d/cert-update \
    && crontab /etc/cron.d/cert-update

# Start cron in the background
RUN service cron start

# Set environment variable to explicitly trust this certificate
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt

# Expose port
EXPOSE 5001

# Start application with cron running in the background
CMD service cron start && node ./src/server.js


# Copy SSL certificates (if necessary)
# COPY fullchain.pem /usr/local/share/ca-certificates/fullchain.crt


# Start application
