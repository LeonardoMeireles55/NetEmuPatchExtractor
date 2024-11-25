const fs = require('fs').promises;
const sqlite = require('sqlite');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = '/tmp/games.db';

async function getDatabaseConnection() {
  const db = await sqlite.open({ filename: DB_PATH, driver: sqlite3.Database });
  db.configure('busyTimeout', 5000);
  return db;
}

async function dropTable() {
  const db = await getDatabaseConnection();
  try {
    await db.run(`DROP TABLE IF EXISTS games`);
  } catch (err) {
    throw new Error('Error: ' + err);
  } finally {
    await db.close();
  }
}

async function ensureTableExists() {
  const db = await getDatabaseConnection();
  try {
    const sql = `SELECT name FROM sqlite_master WHERE type='table' AND name='games'`;
    const row = await db.get(sql);
    return !!row;
  } catch (err) {
    throw new Error('Erro ao verificar tabela: ' + err);
  } finally {
    await db.close();
  }
}

async function createTableAndInsertBatches(filePath) {
  const db = await getDatabaseConnection();
  try {
    const fileContent = await fs.readFile(filePath, 'utf8');
    const lines = fileContent.split('\n').filter(line => line.trim() !== '');

    await db.exec(`
      CREATE TABLE IF NOT EXISTS games (
        gameID TEXT PRIMARY KEY,
        altGameID TEXT,
        hash TEXT,
        name TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_gameID ON games(gameID);
      CREATE INDEX IF NOT EXISTS idx_altGameID ON games(altGameID);
    `);

    const batchSize = 250;
    for (let i = 0; i < lines.length; i += batchSize) {
      const batch = lines.slice(i, i + batchSize);
      const queries = batch.map(line => {
        const [gameID, altGameID, hash, ...nameParts] = line.split('\t');
        const name = nameParts.join(' ');
        return `('${gameID}', '${altGameID}', '${hash}', '${name.replace(/'/g, "''")}')`;
      });

      const sql = `
        INSERT OR REPLACE INTO games (gameID, altGameID, hash, name)
        VALUES ${queries.join(', ')};
      `;

      await db.run(sql);
    }

  } catch (err) {
    throw new Error('Error: ' + err);
  } finally {
    await db.close();
  }
}

async function findHashByGameID(gameID, altGameID) {
  const db = await getDatabaseConnection();
  const sql = `SELECT hash FROM games WHERE gameID = ? OR altGameID = ? LIMIT 1`;

  try {
    const row = await db.get(sql, [gameID, altGameID]);
    return row?.hash || null;
  } catch (err) {
    throw new Error('Error: ' + err);
  } finally {
    await db.close();
  }
}

module.exports = {
  createTableAndInsertBatches,
  findHashByGameID,
  ensureTableExists,
  getDatabaseConnection,
  dropTable,
};
