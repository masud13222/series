# 🎬 CinemazBD LinkStore

A beautiful and secure file management system for Google Drive, built with Node.js and MongoDB.

![CinemazBD LinkStore](https://i.ibb.co/placeholder-image.png)

## ✨ Features

- 🔐 **Secure Authentication**
  - Password protected access
  - Session management
  - Secure cookie handling

- 📁 **Smart Folder Management**
  - Scan Google Drive folders
  - Auto-detect Season & Episode numbers
  - Quality badge detection (360p to 4K)
  - File size calculation

- 🎯 **Advanced File Handling**
  - Direct download links
  - FilePress integration
  - Smart file sorting
  - File type detection

- 🎨 **Beautiful Dark Theme**
  - Modern gradient buttons
  - Smooth animations
  - Responsive design
  - Clean and intuitive UI

- 🔍 **Smart Features**
  - Real-time search
  - Pagination
  - File type icons
  - Size formatting

## 🚀 Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript
- **Backend**: Node.js, Express.js
- **Database**: MongoDB
- **Authentication**: Express Session
- **APIs**: Google Drive API, FilePress API
- **Deployment**: Vercel

## 📦 Installation

env
MONGODB_URI=your_mongodb_uri
SESSION_SECRET=your_session_secret
CLIENT_ID=google_client_id
CLIENT_SECRET=google_client_secret
REFRESH_TOKEN=google_refresh_token
DEFAULT_PASSWORD=admin_password
WORKER_URL=your_worker_url
FILEPRESS_API_KEY=filepress_api_key



## 🔒 Security Features

- Password protected access
- Session management
- Secure cookie handling
- MongoDB connection encryption
- XSS protection
- CSRF protection
- Rate limiting
- Input validation

## 🎯 API Endpoints

- `GET /` - Home page
- `POST /login` - Authentication
- `GET /check-login` - Session check
- `POST /scan` - Scan folders
- `GET /folders` - List folders
- `DELETE /folder/:id` - Delete folder
- `GET /:uniqueId` - Share page
- `POST /api/filepress/convert` - FilePress conversion

## 📱 Responsive Design

- Mobile-first approach
- Tablet optimization
- Desktop enhancement
- Touch-friendly interface

## 🛠 Development
Deploy to Vercel
vercel

## 🔑 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**CinemazBD Team**
- Website: [https://cinemazbd.shop](https://cinemazbd.shop)

## 🙏 Acknowledgments

- Google Drive API
- FilePress API
- MongoDB Atlas
- Vercel Platform

---

<p align="center">Made with ❤️ by CinemazBD Team</p>


