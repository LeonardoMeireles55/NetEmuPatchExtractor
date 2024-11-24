const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('games.db');


async function getHashByGameIDOrAlt(gameID, altGameID) {
  const db = new sqlite3.Database('games.db');
  
  // A função de consulta retornará uma Promise
  return new Promise((resolve, reject) => {
    const sql = `SELECT hash FROM games WHERE gameID = ? OR altGameID = ? LIMIT 1`;

    db.get(sql, [gameID, altGameID], (err, row) => {
      if (err) {
        reject('Erro ao consultar o hash: ' + err);
      } else {
        resolve(row ? row.hash : null);
      }
    });

    db.close();
  })};

  
function createTableAndInsertBatches(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const lines = fileContent.split('\n').filter(line => line.trim() !== '');

  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS games (
      gameID TEXT PRIMARY KEY,
      altGameID TEXT,
      hash TEXT,
      name TEXT
    )`);

    db.run(`CREATE INDEX IF NOT EXISTS idx_gameID ON games(gameID)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_altGameID ON games(altGameID)`);

    const batchSize = 250;
    let batch = [];

    lines.forEach((line, index) => {
      const [gameID, altGameID, hash, ...nameParts] = line.split('\t');
      const name = nameParts.join(' ');

      batch.push([gameID, altGameID, hash, name]);

      if (batch.length === batchSize || index === lines.length - 1) {
        const stmt = db.prepare(`INSERT OR REPLACE INTO games (gameID, altGameID, hash, name) VALUES (?, ?, ?, ?)`);
        
        batch.forEach(row => {
          stmt.run(row);
        });

        stmt.finalize();
        batch = [];  // Limpar o batch após inserção
      }
    });

    console.log('Dados inseridos com sucesso!');
  });

  db.close();
};

module.exports = {createTableAndInsertBatches, getHashByGameIDOrAlt};
