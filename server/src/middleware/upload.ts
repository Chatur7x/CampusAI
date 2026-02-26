import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadDir = process.env.UPLOAD_PATH || './uploads';

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let subDir = 'general';
    
    if (file.fieldname === 'avatar') subDir = 'avatars';
    else if (file.fieldname === 'faceData') subDir = 'faces';
    else if (file.fieldname === 'documents') subDir = 'documents';
    else if (file.fieldname === 'csv') subDir = 'csv';
    
    const fullPath = path.join(uploadDir, subDir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
    
    cb(null, fullPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes: { [key: string]: string[] } = {
    avatar: ['image/jpeg', 'image/png', 'image/gif'],
    faceData: ['image/jpeg', 'image/png'],
    documents: ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    csv: ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  };

  const allowed = allowedTypes[file.fieldname] || ['image/jpeg', 'image/png'];
  
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed types: ${allowed.join(', ')}`));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
  },
});

// Error handler for multer
export const handleUploadError = (err: any, req: any, res: any, next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 10MB.',
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  
  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  
  next();
};