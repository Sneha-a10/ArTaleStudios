import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getDb } from './db.js';
import multer from 'multer';
import fs from 'fs';
import { spawn } from 'child_process';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;
const jwtSecret = process.env.JWT_SECRET || 'dev_secret_change_me';

app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));
app.use(express.json());
app.use(cookieParser());

// Auth middleware - must be before routes that need authentication
function authMiddleware(req, _res, next) {
    const token = req.cookies.token;
    if (!token) {
        return next();
    }
    try {
        const decoded = jwt.verify(token, jwtSecret);
        req.user = decoded;
    } catch (e) {
        // ignore invalid token
    }
    next();
}

app.use(authMiddleware);

// Simple health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});

// Debug endpoint
app.get('/debug/auth', (req, res) => {
    res.json({
        cookies: req.cookies,
        user: req.user,
        headers: req.headers.cookie,
        hasToken: !!req.cookies.token,
        tokenLength: req.cookies.token ? req.cookies.token.length : 0
    });
});



// Create test user endpoint
app.post('/debug/create-test-user', async (req, res) => {
    try {
        const email = 'test@test.com';
        const password = 'test123';
        const passwordHash = await bcrypt.hash(password, 10);

        // Check if user exists
        const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existing) {
            return res.json({ message: 'Test user already exists', email });
        }

        const stmt = db.prepare('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)');
        const info = stmt.run(email, passwordHash, 'Test User');
        res.json({ message: 'Test user created', id: info.lastInsertRowid, email });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// File upload setup
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname || '');
        cb(null, unique + ext);
    }
});
const upload = multer({ storage });

function getPythonCommand() {
    // Prefer python3; allow override via env; fallback to python
    return process.env.PYTHON_CMD || 'python3';
}

// Test story generation endpoint
app.post('/debug/test-story', upload.single('image'), async (req, res) => {
    try {
        const { description, storyType } = req.body || {};
        const imagePath = req.file ? req.file.path : null;
        
        if (!imagePath) {
            return res.status(400).json({ error: 'Image is required' });
        }
        
        const pythonScript = path.join(__dirname, 'generate_story_new.py');
        const imageFullPath = path.join(__dirname, imagePath);
        const outputDir = path.join(__dirname, 'uploads');
        
        const python = spawn(getPythonCommand(), [
            pythonScript,
            imageFullPath,
            description || 'A crafted piece',
            storyType || 'The story should be leaned towards Indian culture',
            outputDir
        ], {
            timeout: 60000
        });
        
        let output = '';
        let error = '';
        
        python.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        python.stderr.on('data', (data) => {
            error += data.toString();
        });
        
        python.on('close', (code) => {
            res.json({
                exitCode: code,
                output: output,
                error: error,
                success: code === 0
            });
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Helper function to create enhanced fallback stories
function createFallbackStory(description, storyType) {
    const desc = description || 'A crafted piece';
    return `In the heart of a traditional workshop, where ancient techniques meet passionate artistry, this remarkable piece came to life. ${desc}

The master craftsperson began their work in the early morning hours, when the light was soft and the world was quiet. With hands that carried the wisdom of generations, they carefully selected each material, understanding that every choice would contribute to the final masterpiece.

${storyType} This cultural heritage flows through every deliberate movement, every careful stroke, every moment of patient creation. The techniques used have been passed down through families for centuries, each generation adding their own touch while preserving the essential spirit of the craft.

As the work progressed, the piece began to tell its own story. The subtle variations in texture, the gentle curves that speak of human touch, the imperfections that make it uniquely beautiful – all these elements combine to create something far more valuable than mere function.

This is not just an object; it is a bridge between past and present, a tangible connection to cultural roots, and a testament to the enduring power of human creativity. In a world increasingly dominated by machines, this piece stands as a proud reminder of what hands guided by heart and heritage can achieve.

The finished work carries within it the soul of its maker and the spirit of its cultural tradition, ready to become part of someone's story, adding its own chapter to the endless narrative of human artistic expression.`;
}

// Posts API
app.get('/api/posts', (req, res) => {
    const rows = db.prepare(`
      SELECT p.id, p.title, p.description, p.image_path, p.audio_path, p.created_at,
             u.id as user_id, COALESCE(u.name, u.email) as user_name, u.profile_image,
             (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
             (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count
      FROM posts p JOIN users u ON u.id = p.user_id
      ORDER BY p.id DESC
    `).all();

    // Add liked status for authenticated users
    if (req.user) {
        rows.forEach(row => {
            const liked = db.prepare('SELECT id FROM likes WHERE user_id = ? AND post_id = ?').get(req.user.id, row.id);
            row.liked = !!liked;
        });
    }

    res.json(rows);
});

app.get('/api/posts/:id', (req, res) => {
    const id = Number(req.params.id);
    const row = db.prepare(`
      SELECT p.id, p.title, p.description, p.story, p.image_path, p.audio_path, p.created_at,
             u.id as user_id, COALESCE(u.name, u.email) as user_name, u.profile_image,
             (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
             (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count
      FROM posts p JOIN users u ON u.id = p.user_id
      WHERE p.id = ?
    `).get(id);
    if (!row) return res.status(404).json({ error: 'not found' });

    // Add liked status for authenticated users
    if (req.user) {
        const liked = db.prepare('SELECT id FROM likes WHERE user_id = ? AND post_id = ?').get(req.user.id, id);
        row.liked = !!liked;
    }

    res.json(row);
});

app.get('/api/my-posts', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'unauthorized' });
    const rows = db.prepare(`
      SELECT id, title, description, image_path, audio_path, created_at
      FROM posts WHERE user_id = ? ORDER BY id DESC
    `).all(req.user.id);
    res.json(rows);
});

// Get posts by user ID
app.get('/api/users/:id/posts', (req, res) => {
    const userId = Number(req.params.id);
    const rows = db.prepare(`
      SELECT id, title, description, image_path, audio_path, created_at
      FROM posts WHERE user_id = ? ORDER BY id DESC
    `).all(userId);
    res.json(rows);
});

app.post('/api/posts', upload.single('image'), async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'unauthorized' });
    const { title, description, storyType } = req.body || {};
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
    if (!imagePath) return res.status(400).json({ error: 'image is required' });

    const effectiveStoryType = (storyType && storyType.trim()) || 'The story should be leaned towards indian culture';

    // Generate story and audio using Python script
    try {
        const pythonScript = path.join(__dirname, 'generate_story_final.py');
        const imageFullPath = path.join(__dirname, 'uploads', req.file.filename);
        const outputDir = path.join(__dirname, 'uploads');
        
        console.log('Image file path:', imageFullPath);

        const python = spawn(getPythonCommand(), [
            pythonScript,
            imageFullPath,
            description || 'A crafted piece',
            effectiveStoryType,
            outputDir
        ], {
            timeout: 60000 // 60 second timeout
        });

        let output = '';
        let error = '';

        python.stdout.on('data', (data) => {
            output += data.toString();
        });

        python.stderr.on('data', (data) => {
            error += data.toString();
        });

        python.on('close', (code) => {
            console.log(`Python script exited with code: ${code}`);
            console.log(`Python output: ${output}`);
            console.log(`Python error: ${error}`);
            console.log(`Raw output length: ${output.length}`);
            
            if (code === 0) {
                try {
                    const result = JSON.parse(output);
                    console.log('Parsed result:', result);
                    
                    if (result.success) {
                        const audioPath = result.audio_path ? `/uploads/${path.basename(result.audio_path)}` : null;
                        // Store only the generated story, not user inputs
                        const stmt = db.prepare(`INSERT INTO posts (user_id, story, image_path, audio_path) VALUES (?, ?, ?, ?)`);
                        const info = stmt.run(req.user.id, result.story, imagePath, audioPath);
                        console.log('Post created successfully with ID:', info.lastInsertRowid);
                        res.json({ id: info.lastInsertRowid, image_path: imagePath, audio_path: audioPath });
                    } else {
                        console.error('Python script error:', result.error);
                        // Fallback to enhanced story
                        const generatedStory = createFallbackStory(description, effectiveStoryType);
                        const stmt = db.prepare(`INSERT INTO posts (user_id, story, image_path, audio_path) VALUES (?, ?, ?, ?)`);
                        const info = stmt.run(req.user.id, generatedStory, imagePath, null);
                        res.json({ id: info.lastInsertRowid, image_path: imagePath });
                    }
                } catch (parseError) {
                    console.error('Failed to parse Python output:', parseError);
                    console.error('Raw output was:', output);
                    console.error('Output type:', typeof output);
                    console.error('Is output empty?', output.trim() === '');
                    // Fallback to enhanced story
                    const generatedStory = createFallbackStory(description, effectiveStoryType);
                    const stmt = db.prepare(`INSERT INTO posts (user_id, story, image_path, audio_path) VALUES (?, ?, ?, ?)`);
                    const info = stmt.run(req.user.id, generatedStory, imagePath, null);
                    res.json({ id: info.lastInsertRowid, image_path: imagePath });
                }
            } else {
                console.error('Python script failed with code:', code);
                console.error('Error output:', error);
                // Fallback to enhanced story
                const generatedStory = createFallbackStory(description, effectiveStoryType);
                const stmt = db.prepare(`INSERT INTO posts (user_id, story, image_path, audio_path) VALUES (?, ?, ?, ?)`);
                const info = stmt.run(req.user.id, generatedStory, imagePath, null);
                res.json({ id: info.lastInsertRowid, image_path: imagePath });
            }
        });

    } catch (error) {
        console.error('Error running Python script:', error);
        // Fallback to enhanced story
        const generatedStory = createFallbackStory(description, effectiveStoryType);
        const stmt = db.prepare(`INSERT INTO posts (user_id, story, image_path, audio_path) VALUES (?, ?, ?, ?)`);
        const info = stmt.run(req.user.id, generatedStory, imagePath, null);
        res.json({ id: info.lastInsertRowid, image_path: imagePath });
    }
});

// Serve static assets from project root (HTML files are in root)
app.use(express.static(__dirname));
// Serve uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));

// Explicit routes for pages
app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/create-canvas', (_req, res) => {
    res.sendFile(path.join(__dirname, 'create-canvas.html'));
});
app.get('/profile', (_req, res) => {
    res.sendFile(path.join(__dirname, 'profile.html'));
});
app.get('/create-assistant', (_req, res) => {
    res.sendFile(path.join(__dirname, 'create-assistant.html'));
});
app.get('/story', (_req, res) => {
    res.sendFile(path.join(__dirname, 'story.html'));
});
app.get('/signup', (_req, res) => {
    res.sendFile(path.join(__dirname, 'signup.html'));
});
app.get('/login', (_req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});
app.get('/test-auth', (_req, res) => {
    res.sendFile(path.join(__dirname, 'test-auth.html'));
});
app.get('/simple-test', (_req, res) => {
    res.sendFile(path.join(__dirname, 'simple-test.html'));
});
app.get('/test-page', (_req, res) => {
    res.sendFile(path.join(__dirname, 'test-page.html'));
});

// --- Auth helpers ---
function createToken(payload) {
    return jwt.sign(payload, jwtSecret, { expiresIn: '7d' });
}

// --- Database init (ensure tables) ---
const db = getDb();
db.exec(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT
);`);

// Function to safely add column if it doesn't exist
function addColumnIfNotExists(tableName, columnName, columnType) {
    try {
        // Check if column exists by trying to select it
        db.prepare(`SELECT ${columnName} FROM ${tableName} LIMIT 1`).get();
    } catch (e) {
        // Column doesn't exist, add it
        try {
            db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType};`);
            console.log(`Added column ${columnName} to ${tableName}`);
        } catch (addError) {
            console.error(`Failed to add column ${columnName}:`, addError.message);
        }
    }
}

// Add new columns if they don't exist
addColumnIfNotExists('users', 'profile_image', 'TEXT');
addColumnIfNotExists('users', 'banner_image', 'TEXT');
addColumnIfNotExists('users', 'bio', 'TEXT');
db.exec(`CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT,
  description TEXT,
  story TEXT,
  image_path TEXT,
  audio_path TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id)
);`);
db.exec(`CREATE TABLE IF NOT EXISTS likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  post_id INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(post_id) REFERENCES posts(id),
  UNIQUE(user_id, post_id)
);`);
db.exec(`CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  post_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(post_id) REFERENCES posts(id)
);`);
db.exec(`CREATE TABLE IF NOT EXISTS follows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  follower_id INTEGER NOT NULL,
  following_id INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(follower_id) REFERENCES users(id),
  FOREIGN KEY(following_id) REFERENCES users(id),
  UNIQUE(follower_id, following_id)
);`);

// --- Auth API ---
app.post('/api/signup', async (req, res) => {
    try {
        const { email, password, name } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ error: 'email and password are required' });
        }
        const passwordHash = await bcrypt.hash(password, 10);
        const stmt = db.prepare('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)');
        const info = stmt.run(email, passwordHash, name || null);
        const user = { id: info.lastInsertRowid, email, name: name || null };
        const token = createToken({ id: user.id, email: user.email });
        res.cookie('token', token, { httpOnly: false, sameSite: 'lax', secure: false, maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' });
        res.json({ user });
    } catch (err) {
        if (String(err).includes('UNIQUE')) {
            return res.status(409).json({ error: 'email already registered' });
        }
        res.status(500).json({ error: 'internal error' });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
        return res.status(400).json({ error: 'email and password are required' });
    }
    const row = db.prepare('SELECT id, email, password_hash, name FROM users WHERE email = ?').get(email);
    if (!row) return res.status(401).json({ error: 'invalid credentials' });
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });
    const token = createToken({ id: row.id, email: row.email });
    res.cookie('token', token, { httpOnly: false, sameSite: 'lax', secure: false, maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' });
    res.json({ user: { id: row.id, email: row.email, name: row.name } });
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
    if (!req.user) return res.status(401).json({ user: null });

    // Try with new columns first, fall back to basic columns if they don't exist
    try {
        const row = db.prepare('SELECT id, email, name, profile_image, banner_image, bio FROM users WHERE id = ?').get(req.user.id);
        if (!row) return res.status(401).json({ user: null });
        res.json({ user: row });
    } catch (e) {
        // Fall back to basic columns
        const row = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(req.user.id);
        if (!row) return res.status(401).json({ user: null });
        res.json({ user: { ...row, profile_image: null, banner_image: null, bio: null } });
    }
});

// Update current user profile
app.post('/api/me', upload.fields([{ name: 'profileImage', maxCount: 1 }, { name: 'bannerImage', maxCount: 1 }]), (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'unauthorized' });
    const { name, bio } = req.body || {};

    let profileImagePath = null;
    let bannerImagePath = null;

    if (req.files?.profileImage?.[0]) {
        profileImagePath = `/uploads/${req.files.profileImage[0].filename}`;
    }
    if (req.files?.bannerImage?.[0]) {
        bannerImagePath = `/uploads/${req.files.bannerImage[0].filename}`;
    }

    // Build dynamic update query
    const updates = [];
    const values = [];

    if (name !== undefined) {
        updates.push('name = ?');
        values.push(name || null);
    }
    if (bio !== undefined) {
        updates.push('bio = ?');
        values.push(bio || null);
    }
    if (profileImagePath) {
        updates.push('profile_image = ?');
        values.push(profileImagePath);
    }
    if (bannerImagePath) {
        updates.push('banner_image = ?');
        values.push(bannerImagePath);
    }

    if (updates.length > 0) {
        values.push(req.user.id);
        db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    try {
        const row = db.prepare('SELECT id, email, name, profile_image, banner_image, bio FROM users WHERE id = ?').get(req.user.id);
        res.json({ user: row });
    } catch (e) {
        // Fall back to basic columns
        const row = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(req.user.id);
        res.json({ user: { ...row, profile_image: null, banner_image: null, bio: null } });
    }
});

// Like/unlike a post
app.post('/api/posts/:id/like', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'unauthorized' });
    const postId = Number(req.params.id);

    try {
        // Check if already liked
        const existing = db.prepare('SELECT id FROM likes WHERE user_id = ? AND post_id = ?').get(req.user.id, postId);

        if (existing) {
            // Unlike
            db.prepare('DELETE FROM likes WHERE user_id = ? AND post_id = ?').run(req.user.id, postId);
            const count = db.prepare('SELECT COUNT(*) as count FROM likes WHERE post_id = ?').get(postId);
            res.json({ liked: false, count: count.count });
        } else {
            // Like
            db.prepare('INSERT INTO likes (user_id, post_id) VALUES (?, ?)').run(req.user.id, postId);
            const count = db.prepare('SELECT COUNT(*) as count FROM likes WHERE post_id = ?').get(postId);
            res.json({ liked: true, count: count.count });
        }
    } catch (error) {
        res.status(500).json({ error: 'internal error' });
    }
});

// Get likes for a post
app.get('/api/posts/:id/likes', (req, res) => {
    const postId = Number(req.params.id);
    const count = db.prepare('SELECT COUNT(*) as count FROM likes WHERE post_id = ?').get(postId);
    const liked = req.user ? db.prepare('SELECT id FROM likes WHERE user_id = ? AND post_id = ?').get(req.user.id, postId) : null;
    res.json({ count: count.count, liked: !!liked });
});

// Add comment to a post
app.post('/api/posts/:id/comments', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'unauthorized' });
    const postId = Number(req.params.id);
    const { content } = req.body || {};

    if (!content || !content.trim()) {
        return res.status(400).json({ error: 'comment content is required' });
    }

    const stmt = db.prepare('INSERT INTO comments (user_id, post_id, content) VALUES (?, ?, ?)');
    const info = stmt.run(req.user.id, postId, content.trim());

    const comment = db.prepare(`
        SELECT c.id, c.content, c.created_at, 
               u.id as user_id, COALESCE(u.name, u.email) as user_name
        FROM comments c 
        JOIN users u ON u.id = c.user_id 
        WHERE c.id = ?
    `).get(info.lastInsertRowid);

    res.json(comment);
});

// Get comments for a post
app.get('/api/posts/:id/comments', (req, res) => {
    const postId = Number(req.params.id);
    const comments = db.prepare(`
        SELECT c.id, c.content, c.created_at,
               u.id as user_id, COALESCE(u.name, u.email) as user_name
        FROM comments c 
        JOIN users u ON u.id = c.user_id 
        WHERE c.post_id = ? 
        ORDER BY c.created_at ASC
    `).all(postId);
    res.json(comments);
});

// Delete a post
app.delete('/api/posts/:id', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'unauthorized' });
    
    const postId = Number(req.params.id);
    
    // Check if user owns the post
    const post = db.prepare('SELECT user_id, image_path, audio_path FROM posts WHERE id = ?').get(postId);
    if (!post) {
        return res.status(404).json({ error: 'Post not found' });
    }
    
    if (post.user_id !== req.user.id) {
        return res.status(403).json({ error: 'You can only delete your own posts' });
    }
    
    try {
        // Delete associated files
        if (post.image_path) {
            const imagePath = path.join(__dirname, post.image_path);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }
        if (post.audio_path) {
            const audioPath = path.join(__dirname, post.audio_path);
            if (fs.existsSync(audioPath)) {
                fs.unlinkSync(audioPath);
            }
        }
        
        // Delete from database (this will cascade to likes and comments due to foreign keys)
        db.prepare('DELETE FROM comments WHERE post_id = ?').run(postId);
        db.prepare('DELETE FROM likes WHERE post_id = ?').run(postId);
        db.prepare('DELETE FROM posts WHERE id = ?').run(postId);
        
        res.json({ success: true, message: 'Post deleted successfully' });
    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).json({ error: 'Failed to delete post' });
    }
});

// Follow/unfollow a user
app.post('/api/users/:id/follow', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'unauthorized' });
    
    const targetUserId = Number(req.params.id);
    const currentUserId = req.user.id;
    
    if (targetUserId === currentUserId) {
        return res.status(400).json({ error: 'You cannot follow yourself' });
    }
    
    try {
        // Check if already following
        const existing = db.prepare('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?').get(currentUserId, targetUserId);
        
        if (existing) {
            // Unfollow
            db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').run(currentUserId, targetUserId);
            const followerCount = db.prepare('SELECT COUNT(*) as count FROM follows WHERE following_id = ?').get(targetUserId);
            res.json({ following: false, followerCount: followerCount.count });
        } else {
            // Follow
            db.prepare('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)').run(currentUserId, targetUserId);
            const followerCount = db.prepare('SELECT COUNT(*) as count FROM follows WHERE following_id = ?').get(targetUserId);
            res.json({ following: true, followerCount: followerCount.count });
        }
    } catch (error) {
        console.error('Error toggling follow:', error);
        res.status(500).json({ error: 'Failed to toggle follow' });
    }
});

// Get user profile by ID
app.get('/api/users/:id', (req, res) => {
    const userId = Number(req.params.id);
    const user = db.prepare('SELECT id, name, email, bio, profile_image, banner_image FROM users WHERE id = ?').get(userId);
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
});

// Get follow status and counts for a user
app.get('/api/users/:id/follow-status', (req, res) => {
    const targetUserId = Number(req.params.id);
    
    const followerCount = db.prepare('SELECT COUNT(*) as count FROM follows WHERE following_id = ?').get(targetUserId);
    const followingCount = db.prepare('SELECT COUNT(*) as count FROM follows WHERE follower_id = ?').get(targetUserId);
    
    let isFollowing = false;
    if (req.user) {
        const followRecord = db.prepare('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?').get(req.user.id, targetUserId);
        isFollowing = !!followRecord;
    }
    
    res.json({
        followerCount: followerCount.count,
        followingCount: followingCount.count,
        isFollowing: isFollowing
    });
});

// Temporarily disabled catch-all route for debugging
// app.get('*', (req, res) => {
//     if (req.accepts('html')) {
//         res.sendFile(path.join(__dirname, 'index.html'));
//     } else {
//         res.status(404).json({ error: 'Not found' });
//     }
// });

app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
}); 