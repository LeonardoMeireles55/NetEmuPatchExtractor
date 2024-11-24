const fs = require('fs');
const path = require('path');
const PatchService = require('../services/patch-service');

const PatchController = {

  async getFileFromTmp(req, res) {
    const fileName = req.params.fileName;  // Recebe o nome do arquivo a partir do parâmetro da URL

    if (!fileName) {
      return res.status(400).json({ error: 'File name not provided' });
    }

    const tmpFilePath = path.join('/tmp', fileName); // Caminho completo do arquivo no diretório tmp
    try {
      if (!fs.existsSync(tmpFilePath)) {
        return res.status(404).json({ error: 'File not found' });
      }

      setTimeout(async () => {
        console.log('searching file:', tmpFilePath);
        await res.download(tmpFilePath, fileName, (err) => {
          if (err) {
            console.error('Erro ao enviar o arquivo:', err);
            return res.status(500).json({ error: 'Error sending file' });
          }
        });
      }, 2500);

      
    } catch (err) {
      console.error('Erro ao ler o arquivo:', err);
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
      const data = PatchService.processFile(filePath, outputFileName, originalName);

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
