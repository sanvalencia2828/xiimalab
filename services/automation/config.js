/**
 * Xiimalab Automation Service Configuration
 */

// Load environment variables
require('dotenv').config();

module.exports = {
  // Dashboard settings
  dashboard: {
    url: process.env.DASHBOARD_URL || 'http://localhost:3000',
    viewport: {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 2
    },
    timeout: 30000,
    animationWait: 2000
  },

  // RedimensionAI settings
  redimensionAI: {
    url: process.env.REDIMENSION_AI_URL || 'http://localhost:8001',
    formats: [
      {
        name: 'linkedin-16x9',
        width: 1920,
        height: 1080,
        platform: 'linkedin'
      },
      {
        name: 'tiktok-4x5',
        width: 1080,
        height: 1350,
        platform: 'tiktok'
      },
      {
        name: 'twitter-16x9',
        width: 1200,
        height: 675,
        platform: 'twitter'
      }
    ]
  },

  // Output settings
  output: {
    directory: process.env.SNAP_OUTPUT_DIR || './snapshots',
    filenamePrefix: 'dashboard'
  },

  // Browser settings
  browser: {
    headless: process.env.NODE_ENV === 'production' ? 'new' : false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  },

  // Retry settings
  retry: {
    maxAttempts: 3,
    delay: 1000
  }
};