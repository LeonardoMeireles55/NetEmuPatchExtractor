const fs = require('fs');
const path = require('path');

class SimpleLogger {
  constructor(logFilePath) {
    this.logFilePath = logFilePath || path.resolve(__dirname, 'application.log');
    this.logLevel = process.env.LOG_LEVEL || 'LOG';
    this.stream = this._createWriteStream(this.logFilePath);
  }

  log(message, ...optionalParams) {
    this._writeToLog('LOG', message, ...optionalParams);
  }

  info(message, ...optionalParams) {
    this._writeToLog('LOG', message, ...optionalParams);
  }

  error(message, ...optionalParams) {
    this._writeToLog('ERROR', message, ...optionalParams);
  }

  warn(message, ...optionalParams) {
    this._writeToLog('WARN', message, ...optionalParams);
  }

  _createWriteStream(logFilePath) {
    const logDir = path.dirname(logFilePath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    return fs.createWriteStream(logFilePath, { flags: 'a', encoding: 'utf8' });
  }

  _getTimestamp() {
    return new Date().toISOString();
  }

  _formatLogMessage(level, message, ...optionalParams) {
    const timestamp = this._getTimestamp();
    return `[${timestamp}] [${level}] ${message} ${optionalParams.join(' ')}\n`;
  }

  _writeToLog(level, message, ...optionalParams) {
    const levels = { 'ERROR': 0, 'WARN': 1, 'INFO': 2, 'LOG': 3 };
    if (levels[level] > levels[this.logLevel.toUpperCase()]) {
      return;
    }

    const formattedMessage = this._formatLogMessage(level, message, ...optionalParams);

    if (level === 'ERROR') {
      console.error(formattedMessage);
    } else {
      console.log(formattedMessage);
    }

    this.stream.write(formattedMessage);
  }
}

module.exports = SimpleLogger;