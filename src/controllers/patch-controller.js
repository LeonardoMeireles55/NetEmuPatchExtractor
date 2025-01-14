const fs = require('fs').promises;
const path = require('path');
const SimpleLogger = require('../utils/simple-logger');
const logger = new SimpleLogger('/tmp/log-file.log');
const PatchService = require('../services/patch-service');

// Extracted constant for special character pattern
const SPECIAL_CHAR_PATTERN = /[^\w._]/;

const PatchController = {

  async getFileFromTmp(req, res) {
    const fileName = req.params.fileName;

    if (!fileName) {
      return res.status(400).json('File name not provided');
    }

    const tmpFilePath = path.join('/tmp', fileName);

    try {
      const waitForFile = async () => {
        let isReady = false;
        let attempts = 0;

        while (!isReady && attempts < 15) {
          try {
            await fs.access(tmpFilePath);

            const stats = await fs.stat(tmpFilePath);
            isReady = stats.size > 0;
          } catch (err) {
            console.error('File not ready yet:', err);
          }

          if (!isReady) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
          }
        }

        return isReady;
      };

      const isFileReady = await waitForFile();
      if (!isFileReady) {
        return res.status(400).json({ error: 'File is not ready' });
      }

      logger.log('Sending file:', tmpFilePath);
      return res.download(tmpFilePath, fileName, (err) => {
        if (err) {
          logger.error('Error sending file:', err);
          return res.status(500).json({ error: 'Error sending file' });
        }
      });

    } catch (err) {
      console.error('Error reading the file:', err);
      return res.status(500).json({ error: 'Error reading the file' });
    }
  },

  async generateJsonResponse(req, res) {
    const filePath = req.file.path;
    const name = req.file.originalname;

    if (!name) {
      return res.status(400).json({ error: 'File name is required' });
    }

    if (SPECIAL_CHAR_PATTERN.test(req.file.originalname)) {
      return res.status(400).json('File name contains invalid characters as (), [], {}, etc.');
    }

    try {
      const originalName = name.replace('.CONFIG', '');
      const json = await PatchService.returnJsonOfConfigs(filePath, originalName);
      return res.status(200).json(json);
    } catch (error) {
      logger.error('Error building JSON:', error.message);
      return res.status(500).json('Error building JSON');
    }
  },

  async processHexFile(req, res) {
    if (!req.file) {
      return res.status(400).json({ error: 'Hex file is required' });
    }

    if (SPECIAL_CHAR_PATTERN.test(req.file.originalname)) {
      return res.status(400).json('File name contains invalid characters as (), [], {}, etc.');
    }

    if (!req.file.originalname.endsWith('.CONFIG')) {
      return res.status(400).json({ error: 'File must end with .CONFIG extension' });
    }

    const filePath = req.file.path;
    const name = req.file.originalname;
    const originalName = name.replace('.CONFIG', '');

    logger.log(`Processing hex file: ${originalName}`);

    try {
      await PatchService.processFile(filePath, originalName);
      return res.status(200).json({
        message: 'Hex file processing completed.',
        downloadLink: `/download/${originalName}.zip`
      });
    } catch (error) {
      logger.error('Error processing hex file:', error.message);
      return res.status(500).json('Error processing hex file');
    }
  },
};

module.exports = PatchController;
