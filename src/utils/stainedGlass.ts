export interface SanctuaryTheme {
  id: string;
  name: string;
  bgColor: string;          // Rich solid sanctuary background e.g. #075E4A
  borderColor: string;      // Clean metallic border e.g. #19A6A0
  speakingBorder: string;  // Radiant gold border when speaking #E9A83A
  ornamentColor: string;   // Faint star rosette watermark color e.g. #E9A83A
  textColor: string;       // Clean text color #FFFCF5
  accentColor: string;     // Gold accent e.g. #E9A83A
  glowColor: string;       // Ambient gold/emerald glow on speaking
}

// Master Sanctuary Card Palettes matching the "Start a Majlis" card styling
export const SANCTUARY_PALETTES: SanctuaryTheme[] = [
  {
    id: 'emerald',
    name: 'Deep Emerald Glass',
    bgColor: '#075E4A',
    borderColor: 'rgba(25, 166, 160, 0.5)',
    speakingBorder: '#E9A83A',
    ornamentColor: '#E9A83A',
    textColor: '#FFFCF5',
    accentColor: '#E9A83A',
    glowColor: 'rgba(233, 168, 58, 0.6)',
  },
  {
    id: 'sapphire',
    name: 'Deep Sapphire Blue',
    bgColor: '#174A83',
    borderColor: 'rgba(45, 107, 181, 0.5)',
    speakingBorder: '#E9A83A',
    ornamentColor: '#E9A83A',
    textColor: '#FFFCF5',
    accentColor: '#E9A83A',
    glowColor: 'rgba(233, 168, 58, 0.6)',
  },
  {
    id: 'ruby',
    name: 'Deep Ruby Garnet',
    bgColor: '#4C0519',
    borderColor: 'rgba(225, 29, 72, 0.5)',
    speakingBorder: '#E9A83A',
    ornamentColor: '#E9A83A',
    textColor: '#FFFCF5',
    accentColor: '#E9A83A',
    glowColor: 'rgba(233, 168, 58, 0.6)',
  },
  {
    id: 'bronze',
    name: 'Architectural Bronze',
    bgColor: '#302116',
    borderColor: 'rgba(233, 168, 58, 0.4)',
    speakingBorder: '#E9A83A',
    ornamentColor: '#E9A83A',
    textColor: '#FFFCF5',
    accentColor: '#E9A83A',
    glowColor: 'rgba(233, 168, 58, 0.6)',
  },
  {
    id: 'teal',
    name: 'Persian Teal',
    bgColor: '#042F2E',
    borderColor: 'rgba(20, 184, 166, 0.5)',
    speakingBorder: '#E9A83A',
    ornamentColor: '#E9A83A',
    textColor: '#FFFCF5',
    accentColor: '#E9A83A',
    glowColor: 'rgba(233, 168, 58, 0.6)',
  },
  {
    id: 'amethyst',
    name: 'Amethyst Purple',
    bgColor: '#3B0764',
    borderColor: 'rgba(147, 51, 234, 0.5)',
    speakingBorder: '#E9A83A',
    ornamentColor: '#E9A83A',
    textColor: '#FFFCF5',
    accentColor: '#E9A83A',
    glowColor: 'rgba(233, 168, 58, 0.6)',
  },
];

export function getStainedGlassTheme(key: string, indexOffset: number = 0): SanctuaryTheme {
  if (!key) return SANCTUARY_PALETTES[0];
  let hash = indexOffset;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) & 0xffffffff;
  }
  const index = Math.abs(hash) % SANCTUARY_PALETTES.length;
  return SANCTUARY_PALETTES[index];
}
