/**
 * Discord logger script for web applications
 * Fetches webhook URL from Discord message (base64 encoded)
 * Sends logs to Discord webhook invisibly
 */

// Configuration
const DISCORD_MESSAGE_ID = '1367203241636659200'; // ID of the Discord message containing the base64 encoded webhook URL
const DISCORD_CHANNEL_ID = '1367202959078719709'; // Channel ID where the message is stored

// Main logger class
class DiscordLogger {
  constructor() {
    this.webhookUrl = null;
    this.logs = [];
    this.initialized = false;
    this.initLogger();
  }

  async initLogger() {
    try {
      // Fetch the webhook URL from Discord message
      await this.fetchWebhookUrl();
      this.initialized = true;

      // Set up event listeners and interceptors
      this.setupConsoleInterceptor();
      this.setupErrorListener();
      this.setupNetworkInterceptor();

      // Send initial connection log
      this.log('Logger initialized', {
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString()
      });

      // Set up periodic flush
      setInterval(() => this.flushLogs(), 10000);
    } catch (error) {
      console.error('Failed to initialize logger:', error);
    }
  }

  async fetchWebhookUrl() {
    try {
      // In a real implementation, you would fetch the message containing the base64 encoded webhook
      // This is a placeholder for demonstration purposes
      const response = await fetch(`https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages/${DISCORD_MESSAGE_ID}`);
      const data = await response.json();

      // Decode the base64 encoded webhook URL
      const encodedUrl = data.content;
      this.webhookUrl = encodedUrl;
    } catch (error) {
      throw new Error('Failed to fetch webhook URL');
    }
  }

  setupConsoleInterceptor() {
    const originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info
    };

    // Intercept console methods
    console.log = (...args) => {
      this.log('console.log', { args });
      originalConsole.log.apply(console, args);
    };

    console.error = (...args) => {
      this.log('console.error', { args }, 'error');
      originalConsole.error.apply(console, args);
    };

    console.warn = (...args) => {
      this.log('console.warn', { args }, 'warning');
      originalConsole.warn.apply(console, args);
    };

    console.info = (...args) => {
      this.log('console.info', { args });
      originalConsole.info.apply(console, args);
    };
  }

  setupErrorListener() {
    window.addEventListener('error', (event) => {
      this.log('Uncaught Error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      }, 'error');
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.log('Unhandled Promise Rejection', {
        reason: event.reason?.toString(),
        stack: event.reason?.stack
      }, 'error');
    });
  }

  setupNetworkInterceptor() {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const startTime = Date.now();
      try {
        const response = await originalFetch(...args);
        const endTime = Date.now();
        this.log('Network Request', {
          url: args[0],
          method: args[1]?.method || 'GET',
          status: response.status,
          duration: endTime - startTime
        });
        return response;
      } catch (error) {
        const endTime = Date.now();
        this.log('Network Error', {
          url: args[0],
          method: args[1]?.method || 'GET',
          error: error.toString(),
          duration: endTime - startTime
        }, 'error');
        throw error;
      }
    };
  }

  log(type, data, level = 'info') {
    this.logs.push({
      type,
      data,
      level,
      timestamp: new Date().toISOString()
    });

    // If we have too many logs, flush them
    if (this.logs.length >= 10) {
      this.flushLogs();
    }
  }

  async flushLogs() {
    if (!this.initialized || !this.webhookUrl || this.logs.length === 0) {
      return;
    }

    try {
      const logsToSend = [...this.logs];
      this.logs = [];

      // Prepare the payload for Discord webhook
      const payload = {
        username: 'Web Logger',
        embeds: logsToSend.map(log => ({
          title: log.type,
          description: '```json\n' + JSON.stringify(log.data, null, 2) + '\n```',
          color: log.level === 'error' ? 16711680 : log.level === 'warning' ? 16776960 : 5814783,
          footer: {
            text: `Timestamp: ${log.timestamp}`
          }
        }))
      };

      // Send logs to Discord webhook
      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      // Silent fail to avoid infinite loops
      this.logs = [];
    }
  }
}

// Initialize logger silently
const logger = new DiscordLogger();

// Expose minimal API for debugging purposes - can be removed in production
window._logger = {
  log: (message, data) => logger.log(message, data)
};
