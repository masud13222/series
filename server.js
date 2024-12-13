require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const mongoose = require('mongoose');
const path = require('path');
const crypto = require('crypto');
const session = require('express-session');
const fs = require('fs');
const fetch = require('node-fetch');
const MongoStore = require('connect-mongo');

const app = express();
app.use(express.json());
app.use(express.static('public'));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        ttl: 24 * 60 * 60, // 1 day
        autoRemove: 'native',
        touchAfter: 24 * 3600 // time period in seconds
    }),
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000, // 1 day
        httpOnly: true,
        sameSite: 'lax'
    }
}));

// MongoDB connection with retry logic
const connectWithRetry = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            retryWrites: true,
            w: 'majority'
        });
        console.log('Connected to MongoDB');
    } catch (err) {
        console.error('MongoDB connection error:', err);
        console.log('Retrying in 5 seconds...');
        setTimeout(connectWithRetry, 5000);
    }
};

connectWithRetry();

// Add this to check connection status
mongoose.connection.on('connected', () => {
    console.log('Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
    console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('Mongoose disconnected');
});

// Folder Schema
const FolderSchema = new mongoose.Schema({
    uniqueId: { type: String, unique: true },
    folderName: String,
    folderId: String,
    files: [{
        fileId: String,
        name: String,
        size: Number
    }],
    createdAt: { type: Date, default: Date.now }
});

const Folder = mongoose.model('Folder', FolderSchema);

// Google Drive Authentication
const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    'http://localhost:3000'
);

oauth2Client.setCredentials({
    refresh_token: process.env.REFRESH_TOKEN
});

const drive = google.drive({ version: 'v3', auth: oauth2Client });

app.get('/', (req, res) => {
    if (!req.session.isLoggedIn) {
        return res.sendFile(path.join(__dirname, 'login.html'));
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/login', (req, res) => {
    const { password } = req.body;
    if (password === process.env.DEFAULT_PASSWORD) {
        req.session.isLoggedIn = true;
        res.json({ success: true });
    } else {
        res.json({ success: false, message: 'Invalid password!' });
    }
});

const requireLogin = (req, res, next) => {
    if (!req.session.isLoggedIn) {
        return res.status(401).json({ 
            success: false, 
            message: 'Please login first',
            redirect: true
        });
    }
    next();
};

// Add this function to extract folder ID from various Google Drive URLs
function extractFolderId(input) {
    // If already a folder ID (no slashes or spaces)
    if (/^[a-zA-Z0-9_-]+$/.test(input)) {
        return input;
    }

    try {
        // Try to create URL object
        const url = new URL(input);
        
        // Handle different URL patterns
        if (url.hostname === 'drive.google.com') {
            // Pattern 1: /drive/folders/{id}
            const foldersMatch = url.pathname.match(/\/folders\/([a-zA-Z0-9_-]+)/);
            if (foldersMatch) return foldersMatch[1];

            // Pattern 2: /drive/u/0/folders/{id} or /drive/u/folders/{id}
            const uFoldersMatch = url.pathname.match(/\/drive\/u\/\d*\/folders\/([a-zA-Z0-9_-]+)/);
            if (uFoldersMatch) return uFoldersMatch[1];

            // Pattern 3: /open?id={id}
            const urlParams = new URLSearchParams(url.search);
            const id = urlParams.get('id');
            if (id) return id;
        }
    } catch (error) {
        console.error('Error parsing URL:', error);
    }

    // If no patterns match, return the original input
    // (in case it's already a folder ID)
    return input;
}

// Update scan route
app.post('/scan', requireLogin, async (req, res) => {
    try {
        const { folderName, folderId: rawFolderId } = req.body;
        
        // Extract folder ID from URL if needed
        const folderId = extractFolderId(rawFolderId);
        console.log('Attempting to scan folder:', {
            rawUrl: rawFolderId,
            extractedId: folderId,
            folderName: folderName
        });

        if (!folderId) {
            throw new Error('Invalid folder ID or URL');
        }

        const uniqueId = crypto.randomBytes(3).toString('hex');

        // Get all files with pagination
        let allFiles = [];
        let pageToken = null;

        try {
            do {
                console.log('Fetching files with pageToken:', pageToken);
                const response = await drive.files.list({
                    q: `'${folderId}' in parents`,
                    fields: 'nextPageToken, files(id, name, size)',
                    pageSize: 1000,
                    maxResults: 1000,
                    orderBy: 'name',
                    pageToken: pageToken,
                    supportsAllDrives: true,
                    includeItemsFromAllDrives: true,
                    corpora: 'allDrives',
                    spaces: 'drive'
                });

                if (response.data.files) {
                    allFiles = allFiles.concat(response.data.files);
                    console.log(`Found ${response.data.files.length} files in this page`);
                } else {
                    console.log('No files found in this page');
                }

                pageToken = response.data.nextPageToken;
                console.log('Next page token:', pageToken);
                
            } while (pageToken);

        } catch (driveError) {
            console.error('Google Drive API Error:', {
                message: driveError.message,
                code: driveError.code,
                errors: driveError.errors
            });
            throw new Error(`Drive API Error: ${driveError.message}`);
        }

        console.log(`Total files found: ${allFiles.length}`);

        if (allFiles.length === 0) {
            throw new Error('No files found in the folder');
        }

        // Save to MongoDB
        const folder = await Folder.create({
            uniqueId,
            folderName,
            folderId,
            files: allFiles.map(file => ({
                fileId: file.id,
                name: file.name,
                size: file.size || 0
            }))
        });

        console.log('Successfully saved folder:', {
            uniqueId: folder.uniqueId,
            fileCount: folder.files.length
        });

        res.json({ success: true, folder });
    } catch (error) {
        console.error('Error scanning folder:', {
            error: error.message,
            stack: error.stack
        });
        res.json({ 
            success: false, 
            message: 'Error occurred while scanning files',
            details: error.message,
            errorType: error.name
        });
    }
});

app.get('/folders', requireLogin, async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ 
                error: 'Database connection not ready',
                details: 'Please try again in a few moments'
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const folders = await Folder.find()
            .sort('-createdAt')
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await Folder.countDocuments();

        if (!folders || folders.length === 0) {
            return res.json({
                folders: [],
                total: 0,
                page,
                pages: 0
            });
        }

        const foldersWithCount = folders.map(folder => ({
            ...folder,
            fileCount: folder.files ? folder.files.length : 0
        }));

        res.json({
            folders: foldersWithCount,
            total,
            page,
            pages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Error in /folders route:', error);
        res.status(500).json({ 
            error: 'Error fetching folders',
            details: error.message 
        });
    }
});

app.get('/api/folder/:uniqueId', async (req, res) => {
    try {
        console.log('Fetching folder:', req.params.uniqueId);
        const folder = await Folder.findOne({ uniqueId: req.params.uniqueId });
        
        if (!folder) {
            console.log('Folder not found');
            return res.status(404).json({ error: 'Folder not found' });
        }

        console.log('Found folder:', folder.folderName, 'with', folder.files.length, 'files');
        res.json(folder);
    } catch (error) {
        console.error('Error fetching folder:', error);
        res.status(500).json({ error: 'Error fetching folder', details: error.message });
    }
});

app.get('/config', (req, res) => {
    console.log('Sending worker URL:', process.env.WORKER_URL);
    res.json({
        workerUrl: process.env.WORKER_URL
    });
});

app.get('/:uniqueId', async (req, res) => {
    try {
        const folder = await Folder.findOne({ uniqueId: req.params.uniqueId });
        if (!folder) {
            return res.status(404).send('Folder not found');
        }
        res.sendFile(path.join(__dirname, 'shared.html'));
    } catch (error) {
        res.status(500).send('Error loading page');
    }
});

// Login check route
app.get('/check-login', (req, res) => {
    try {
        res.json({ 
            isLoggedIn: !!req.session.isLoggedIn,
            timestamp: Date.now()
        });
    } catch (error) {
        res.status(500).json({ 
            isLoggedIn: false,
            error: 'Server error'
        });
    }
});

// Logout route (প্রয়োজনে)
app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ 
                success: false, 
                message: 'Error logging out' 
            });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true });
    });
});

app.delete('/folder/:uniqueId', requireLogin, async (req, res) => {
    try {
        const result = await Folder.findOneAndDelete({ uniqueId: req.params.uniqueId });
        if (result) {
            res.json({ success: true });
        } else {
            res.json({ success: false, message: 'Folder not found' });
        }
    } catch (error) {
        res.json({ success: false, message: 'Error deleting folder' });
    }
});

// Add proxy route for FilePress API
app.post('/api/filepress/convert', async (req, res) => {
    try {
        const { id } = req.body;
        
        const response = await fetch('https://new3.filepress.top/api/v1/file/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                key: process.env.FILEPRESS_API_KEY,
                id: id,
                quality: 1080
            })
        });

        const data = await response.json();
        res.json(data);
        
    } catch (error) {
        console.error('FilePress API Error:', error);
        res.status(500).json({ error: 'Failed to convert link' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 
