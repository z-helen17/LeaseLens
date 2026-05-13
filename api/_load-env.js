import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// Load .env.local first (highest priority), then .env as fallback.
// In production these files don't exist and dotenv silently skips them.
config({ path: join(root, '.env.local'), override: false });
config({ path: join(root, '.env'), override: false });
