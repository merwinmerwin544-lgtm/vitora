import jwt from 'jsonwebtoken';
import axios from 'axios';

const GOOGLE_PUBLIC_KEYS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;

interface FirebasePublicKeyMap {
  [key: string]: string;
}

// Memory cache for public keys
let cachedPublicKeys: FirebasePublicKeyMap = {};
let cacheExpiration: number = 0;

async function getPublicKeys(): Promise<FirebasePublicKeyMap> {
  const now = Date.now();
  if (Object.keys(cachedPublicKeys).length > 0 && now < cacheExpiration) {
    return cachedPublicKeys;
  }

  try {
    const response = await axios.get(GOOGLE_PUBLIC_KEYS_URL);
    cachedPublicKeys = response.data;
    
    // Parse max-age from Cache-Control headers
    const cacheControl = String(response.headers['cache-control'] || '');
    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
    const maxAgeSeconds = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600;
    
    cacheExpiration = now + (maxAgeSeconds * 1000);
    return cachedPublicKeys;
  } catch (error) {
    console.error('Failed to retrieve Firebase public keys from Google:', error);
    throw new Error('Public certificate keys acquisition failure');
  }
}

export interface DecodedFirebaseToken {
  uid: string;
  email: string;
  name?: string;
  picture?: string;
  provider: string;
}

export async function verifyFirebaseIdToken(token: string): Promise<DecodedFirebaseToken> {
  // --- STANDARD PRODUCTION VERIFICATION ---
  const decodedHeader = jwt.decode(token, { complete: true });
  if (!decodedHeader || typeof decodedHeader === 'string' || !decodedHeader.header.kid) {
    throw new Error('Invalid Firebase token structure');
  }

  const kid = decodedHeader.header.kid;
  const publicKeys = await getPublicKeys();
  const cert = publicKeys[kid];
  
  if (!cert) {
    throw new Error('Matching certificate key ID (kid) not found');
  }

  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      cert,
      {
        audience: FIREBASE_PROJECT_ID,
        issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
        algorithms: ['RS256']
      },
      (err, decoded: any) => {
        if (err || !decoded) {
          return reject(new Error(`Token verification failed: ${err?.message}`));
        }

        resolve({
          uid: decoded.sub, // Firebase uid is stored in the JWT 'sub' parameter
          email: decoded.email,
          name: decoded.name,
          picture: decoded.picture,
          provider: decoded.firebase?.sign_in_provider === 'github.com' 
            ? 'GitHub' 
            : decoded.firebase?.sign_in_provider === 'apple.com' 
            ? 'Apple' 
            : decoded.firebase?.sign_in_provider === 'google.com' 
            ? 'Google' 
            : 'Email'
        });
      }
    );
  });
}
