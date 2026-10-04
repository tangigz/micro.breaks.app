import chair from '@/assets/emoji/chair.png';
import droplet from '@/assets/emoji/droplet.png';
import biceps from '@/assets/emoji/flexed-biceps.png';
import footprints from '@/assets/emoji/footprints.png';
import voltage from '@/assets/emoji/high-voltage.png';
import sun from '@/assets/emoji/sun.png';
import wastebasket from '@/assets/emoji/wastebasket.png';
import type { Mission } from '@/engine/missions';

const IMAGES: Record<string, string> = {
  droplet,
  'high-voltage': voltage,
  footprints,
  sun,
  wastebasket,
  chair,
  'flexed-biceps': biceps,
};

const TILES: Record<string, string> = {
  blue: 'bg-tile-blue',
  peach: 'bg-tile-peach',
  green: 'bg-tile-green',
  lilac: 'bg-tile-lilac',
};

/** The illustration and pastel tile of a mission, from the names in content/missions.json. */
export function missionArt(m: Mission): { img: string; tile: string } {
  return { img: IMAGES[m.img] ?? droplet, tile: TILES[m.tile] ?? 'bg-tile-blue' };
}
