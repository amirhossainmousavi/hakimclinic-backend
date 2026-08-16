import { promises as fs } from 'node:fs';
import path from 'node:path';
import { env } from '../../config/env';

/**
 * رابط ذخیره‌سازی فایل. دو پیاده‌سازی: local (توسعه) و s3 (همروش).
 */
export interface StorageAdapter {
  save(buf: Buffer, key: string, mime: string): Promise<string>;
  delete(url: string): Promise<void>;
}

const allowedExt = new Set(['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov', 'webm']);

class LocalStorageAdapter implements StorageAdapter {
  private root: string;

  constructor() {
    this.root = path.resolve(process.cwd(), env.UPLOAD_DIR);
  }

  async save(buf: Buffer, key: string, mime: string): Promise<string> {
    const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin';
    const safeKey = `${key}.${ext}`;
    const fullPath = path.join(this.root, safeKey);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buf);
    return `/uploads/${safeKey}`;
  }

  async delete(url: string): Promise<void> {
    if (!url.startsWith('/uploads/')) return;
    const relative = url.replace(/^\/uploads\//, '');
    await fs.unlink(path.join(this.root, relative)).catch(() => {
      /* فایل وجود ندارد — بی‌صدا نادیده بگیر */
    });
  }
}

// پکیج aws-sdk به‌صورت lazy لود می‌شود تا وقتی STORAGE_DRIVER=local است
// حتی نصب نباشد، ماژول بالا نیاید.
type S3ClientLike = {
  send: (cmd: any) => Promise<any>;
};
type PutObjectCommandCtor = new (input: any) => any;
type DeleteObjectCommandCtor = new (input: any) => any;

let s3Cache: {
  client: S3ClientLike;
  PutObjectCommand: PutObjectCommandCtor;
  DeleteObjectCommand: DeleteObjectCommandCtor;
} | null = null;

function getS3() {
  if (s3Cache) return s3Cache;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { S3Client } = require('@aws-sdk/client-s3');
  const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
  const client = new S3Client({
    region: env.S3_REGION === 'default' ? 'us-east-1' : env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: true,
  });
  s3Cache = { client, PutObjectCommand, DeleteObjectCommand };
  return s3Cache;
}

class S3StorageAdapter implements StorageAdapter {
  async save(buf: Buffer, key: string, mime: string): Promise<string> {
    const { client, PutObjectCommand } = getS3();
    const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin';
    const safeKey = `${key}.${ext}`;
    await client.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: safeKey,
        Body: buf,
        ContentType: mime,
      })
    );
    return `${env.S3_ENDPOINT}/${env.S3_BUCKET}/${safeKey}`;
  }

  async delete(url: string): Promise<void> {
    const { client, DeleteObjectCommand } = getS3();
    const marker = `${env.S3_ENDPOINT}/${env.S3_BUCKET}/`;
    if (!url.startsWith(marker)) return;
    const key = url.slice(marker.length);
    await client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key })).catch(() => {
      /* کلید وجود ندارد — بی‌صدا نادیده بگیر */
    });
  }
}

export function getStorageAdapter(): StorageAdapter {
  if (env.STORAGE_DRIVER === 's3') {
    return new S3StorageAdapter();
  }
  return new LocalStorageAdapter();
}
