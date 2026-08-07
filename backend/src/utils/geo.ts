import * as h3 from 'h3-js';
import crypto from 'crypto';

interface ObfuscatedLocation {
  obfuscatedLat: number;
  obfuscatedLng: number;
  h3Index: string;
}

/**
 * Obfuscates a real latitude and longitude using H3 hex binning.
 * 
 * WHY: We need to protect the exact location of care providers while still
 * allowing them to be found in spatial searches. 
 * 
 * HOW:
 * 1. Convert real lat/lng to an H3 index at resolution 8 (approx 460m edge).
 * 2. Get the center point of that H3 hexagon.
 * 3. Add a small deterministic offset based on a hash of the H3 index. 
 *    This prevents all providers in the same hex from snapping to the exact same point,
 *    which could look unnatural on a map, while ensuring the offset is stable (deterministic).
 * 
 * @param lat Real latitude
 * @param lng Real longitude
 * @returns Obfuscated location data
 */
export function obfuscateLocation(lat: number, lng: number): ObfuscatedLocation {
  const resolution = 8;
  
  // Step 1: Get the H3 index for the real coordinates
  const h3Index = h3.latLngToCell(lat, lng, resolution);
  
  // Step 2: Get the center of that H3 cell
  const [centerLat, centerLng] = h3.cellToLatLng(h3Index);
  
  // Step 3: Add deterministic offset
  // We use the h3Index string to create a consistent seed
  const hash = crypto.createHash('sha256').update(h3Index).digest('hex');
  
  // Convert first few bytes of hash to a number between 0 and 1
  const seed1 = parseInt(hash.substring(0, 8), 16) / 0xffffffff;
  const seed2 = parseInt(hash.substring(8, 16), 16) / 0xffffffff;
  
  // Offset by up to ~100 meters (roughly 0.001 degrees)
  // Shift by -0.5 so the offset can be positive or negative
  const latOffset = (seed1 - 0.5) * 0.002;
  const lngOffset = (seed2 - 0.5) * 0.002;
  
  const obfuscatedLat = centerLat + latOffset;
  const obfuscatedLng = centerLng + lngOffset;
  
  return {
    obfuscatedLat,
    obfuscatedLng,
    h3Index,
  };
}
