# Xiimalab Automation Service Documentation

## Overview

The Xiimalab Automation Service provides automated tools for capturing screenshots of the Xiimalab dashboard and optimizing them for various social media platforms using the RedimensionAI microservice.

## Components

### Snap Engine

The Snap Engine (`snap_engine.js`) is the core component that:

1. Launches a headless browser using Puppeteer
2. Navigates to the Xiimalab dashboard
3. Waits for animations to complete
4. Captures a screenshot of the dashboard
5. Sends the screenshot to RedimensionAI for optimization
6. Exports optimized images in multiple formats

### Configuration

The service can be configured using:

- Environment variables in `.env` file
- Command-line arguments
- Configuration file (`config.js`)

### Supported Export Formats

- LinkedIn (16:9 aspect ratio)
- TikTok (4:5 aspect ratio)
- Twitter (16:9 aspect ratio)

## Installation

```bash
cd services/automation
npm install
```

## Usage

### Basic Usage

```bash
# Capture and optimize dashboard
npm run snap
```

### Development Mode

```bash
# With custom URL
npm run snap:dev
```

### Custom Parameters

```bash
# With command-line arguments
npm run snap -- --url http://localhost:3000 --out ./exports
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DASHBOARD_URL` | URL of the dashboard to capture | http://localhost:3000 |
| `SNAP_OUTPUT_DIR` | Directory for output files | ./snapshots |
| `REDIMENSION_AI_URL` | URL of RedimensionAI microservice | http://localhost:8001 |
| `NODE_ENV` | Node environment | development |

## Docker Support

The service includes a Dockerfile for containerized deployment:

```bash
# Build the image
docker build -t xiimalab-automation .

# Run the container
docker run xiimalab-automation
```

## Testing

Run the test suite to verify all components are working:

```bash
npm test
```

## Troubleshooting

### Common Issues

1. **Browser launch failures**: Ensure all Puppeteer dependencies are installed
2. **Connection errors**: Verify the dashboard URL is accessible
3. **RedimensionAI errors**: Check that the microservice is running

### Logs

The service outputs logs to the console for debugging purposes.