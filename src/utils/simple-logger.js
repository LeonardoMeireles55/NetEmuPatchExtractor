const fs = require('fs');
const path = require('path');

class SimpleLogger {
  constructor(logFilePath) {
    this.logFilePath = logFilePath || path.resolve(__dirname, 'application.log');
    this.stream = fs.createWriteStream(this.logFilePath, { flags: 'a', encoding: 'utf8' });
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

  _writeToLog(level, message, ...optionalParams) {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level}] ${message} ${optionalParams.join(' ')}\n`;

    if (level === 'ERROR') {
      console.error(formattedMessage);
    } else {
      console.log(formattedMessage);
    }

    this.stream.write(formattedMessage);
  }
}

module.exports = SimpleLogger;