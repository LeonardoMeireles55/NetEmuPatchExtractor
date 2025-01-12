const fs = require('fs');
const path = require('path');

class SimpleLogger {
  constructor(logFilePath) {
    this.logFilePath = logFilePath || path.resolve(__dirname, 'application.log');
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