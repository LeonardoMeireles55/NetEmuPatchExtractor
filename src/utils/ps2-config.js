const { execSync } = require('child_process');
const path = require('path');

function runPs2ConfigCmd() {
    try {
        // Log current working directory
        const cwd = process.cwd();
        console.log('Current working directory:', cwd);

        // Resolve binary path
        const binPath = path.join(cwd, 'public', 'binary', 'ps2config-cmd');
        console.log('Binary path:', binPath);

        // Resolve input/output paths
        const inputPath = '/tmp';

        // Form the command properly
        const cmd = `${binPath} --verbose -1 "${inputPath}" "${inputPath}"`;
        console.log('Executing command:', cmd);

        const result = execSync(cmd, {
            encoding: 'utf8',
            stdio: 'pipe'
        });

        return result;

    } catch (error) {
        // console.error('Error running ps2config-cmd:', error);
        // console.error('Error details:', {
        //     status: error.status,
        //     message: error.message,
        //     stderr: error.stderr,
        //     stdout: error.stdout
        // });
        // throw error;
    }
}

module.exports = {
    runPs2ConfigCmd
};