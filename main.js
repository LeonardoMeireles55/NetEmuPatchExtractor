const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const cron = require('node-cron');

const PatchController = require('./src/controllers/patch-controller');

const app = express();
const port = 3000;

const upload = multer({ dest: 'public/statics/input/uploads' });

app.use(express.json());
app.use(cors());

app.use('/output', express.static(path.join(__dirname, 'public/output')));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/download', (req, res)  => PatchController.getDownloadAndEraseFile(req, res));

app.post('/process-hex', upload.single('file'), PatchController.processHexFile);


app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

cron.schedule('*/2 * * * *', () => {

  console.log('Cron job running every minute');
  // PatchService.deleteOldFiles();
  
});