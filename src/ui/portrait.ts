// Deterministic, charming SVG portraits from a name. No image assets needed.
import { hashString, mulberry32, pick } from '../core/rng';

const SKIN = ['#f5d0b5', '#e8b796', '#d29a73', '#b07650', '#8a5638', '#5e3a24', '#c9d8b0', '#b8c4e0'];
const HAIR = ['#2b1d14', '#5a3b22', '#a0642c', '#d9a441', '#e8e0d0', '#7a2a1d', '#3a3f58', '#6b8f4e', '#9b5fc0'];
const BG = ['#3b4a7a', '#7a3b4a', '#3b7a5e', '#7a6a3b', '#5a3b7a', '#3b6a7a', '#7a4f3b'];
const CLOTH = ['#8c2f39', '#2f5c8c', '#3d7a3d', '#8c6a2f', '#5c2f8c', '#2f8c7a', '#555'];

export function portraitSvg(name: string, size = 64, extra = ''): string {
  const r = mulberry32(hashString(name));
  const skin = pick(SKIN, r), hair = pick(HAIR, r), bg = pick(BG, r), cloth = pick(CLOTH, r);
  const hairStyle = Math.floor(r() * 5);
  const beard = r() < 0.3;
  const hood = r() < 0.18;
  const eyeY = 46 + r() * 3;
  const eyeGap = 9 + r() * 3;
  const faceW = 19 + r() * 4;
  const scar = r() < 0.15;
  const earring = r() < 0.25;
  const smile = r();
  const mouth = smile < 0.33 ? 'M43 62 Q50 67 57 62' : smile < 0.66 ? 'M44 63 L56 63' : 'M43 64 Q50 60 57 64';
  const hairPaths = [
    `<path d="M${50 - faceW - 2} 46 Q${50 - faceW} 20 50 20 Q${50 + faceW} 20 ${50 + faceW + 2} 46 Q${50 + faceW - 4} 30 50 30 Q${50 - faceW + 4} 30 ${50 - faceW - 2} 46Z" fill="${hair}"/>`,
    `<path d="M${50 - faceW - 3} 70 Q${50 - faceW - 6} 18 50 18 Q${50 + faceW + 6} 18 ${50 + faceW + 3} 70 L${50 + faceW - 2} 70 Q${50 + faceW} 34 50 32 Q${50 - faceW} 34 ${50 - faceW + 2} 70Z" fill="${hair}"/>`,
    `<path d="M${50 - faceW} 38 Q50 14 ${50 + faceW} 38 Q50 28 ${50 - faceW} 38Z" fill="${hair}"/>`,
    `<path d="M${50 - faceW - 2} 44 Q${50 - faceW - 2} 22 50 22 Q${50 + faceW + 2} 22 ${50 + faceW + 2} 44 L${50 + faceW - 3} 36 L${50 + 6} 30 L${50 - 4} 34 L${50 - faceW + 3} 34Z" fill="${hair}"/>`,
    '',
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" class="portrait ${extra}">
  <defs><radialGradient id="g${hashString(name)}" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="${bg}" stop-opacity="0.9"/><stop offset="1" stop-color="#11131f"/></radialGradient></defs>
  <circle cx="50" cy="50" r="49" fill="url(#g${hashString(name)})"/>
  <path d="M18 100 Q20 76 50 74 Q80 76 82 100Z" fill="${cloth}"/>
  <path d="M42 70 L50 80 L58 70Z" fill="${skin}"/>
  ${hood ? `<path d="M${50 - faceW - 9} 80 Q${50 - faceW - 10} 16 50 14 Q${50 + faceW + 10} 16 ${50 + faceW + 9} 80Z" fill="${cloth}" opacity="0.95"/>` : ''}
  <ellipse cx="50" cy="50" rx="${faceW}" ry="24" fill="${skin}"/>
  ${hood ? '' : hairPaths[hairStyle]}
  <ellipse cx="${50 - eyeGap}" cy="${eyeY}" rx="2.6" ry="3" fill="#1b1b24"/>
  <ellipse cx="${50 + eyeGap}" cy="${eyeY}" rx="2.6" ry="3" fill="#1b1b24"/>
  <circle cx="${50 - eyeGap + 0.9}" cy="${eyeY - 1}" r="0.9" fill="#fff"/>
  <circle cx="${50 + eyeGap + 0.9}" cy="${eyeY - 1}" r="0.9" fill="#fff"/>
  <path d="M${50 - eyeGap - 4} ${eyeY - 6} L${50 - eyeGap + 4} ${eyeY - 7}" stroke="${hair}" stroke-width="2" stroke-linecap="round"/>
  <path d="M${50 + eyeGap - 4} ${eyeY - 7} L${50 + eyeGap + 4} ${eyeY - 6}" stroke="${hair}" stroke-width="2" stroke-linecap="round"/>
  <path d="M50 ${eyeY + 3} Q47 ${eyeY + 10} 50 ${eyeY + 11}" stroke="#00000033" stroke-width="1.6" fill="none"/>
  <ellipse cx="${50 - faceW + 6}" cy="58" rx="4" ry="2.5" fill="#ff6b6b" opacity="0.18"/>
  <ellipse cx="${50 + faceW - 6}" cy="58" rx="4" ry="2.5" fill="#ff6b6b" opacity="0.18"/>
  ${beard ? `<path d="M${50 - faceW + 2} 55 Q50 ${84 + r() * 6} ${50 + faceW - 2} 55 Q50 66 ${50 - faceW + 2} 55Z" fill="${hair}"/>` : ''}
  <path d="${mouth}" stroke="#5a2a22" stroke-width="2" fill="none" stroke-linecap="round"/>
  ${scar ? `<path d="M${50 + eyeGap - 3} ${eyeY - 9} L${50 + eyeGap + 3} ${eyeY + 8}" stroke="#a33" stroke-width="1.4" opacity="0.7"/>` : ''}
  ${earring ? `<circle cx="${50 + faceW}" cy="58" r="2" fill="#f2c94c"/>` : ''}
  <circle cx="50" cy="50" r="48.5" fill="none" stroke="#d4a64a" stroke-width="2.5"/>
</svg>`;
}

export function portraitEl(name: string, size = 64, extra = ''): HTMLElement {
  const span = document.createElement('span');
  span.className = 'portrait-wrap';
  span.innerHTML = portraitSvg(name, size, extra);
  return span;
}
