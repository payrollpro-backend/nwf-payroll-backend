# 1. Use a Node.js base image that is known to support Puppeteer (Node 20 or 22 is good)
FROM node:20-slim

# 2. Set the working directory for the application
WORKDIR /app

# 3. Install necessary system dependencies for Chromium
# This is the step that fixes the "Read-only file system" error from apt-get.
# We run this during the Docker build, which has higher privileges.
RUN apt-get update && apt-get install -y \
    chromium \
    gconf-service \
    libnss3 \
    libasound2 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libfontconfig1 \
    libgdk-pixbuf2.0-0 \
    libgtk-3-0 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libxss1 \
    libgbm-dev \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# 4. Copy package files and install Node dependencies
# This is your equivalent of running 'npm install'
COPY package.json package-lock.json ./
RUN npm install

# 5. Copy the rest of your application code
COPY . .

# 6. Set the path to the installed Chromium executable
# This is CRITICAL for Puppeteer to find the browser installed by apt-get
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# 7. Expose the port your Express app listens on (10000 by default)
EXPOSE 10000

# 8. Define the command to start your application
# This is your equivalent of running 'npm start'
CMD ["npm", "start"]
