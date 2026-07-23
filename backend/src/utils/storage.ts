import fs from 'fs';
import path from 'path';
import axios from 'axios';

// Storage configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'vitora-reports';

export interface StorageAdapter {
  uploadFile(relativeFilePath: string, fileBuffer: Buffer, mimeType: string): Promise<string>;
  getFileStream(fileIdentifier: string): Promise<NodeJS.ReadableStream | Buffer>;
}

class LocalStorageAdapter implements StorageAdapter {
  async uploadFile(relativeFilePath: string, fileBuffer: Buffer, mimeType: string): Promise<string> {
    const absolutePath = path.join(__dirname, '../../', relativeFilePath);
    const parentDir = path.dirname(absolutePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(absolutePath, fileBuffer);
    return absolutePath; // returns absolute path on local disk
  }

  async getFileStream(fileIdentifier: string): Promise<NodeJS.ReadableStream> {
    const absolutePath = path.isAbsolute(fileIdentifier)
      ? fileIdentifier
      : path.join(__dirname, '../../', fileIdentifier);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }
    return fs.createReadStream(absolutePath);
  }
}

class SupabaseStorageAdapter implements StorageAdapter {
  private url: string;
  private key: string;
  private bucket: string;

  constructor(url: string, key: string, bucket: string) {
    this.url = url;
    this.key = key;
    this.bucket = bucket;
  }

  async uploadFile(relativeFilePath: string, fileBuffer: Buffer, mimeType: string): Promise<string> {
    const cleanPath = relativeFilePath.replace(/\\/g, '/'); // ensure forward slashes
    const uploadUrl = `${this.url}/storage/v1/object/${this.bucket}/${cleanPath}`;

    try {
      await axios.post(uploadUrl, fileBuffer, {
        headers: {
          'Authorization': `Bearer ${this.key}`,
          'Content-Type': mimeType,
          'x-upsert': 'true' // overwrite if exists
        }
      });

      // Return public URL
      return `${this.url}/storage/v1/object/public/${this.bucket}/${cleanPath}`;
    } catch (error: any) {
      console.error('Supabase bucket upload error:', error.response?.data || error.message);
      throw new Error(`Cloud storage upload failed: ${error.message}`);
    }
  }

  async getFileStream(fileIdentifier: string): Promise<Buffer> {
    const downloadUrl = fileIdentifier.startsWith('http')
      ? fileIdentifier.replace('/public/', '/') // API download endpoint
      : `${this.url}/storage/v1/object/${this.bucket}/${fileIdentifier}`;

    try {
      const response = await axios.get(downloadUrl, {
        headers: { 'Authorization': `Bearer ${this.key}` },
        responseType: 'arraybuffer'
      });
      return Buffer.from(response.data);
    } catch (error: any) {
      console.error('Supabase bucket download error:', error.response?.data || error.message);
      throw new Error(`Cloud storage download failed: ${error.message}`);
    }
  }
}

// Select active storage adapter
export const storage = (SUPABASE_URL && SUPABASE_KEY)
  ? new SupabaseStorageAdapter(SUPABASE_URL, SUPABASE_KEY, SUPABASE_BUCKET)
  : new LocalStorageAdapter();
export default storage;
