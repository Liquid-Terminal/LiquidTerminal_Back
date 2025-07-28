# Hyperinsight Backend

A high-performance backend API for the Hyperinsight platform, built with Node.js, TypeScript, and Express.

## 🚀 Features

- **Authentication**: JWT-based authentication with Privy
- **Database**: PostgreSQL with Prisma ORM
- **Caching**: Redis for performance optimization
- **File Uploads**: Secure file handling with validation
- **Logging**: Advanced logging system with automatic rotation
- **Security**: Comprehensive security measures and rate limiting
- **API**: RESTful API with comprehensive documentation

## 📋 Prerequisites

- Node.js >= 18.0.0
- PostgreSQL
- Redis
- TypeScript

## 🛠️ Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables (see `ENVIRONMENT.md`)
4. Run database migrations: `npm run prisma:migrate`
5. Start the development server: `npm run dev`

## 📚 Documentation

- [Environment Setup](ENVIRONMENT.md)
- [Security](SECURITY.md)
- [Logging System](LOGGING.md)
- [Upload Guide](UPLOAD_GUIDE.md)
- [Client Architecture](CLIENT_ARCHITECTURE.md)

## 🔧 Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run test` - Run tests
- `npm run cleanup-logs` - Clean up log files
- `npm run log-stats` - View log statistics
