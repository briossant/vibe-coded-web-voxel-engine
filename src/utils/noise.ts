
// A simple wrapper around the shared logic for the main thread
import { SimplexNoise } from '@/src/services/TerrainMath';

export const noise = new SimplexNoise(12345);
