const fs = require('fs').promises;
const path = require('path');
const PatchService = require('../services/patch-service');

const PatchController = {

  async getFileFromTmp(req, res) {
    const fileName = req.params.fileName;
  
    if (!fileName) {
      return res.status(400).json({ error: 'File name not provided' });
    }
  
    const tmpFilePath = path.join('/tmp', fileName);
    
    try {
      await fs.access(tmpFilePath);
      
      const stats = await fs.stat(tmpFilePath);
      if (stats.size === 0) {
        return res.status(400).json({ error: 'File is empty' });
      }
  
      console.log('sending file:', tmpFilePath);
      return res.download(tmpFilePath, fileName, (err) => {
        if (err) {
          console.error('Error sending file:', err);
          return res.status(500).json({ error: 'Error sending file' });
        }
      });
  
    } catch (err) {
      console.error('Error reading the file:', err);
      return res.status(500).json({ error: 'Error reading the file' });
    }
  },

  async processHexFile(req, res) {
    if (!req.file) {
      return res.status(400).json({ error: 'Hex file is required' });
    }
    

    const filePath = req.file.path; 
    const originalName = req.file.originalname; 
    const outputFileName = `converted_${originalName}.txt`;

    console.log(`Processing hex file: ${originalName}`);

    try {
      const data = await PatchService.processFile(filePath, outputFileName, originalName);

      return res.status(200).json({
        message: 'Hex file processing completed.',
        downloadLink: `/download/${outputFileName}`
      });
      
    } catch (error) {
      console.error('Error processing hex file:', error.message);
      return res.status(500).json({ error: 'Error processing hex file' });
    }
  }};
  
module.exports = PatchController;
