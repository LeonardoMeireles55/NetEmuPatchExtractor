const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const cron = require('node-cron');

const PatchController = require('./src/controllers/patch-controller');
const PatchService = require('./src/services/patch-service');
const { createTableAndInsertBatches, findHashByGameID, ensureTableExists } = require('./src/database/sqlite3-db.js');
const SimpleLogger = require('./src/utils/simple-logger');
const logger = new SimpleLogger(process.env.LOG_FILE_PATH || '/tmp/log-file.log');

const app = express();
const port = process.env.PORT || 3000;

const storage = multer.diskStorage({
  destination: '/tmp/configs',
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });

app.use(express.json());
app.use(cors());

app.use('/output', express.static(path.join(__dirname, 'public/output')));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/hash/:gameID', async (req, res) => {
  const gameID = req.params.gameID;
  try {
    const hash = await findHashByGameID(gameID, gameID);
    res.json({ hash });
  } catch (error) {
    logger.error('Error on searching hash', error);
    res.status(500).json({ error: 'Search was failed' });
  }
});

app.get('/download/:fileName', async (req, res) => {
  try {
    await PatchController.getFileFromTmp(req, res);
  } catch (err) {
    logger.error('Error in /download route:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/process-hex', upload.single('file'), async (req, res) => {
  try {
    await PatchController.processHexFile(req, res);
  } catch (error) {
    logger.error('Error processing hex file:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

app.post('/process-hex-json', upload.single('file'), async (req, res) => {
  try {
    await PatchController.generateJsonResponse(req, res);
  } catch (error) {
    logger.error('Error generating JSON response:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

(async () => {
  try {
    logger.log('Initializing database...');
    const tableExists = await ensureTableExists();
    if (!tableExists) {
      logger.log('Table "games" does not exist, creating...');
      await createTableAndInsertBatches(path.join(__dirname, 'public', 'hashes', 'hashes.txt'));
    } else {
      logger.log('Table "games" already exists');
    }

    app.listen(port, () => {
      logger.log(`Server running on http://localhost:${port}`);
    });
  } catch (error) {
    logger.error('Error on initialize database: -> ', error);
    process.exit(1);
  }
})();

cron.schedule('*/5 * * * *', async () => {
  try {
    logger.log('Cron job running every 5 minutes');
    await PatchService.deleteOldFiles();
  } catch (error) {
    logger.error('[CRON ERROR]:', error);
  }
});