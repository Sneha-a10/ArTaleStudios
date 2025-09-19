import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbInstance;

export function getDb() {
    if (!dbInstance) {
        // Place DB under uploads so it persists on Render disk
        const uploadsDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const dbPath = path.join(uploadsDir, 'data.sqlite');
        dbInstance = new Database(dbPath);
        dbInstance.pragma('journal_mode = WAL');
    }
    return dbInstance;
}


