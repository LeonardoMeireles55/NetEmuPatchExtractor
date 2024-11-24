const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = '/tmp/games.db';

function getDatabaseConnection() {
  return new sqlite3.Database(DB_PATH);
}

async function ensureTableExists() {
  const db = getDatabaseConnection();
  
  return new Promise((resolve, reject) => {
    const sql = `SELECT name FROM sqlite_master WHERE type='table' AND name='games'`;
    db.get(sql, (err, row) => {
      db.close(); // Fecha a conexão após a operação
      if (err) {
        reject('Erro ao verificar tabela: ' + err);
      } else {
        resolve(!!row);
      }
    });
  });
}

function createTableAndInsertBatches(filePath) {
  const db = getDatabaseConnection();

  return new Promise((resolve, reject) => {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n').filter(line => line.trim() !== '');

    db.serialize(() => {
      db.run(
        `CREATE TABLE IF NOT EXISTS games (
          gameID TEXT PRIMARY KEY,
          altGameID TEXT,
          hash TEXT,
          name TEXT
        )`,
        (err) => {
          if (err) {
            db.close();
            return reject('Erro ao criar tabela: ' + err);
          }

          db.run(`CREATE INDEX IF NOT EXISTS idx_gameID ON games(gameID)`);
          db.run(`CREATE INDEX IF NOT EXISTS idx_altGameID ON games(altGameID)`);

          const batchSize = 250;
          let batch = [];

          lines.forEach((line, index) => {
            const [gameID, altGameID, hash, ...nameParts] = line.split('\t');
            const name = nameParts.join(' ');

            batch.push([gameID, altGameID, hash, name]);

            if (batch.length === batchSize || index === lines.length - 1) {
              const stmt = db.prepare(
                `INSERT OR REPLACE INTO games (gameID, altGameID, hash, name) VALUES (?, ?, ?, ?)`
              );

              batch.forEach(row => stmt.run(row));
              stmt.finalize();
              batch = [];
            }
          });

          console.log('Dados inseridos com sucesso!');
          db.close();
          resolve();
        }
      );
    });
  });
}

// Busca o hash por gameID ou altGameID
async function getHashByGameIDOrAlt(gameID, altGameID) {
  const db = getDatabaseConnection();

  return new Promise((resolve, reject) => {
    const sql = `SELECT hash FROM games WHERE gameID = ? OR altGameID = ? LIMIT 1`;

    db.get(sql, [gameID, altGameID], (err, row) => {
      db.close(); 
      if (err) {
        reject('Erro ao consultar o hash: ' + err);
      } else {
        resolve(row ? row.hash : null);
      }
    });
  });
}

module.exports = {
  createTableAndInsertBatches,
  getHashByGameIDOrAlt,
  ensureTableExists,
  getDatabaseConnection
};
