import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const uploadDir = path.resolve(process.env.UPLOAD_PATH || './uploads');

// Ensure upload directory exists
fs.mkdirSync(uploadDir, { recursive: true });

// Upload targets. `extensions` is the authoritative allowlist: the stored filename
// always gets one of these extensions, never the client-supplied one, so an
// uploaded .html/.svg/.js can never be written to disk with an executable
// extension. `magic` is the byte signature we sniff to confirm the payload is
// really the claimed type (empty = no signature check, text formats).
interface UploadRule {
  subDir: string;
  mimes: string[];
  extensions: string[];
  magic: { mime: string; bytes: number[] }[];
}

const RULES: Record<string, UploadRule> = {
  avatar: {
    subDir: 'avatars',
    mimes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    extensions: ['.jpg', '.png', '.gif', '.webp'],
    magic: [
      { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
      { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
      { mime: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] },
    ],
  },
  faceData: {
    subDir: 'faces',
    mimes: ['image/jpeg', 'image/png', 'image/webp'],
    extensions: ['.jpg', '.png', '.webp'],
    magic: [
      { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
      { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
    ],
  },
  documents: {
    subDir: 'documents',
    mimes: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    extensions: ['.pdf', '.jpg', '.png', '.doc', '.docx'],
    magic: [
      { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
      { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
      { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
    ],
  },
  csv: {
    subDir: 'csv',
    mimes: [
      'text/csv',
      'application/csv',
      'text/plain',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/octet-stream',
    ],
    extensions: ['.csv'],
    magic: [],
  },
};

const ruleFor = (fieldname: string): UploadRule => RULES[fieldname];

// Reads the first bytes of the temp file and checks them against the rule's
// signatures. Called from the fileFilter, before the file is fully received
// only the header is present, so multer's disk write is what makes this
// possible — we sniff the partially written file at the end of the stream.
const sniffFile = (filePath: string, rule: UploadRule): Promise<boolean> =>
  new Promise((resolve) => {
    if (rule.magic.length === 0) return resolve(true);
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(8);
    fs.readSync(fd, buf, 0, 8, 0);
    fs.closeSync(fd);
    const ok = rule.magic.some(({ bytes }) => bytes.every((b, i) => buf[i] === b));
    resolve(ok);
  });

// Rejects files whose bytes look like markup or a script even though the
// extension check would have allowed them (defence in depth for polyglots).
const containsMarkup = (filePath: string): Promise<boolean> =>
  new Promise((resolve) => {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(1024);
    const read = fs.readSync(fd, buf, 0, 1024, 0);
    fs.closeSync(fd);
    const head = buf.subarray(0, read).toString('utf8').toLowerCase();
    resolve(/<\s*(script|html|svg|iframe|object|embed)\b/.test(head));
  });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const rule = ruleFor(file.fieldname);
    if (!rule) return cb(new Error('Unsupported upload field'), '');

    const fullPath = path.join(uploadDir, rule.subDir);
    fs.mkdirSync(fullPath, { recursive: true });
    cb(null, fullPath);
  },
  filename: (req, file, cb) => {
    const rule = ruleFor(file.fieldname);
    if (!rule) return cb(new Error('Unsupported upload field'), '');

    // Never reuse the client filename. Random id + allowlisted extension.
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = rule.extensions.includes(ext) ? ext : rule.extensions[0];
    cb(null, `${rule.subDir}-${crypto.randomBytes(16).toString('hex')}${safeExt}`);
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const rule = ruleFor(file.fieldname);
  if (!rule) {
    return cb(new Error('Unsupported upload field'));
  }

  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!rule.extensions.includes(ext)) {
    return cb(new Error(`Invalid file extension. Allowed: ${rule.extensions.join(', ')}`));
  }

  if (!rule.mimes.includes(file.mimetype)) {
    return cb(new Error(`Invalid file type. Allowed: ${rule.mimes.join(', ')}`));
  }

  cb(null, true);
};

const maxFileSize = parseInt(process.env.MAX_FILE_SIZE || '10485760', 10);

export const upload = multer({ storage, fileFilter, limits: { fileSize: maxFileSize, files: 1 } });

/**
 * Post-upload verification. Call after multer has written the file:
 *   router.post('/x', authenticate, upload.single('avatar'), verifyUpload, handler)
 * Confirms the on-disk bytes match the claimed type and contain no markup,
 * deleting the temp file and returning 400 otherwise.
 */
export const verifyUpload = (req: any, res: any, next: any) => {
  const file: Express.Multer.File | undefined = req.file;
  if (!file) return next();

  const rule = ruleFor(file.fieldname);
  if (!rule) {
    fs.unlink(file.path, () => {});
    return res.status(400).json({ success: false, message: 'Unsupported upload field' });
  }

  // Path must stay inside the upload root even if UPLOAD_PATH was tampered with.
  if (!path.resolve(file.path).startsWith(uploadDir + path.sep)) {
    fs.unlink(file.path, () => {});
    return res.status(400).json({ success: false, message: 'Invalid upload path' });
  }

  return Promise.all([sniffFile(file.path, rule), containsMarkup(file.path)])
    .then(([magicOk, markup]) => {
      if (!magicOk || markup) {
        fs.unlink(file.path, () => {});
        return res.status(400).json({
          success: false,
          message: 'File contents do not match the declared type',
        });
      }
      next();
    })
    .catch(() => {
      fs.unlink(file.path, () => {});
      res.status(400).json({ success: false, message: 'Could not verify uploaded file' });
    });
};

/**
 * Serves an uploaded file safely: attachment disposition + nosniff so the
 * browser never renders it inline as HTML/SVG (stored XSS).
 */
export const sendUploadSafely = (filePath: string, res: any): boolean => {
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(uploadDir + path.sep) || !fs.existsSync(resolved)) return false;

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', 'attachment');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.sendFile(resolved);
  return true;
};

// Error handler for multer — never echoes raw internal error text.
export const handleUploadError = (err: any, req: any, res: any, next: any) => {
  if (res.headersSent) return next(err);

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: `File too large. Maximum size is ${Math.round(maxFileSize / 1024 / 1024)}MB.`,
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ success: false, message: 'Unexpected or too many files' });
    }
    return res.status(400).json({ success: false, message: 'Upload rejected' });
  }

  if (err) {
    console.warn('[upload] rejected:', err.message);
    return res.status(400).json({ success: false, message: 'Upload rejected' });
  }

  next();
};
