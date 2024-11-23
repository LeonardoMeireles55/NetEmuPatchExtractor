const fs = require('fs');
const path = require('path');
const PatchService = require('../services/patch-service');

const PatchController = {

  async processHexFile(req, res) {
    if (!req.file) {
      return res.status(400).json({ error: 'Hex file is required' });
    }
    

    const filePath = req.file.path; 
    const originalName = req.file.originalname; 
    const outputFileName = `converted_${originalName}.txt`;

    console.log(`Processing hex file: ${originalName}`);

    try {
      PatchService.processFile(filePath, outputFileName, originalName);

      fs.unlink(filePath, (err) => {
        if (err) {
          console.error('Error:', err);
        } else {
          console.log('Sucess deleting file:', filePath);
        }
      });

      return res.status(200).json({
        message: 'Hex file processing completed.',
        downloadLink: `/statics/output/${outputFileName}`
      });
      
    } catch (error) {
      console.error('Error processing hex file:', error.message);
      return res.status(500).json({ error: 'Error processing hex file' });
    }
  }};
  
module.exports = PatchController;
