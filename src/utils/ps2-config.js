const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const SimpleLogger = require('../utils/simple-logger');
const logger = new SimpleLogger('/tmp/log-file.log');

const execAsync = promisify(exec);

async function runPs2ConfigCmd() {
    try {
        const cwd = process.cwd();
        logger.log('Current working directory:', cwd);

        const binPath = path.join(cwd, 'public', 'binary', 'bin-cmd');
        logger.log('Binary path:', binPath);

        const inputPath = '/tmp/configs';
        const outputPath = '/tmp';
        const cmd = `${binPath} --verbose -1 "${inputPath}" "${outputPath}"`;
        logger.log('Executing command:', cmd);

        const { stdout, stderr } = await execAsync(cmd);

        if (stderr) {
            logger.error('Command error output:', stderr);
        }

        if (stdout) {
            logger.log('Command executed successfully');
        }

        return stdout;

    } catch (error) {
        logger.error('Error running ps2config-cmd:', error.message);
    }
}

module.exports = {
    runPs2ConfigCmd
};