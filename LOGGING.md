# Logging System with Automatic Rotation

This document describes the improved logging system with automatic file rotation to prevent infinitely growing log files.

## 🔄 Features

### Automatic Rotation
- **Maximum size**: 10MB per log file
- **Automatic rotation**: Creates a new file when the limit is reached
- **Archiving**: Old files are renamed with a timestamp
- **Cleanup**: Automatic deletion of old files (max 5 backup files)

### Log Deduplication
- **Deduplication window**: 60 seconds
- **Occurrence counter**: Displays the number of repetitions
- **Metadata**: Preservation of contextual data

## 📁 File Structure

```
logs/
├── combined.log          # Current info/warn logs
├── error.log            # Current error/debug logs
└── archive/             # Archived files
    ├── combined-2025-07-28T14-33-41-306Z.log
    ├── error-2025-07-28T15-20-15-123Z.log
    └── ...
```

## ⚙️ Configuration

### Environment Variables
```bash
# Maximum log file size (in bytes)
LOG_MAX_SIZE=10485760  # 10MB default

# Maximum number of backup files
LOG_MAX_FILES=5

# Rotation check interval (in ms)
LOG_ROTATION_CHECK_INTERVAL=300000  # 5 minutes
```

### Code Configuration
```typescript
const logRotator = new LogRotator({
  maxSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
  compress: false
});
```

## 🛠️ Usage

### Standard Logging
```typescript
import { logDeduplicator } from '../utils/logDeduplicator';

// Asynchronous logs (new system)
await logDeduplicator.info('User logged in', { userId: 123 });
await logDeduplicator.error('Database connection failed', { error: 'timeout' });
await logDeduplicator.warn('High memory usage', { usage: '85%' });
await logDeduplicator.debug('Cache hit', { key: 'user:123' });
```

### Performance Measurement
```typescript
import { measureExecutionTime } from '../utils/logger';

const result = await measureExecutionTime(
  () => databaseQuery(),
  'Database Query'
);
```

## 📊 Log Management

### Maintenance Scripts

#### View Statistics
```bash
npm run log-stats
```

**Example output:**
```
📊 Log Statistics:
==================
📄 combined.log: 0.05 MB
📄 error.log: 0.47 MB
📊 Total current logs: 0.52 MB
📦 combined-2025-07-28T14-33-41-306Z.log: 36.05 MB (2.5 days old)
📦 error-2025-07-28T15-20-15-123Z.log: 0.23 MB (1.2 days old)
📊 Total archives: 36.28 MB
```

#### Clean Logs
```bash
npm run cleanup-logs
```

**Actions performed:**
- Archive files larger than 1MB
- Delete archives older than 30 days
- Create archive directory if necessary

### Automatic Rotation

#### Triggers
1. **File size**: Rotation when file reaches 10MB
2. **Periodic check**: Every 5 minutes
3. **Before each log**: Check before writing

#### Rotation Process
1. **Close** current stream
2. **Rename** file with timestamp
3. **Create** new empty file
4. **Cleanup** old files if necessary

## 🔧 Maintenance

### Automatic Cleanup
The system automatically deletes:
- Backup files beyond 5 files
- Archives older than 30 days

### Manual Cleanup
```bash
# Check current status
npm run log-stats

# Clean and archive
npm run cleanup-logs

# Manually delete specific files
rm logs/archive/combined-2025-01-01T00-00-00-000Z.log
```

## 📈 Monitoring

### Important Metrics
- **Current file sizes**: Should remain < 10MB
- **Number of rotations**: Activity indicator
- **Archive size**: Disk space used
- **Archive age**: Storage rotation

### Recommended Alerts
- Log file > 8MB (80% of limit)
- More than 10 archive files
- Disk space < 1GB in logs folder

## 🚨 Troubleshooting

### Common Issues

#### Log File Too Large
```bash
# Check size
ls -lh logs/combined.log

# Force rotation
npm run cleanup-logs
```

#### Permission Error
```bash
# Check permissions
ls -la logs/

# Fix permissions
chmod 755 logs/
chmod 644 logs/*.log
```

#### Insufficient Disk Space
```bash
# Check space
df -h logs/

# Clean old archives
npm run cleanup-logs
```

### Debug Logs
The rotation system generates its own logs:
```
Log file rotated: logs/combined.log -> logs/combined-2025-07-28T14-33-41-306Z.log
Deleted old log file: combined-2025-06-01T00-00-00-000Z.log
```

## 🔄 Migration

### Old System → New System
1. **Synchronous logs** → **Asynchronous logs**
2. **Single files** → **Automatic rotation**
3. **No limit** → **10MB limit**

### Legacy Code
```typescript
// ❌ Old (synchronous)
logDeduplicator.info('Message');

// ✅ New (asynchronous)
await logDeduplicator.info('Message');
```

## 📋 Deployment Checklist

- [ ] Check `logs/` folder permissions
- [ ] Configure environment variables
- [ ] Test rotation with large files
- [ ] Configure monitoring alerts
- [ ] Document maintenance procedures
- [ ] Train team on new scripts

## 🔗 Useful Links

- [Pino Documentation](https://getpino.io/)
- [Node.js File Management](https://nodejs.org/api/fs.html)
- [Maintenance Scripts](./scripts/cleanup-logs.ts) 