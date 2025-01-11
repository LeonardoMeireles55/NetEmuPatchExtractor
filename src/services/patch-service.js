const fs = require('fs');
const AdmZip = require('adm-zip');
const path = require('path');
const SimpleLogger = require('../utils/simple-logger');
const logger = new SimpleLogger('/tmp/log-file.log');
const { findHashByGameID } = require('../database/sqlite3-db.js');
const { runPs2ConfigCmd } = require('../utils/ps2-config');


class PatchService {

  static async saveAndZipFiles(originalOutputFilePath) {
    try {
      const hexExists = await fs.promises.access(originalOutputFilePath)
        .then(() => true)
        .catch(() => false);

      if (!hexExists) {
        throw new Error('One or more files missing before zip creation');
      }

      // Create zip
      const zip = new AdmZip();
      const zipPath = originalOutputFilePath + '.zip';

      // Add files with proper names
      zip.addLocalFile(originalOutputFilePath, '', path.basename(originalOutputFilePath));

      // Write zip synchronously to ensure completion
      zip.writeZipPromise = () => new Promise((resolve, reject) => {
        try {
          zip.writeZip(zipPath);
          resolve(zipPath);
        } catch (error) {
          reject(error);
        }
      });

      const finalZipPath = await zip.writeZipPromise();
      logger.log(`Zip file created: ${finalZipPath}`);

      return finalZipPath;
    } catch (error) {
      logger.error('Error in saveAndZipFiles:', error.message);
      throw error;
    }
  }


  static async processFile(inputFileName, originalname) {
    const configName = originalname.replace('.CONFIG', '');
    const outputFilePath = path.resolve(__dirname, '/tmp', configName);


    runPs2ConfigCmd();


    const zipFile = await this.saveAndZipFiles(outputFilePath);

    return zipFile;
  }

  static deleteOldFiles() {
    const outputDirectory = path.resolve(__dirname, '/tmp');
    fs.readdir(outputDirectory, (err, files) => {
      if (err) {
        logger.error("Error reading the output directory:", err.message);
        return;
      }
      files.forEach((file) => {
        if (file === 'log-file.log' || file === 'games.db') {
          return;
        }
        const filePath = path.resolve(outputDirectory, file);
        fs.unlink(filePath, (unlinkErr) => {
          if (unlinkErr) {
            logger.error("Error deleting the file:", unlinkErr.message);
            return;
          }
          logger.log(`Deleted file: ${file}`);
        });
      });
    });
  }

}
module.exports = PatchService;
