import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbInstance;

export function getDb() {
    if (!dbInstance) {
        const dbPath = path.join(__dirname, 'data.sqlite');
        dbInstance = new Database(dbPath);
        dbInstance.pragma('journal_mode = WAL');
    }
    return dbInstance;
}


