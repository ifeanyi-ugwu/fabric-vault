/**
 * A tiny utility that wraps console.log and provides various logging levels.
 * Each method acts exactly like console.log, accepting multiple arguments.
 */
export const logger = {
  /**
   * The currently active logging level.
   */
  logLevel: getLogLevelFromEnv(),

  /**
   * Logs an informational message to the console.
   * Behaves like console.info().
   * @param {...any} args - The arguments to log.
   */
  info: function (...args: any) {
    if (this.logLevel >= LogLevel.INFO) {
      console.info(...args);
    }
  },

  /**
   * Logs a warning message to the console.
   * Behaves like console.warn().
   * @param {...any} args - The arguments to log.
   */
  warn: function (...args: any) {
    if (this.logLevel >= LogLevel.WARN) {
      console.warn(...args);
    }
  },

  /**
   * Logs a trace message to the console, including a stack trace.
   * Behaves like console.trace().
   * @param {...any} args - The arguments to log.
   */
  trace: function (...args: any) {
    if (this.logLevel >= LogLevel.TRACE) {
      console.trace(...args);
    }
  },

  /**
   * Logs a debug message to the console.
   * Behaves like console.debug().
   * @param {...any} args - The arguments to log.
   */
  debug: function (...args: any) {
    if (this.logLevel >= LogLevel.DEBUG) {
      console.debug(...args);
    }
  },

  /**
   * Logs an error message to the console.
   * Behaves like console.error().
   * @param {...any} args - The arguments to log.
   */
  error: function (...args: any) {
    if (this.logLevel >= LogLevel.ERROR) {
      console.error(...args);
    }
  },

  /**
   * A method to explicitly set the log level at runtime (e.g., for testing or dynamic control).
   * @param {LogLevel | string} level - The desired log level (either enum value or string).
   */
  setLogLevel: function (level: LogLevel | string) {
    if (typeof level === "string") {
      const parsedLevel = logLevelMap[level.toUpperCase()];
      if (parsedLevel !== undefined) {
        this.logLevel = parsedLevel;
      } else {
        console.warn(
          `Invalid log level string provided: "${level}". Keeping current log level.`
        );
      }
    } else if (Object.values(LogLevel).includes(level)) {
      this.logLevel = level;
    } else {
      console.warn(
        `Invalid log level provided: "${level}". Keeping current log level.`
      );
    }
  },
};

// Define an enum or a type for log levels to make it more robust
export enum LogLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
  TRACE = 5,
}

/**
 * Maps string log levels to their numeric enum values.
 * This makes it easier to parse environment variables.
 */
const logLevelMap: {
  [key: string]: LogLevel;
} = {
  NONE: LogLevel.NONE,
  ERROR: LogLevel.ERROR,
  WARN: LogLevel.WARN,
  INFO: LogLevel.INFO,
  DEBUG: LogLevel.DEBUG,
  TRACE: LogLevel.TRACE,
};

/**
 * Determines the current log level from environment variables.
 * In a Node.js environment, this would typically be `process.env.LOG_LEVEL`.
 * In a browser environment, you might use a global variable or a build-time replacement.
 * Defaults to INFO if not set or invalid.
 */
function getLogLevelFromEnv(): LogLevel {
  // For Node.js:
  // const envLogLevel = process.env.LOG_LEVEL?.toUpperCase();

  // For a generic example (or if you're using a build tool that replaces `process.env` for the browser):
  // Let's assume a global variable `_LOG_LEVEL_` or similar for browser environments if `process.env` is not available.
  // For this example, we'll simulate an environment variable.
  const envLogLevel = (
    typeof process !== "undefined" && process.env && process.env.LOG_LEVEL
      ? process.env.LOG_LEVEL
      : "INFO"
  ) // Default level if not set
    ?.toUpperCase();

  if (envLogLevel && logLevelMap[envLogLevel]) {
    return logLevelMap[envLogLevel];
  }
  // Fallback to a default if the environment variable is not set or invalid
  return LogLevel.INFO;
}
