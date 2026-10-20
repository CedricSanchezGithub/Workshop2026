import { toSvg } from 'jdenticon';
import type { AvatarGenerator } from '../../application/ports/AvatarGenerator.js';

export class JdenticonAvatarGenerator implements AvatarGenerator {
  generate(seed: string) {
    return toSvg(seed, 96, { backColor: '#111111', hues: [0], saturation: { color: 0, grayscale: 0 }, lightness: { color: [0.95, 1], grayscale: [0.8, 1] }, padding: 0.08 });
  }
}
