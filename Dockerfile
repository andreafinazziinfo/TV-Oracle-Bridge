# Use the official Microsoft Playwright image which includes Node.js, Python, 
# and all system libraries required to run headless browsers (Chromium/Firefox/WebKit).
FROM mcr.microsoft.com/playwright:v1.44.0-jammy

# Set working directory
WORKDIR /app

# Copy package files and install Node.js dependencies
COPY package*.json ./
RUN npm install

# Copy python dependencies and install them
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Set environment variables for headless Playwright execution inside Docker
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV TV_BROWSER_HEADLESS=true
ENV TV_BROWSER_TYPE=chromium
ENV PYTHONPATH=/app

# Expose port (useful if FastMCP is run with SSE transport on port 8000)
EXPOSE 8000

# Default command to start the MCP server
CMD ["python", "mcp_server.py"]
