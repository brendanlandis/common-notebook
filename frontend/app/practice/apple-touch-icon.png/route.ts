import fs from 'fs';
import path from 'path';

export async function GET() {
  const iconPath = path.join(process.cwd(), 'app/practice/apple-icon.png');
  const buffer = fs.readFileSync(iconPath);
  
  return new Response(buffer, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

