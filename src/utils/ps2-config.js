const { execSync } = require('child_process');
const path = require('path');
const SimpleLogger = require('../utils/simple-logger');
const logger = new SimpleLogger('/tmp/log-file.log');

function runPs2ConfigCmd() {
    try {
        const cwd = process.cwd();
        logger.log('Current working directory:', cwd);

        const binPath = path.join(cwd, 'public', 'binary', 'ps2config-cmd');
        logger.log('Binary path:', binPath);

        const inputPath = '/tmp';
        const outputPath = '/tmp';
        const cmd = `${binPath} --verbose -1 "${inputPath}" "${outputPath}"`;
        logger.log('Executing command:', cmd);

        const result = execSync(cmd, {
            encoding: 'utf8',
            stdio: 'pipe'
        });

        return result;

    } catch (error) {
        logger.error('Error running ps2config-cmd:', error.message);
    }
}

module.exports = {
    runPs2ConfigCmd
};