const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const cron = require('node-cron');

const PatchController = require('./src/controllers/patch-controller');
const PatchService = require('./src/services/patch-service');
const { createTableAndInsertBatches, getHashByGameIDOrAlt, ensureTableExists } = require('./src/database/sqlite3-db.js');



const app = express();
const port = 3000;

const upload = multer({ dest: '/tmp' });

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
    const hash = await getHashByGameIDOrAlt(gameID, gameID);
    res.json({ hash });
  } catch (error) {
    console.error('Error on searching hash', error);
    res.status(500).json({ error: 'Search was failed' });
  }
});

app.get('/download/:fileName', (req, res) => PatchController.getFileFromTmp(req, res));


app.post('/process-hex', upload.single('file'), PatchController.processHexFile);


(async () => {
  try {
    console.log('Initializing database...');
    
    const tableExists = await ensureTableExists();
    if (!tableExists) {
      console.log('Table "games" does not exist, creating...');
      await createTableAndInsertBatches(path.join(__dirname, 'public', 'hashes', 'hashes.txt'));
    } else {
      console.log('Table "games" already exists');
    }

    app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Error on initialize database: -> ', error);
    process.exit(1);
  }
})();

cron.schedule('*/3 * * * *', () => {

  console.log('Cron job running every minute');
  PatchService.deleteOldFiles();
  
});

// async function getFileFromTmp(fileName) {
//   const tmpFilePath = path.join('/tmp', fileName);
//   try {
//       const fileData = await fs.promises.readFile(tmpFilePath);
//       console.log(`Arquivo lido de: ${tmpFilePath}`);
//       return fileData;
//   } catch (err) {
//       console.error('Erro ao ler o arquivo:', err);
//       throw err;
//   }
// }