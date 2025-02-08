import multer from 'multer';
import path from 'path';
import crypto from 'crypto';

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (_req, file, callback) => {
    const hash = crypto.randomBytes(6).toString('hex');
    const fileName = `${hash}-${file.originalname}`;
    callback(null, fileName);
  },
});

export const upload = multer({
  storage,
  fileFilter: (_req, file, callback) => {
    const allowedMimes = [
      'image/jpeg',
      'image/pjpeg',
      'image/png',
      'image/gif',
    ];

    if (allowedMimes.includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new Error('Invalid file type.'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});