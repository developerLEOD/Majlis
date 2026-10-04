export interface StainedGlassTheme {
  id: string;
  name: string;
  // Leaded glass frame border gradient
  borderGradient: string;
  // Glowing active border when speaking
  speakingBorder: string;
  // Inner glass facet gradient when camera/video is off
  glassGradient: string;
  // Glass surface light reflection
  glassSheen: string;
  // Text color / highlight
  textColor: string;
  // Accent badge / rim color
  rimColor: string;
  // Soft glow color for box-shadow / drop-shadow
  glowColor: string;
}

export const STAINED_GLASS_PALETTES: StainedGlassTheme[] = [
  {
    id: 'emerald',
    name: 'Emerald Jade (Zomorrod)',
    borderGradient: 'from-[#10B981] via-[#064E3B] to-[#047857]',
    speakingBorder: 'from-[#34D399] via-[#E9A83A] to-[#10B981]',
    glassGradient: 'from-[#0C382A] via-[#062017] to-[#02100B]',
    glassSheen: 'linear-gradient(135deg, rgba(16, 185, 129, 0.35) 0%, rgba(5, 150, 105, 0.12) 40%, rgba(2, 44, 34, 0.5) 100%)',
    textColor: '#A7F3D0',
    rimColor: '#10B981',
    glowColor: 'rgba(16, 185, 129, 0.45)',
  },
  {
    id: 'sapphire',
    name: 'Sapphire Lapis (Lazward)',
    borderGradient: 'from-[#38BDF8] via-[#1E3A5F] to-[#0284C7]',
    speakingBorder: 'from-[#60A5FA] via-[#E9A83A] to-[#38BDF8]',
    glassGradient: 'from-[#0D2B47] via-[#081A2B] to-[#030C15]',
    glassSheen: 'linear-gradient(135deg, rgba(56, 189, 248, 0.35) 0%, rgba(2, 132, 199, 0.12) 40%, rgba(3, 41, 62, 0.5) 100%)',
    textColor: '#BAE6FD',
    rimColor: '#38BDF8',
    glowColor: 'rgba(56, 189, 248, 0.45)',
  },
  {
    id: 'ruby',
    name: 'Ruby Garnet (Yaqout Ahmar)',
    borderGradient: 'from-[#FB7185] via-[#4C0519] to-[#E11D48]',
    speakingBorder: 'from-[#F43F5E] via-[#E9A83A] to-[#FB7185]',
    glassGradient: 'from-[#3E0A17] via-[#24060E] to-[#120207]',
    glassSheen: 'linear-gradient(135deg, rgba(244, 63, 94, 0.35) 0%, rgba(225, 29, 72, 0.12) 40%, rgba(76, 5, 25, 0.5) 100%)',
    textColor: '#FECDD3',
    rimColor: '#FB7185',
    glowColor: 'rgba(244, 63, 94, 0.45)',
  },
  {
    id: 'amber',
    name: 'Amber Topaz (Kahraba)',
    borderGradient: 'from-[#FBBF24] via-[#451A03] to-[#D97706]',
    speakingBorder: 'from-[#F59E0B] via-[#FFFBEB] to-[#FBBF24]',
    glassGradient: 'from-[#3C2005] via-[#241303] to-[#140A01]',
    glassSheen: 'linear-gradient(135deg, rgba(251, 191, 36, 0.35) 0%, rgba(217, 119, 6, 0.12) 40%, rgba(69, 26, 3, 0.5) 100%)',
    textColor: '#FDE68A',
    rimColor: '#FBBF24',
    glowColor: 'rgba(251, 191, 36, 0.45)',
  },
  {
    id: 'amethyst',
    name: 'Amethyst Purple (Jamaz)',
    borderGradient: 'from-[#C084FC] via-[#3B0764] to-[#9333EA]',
    speakingBorder: 'from-[#A855F7] via-[#E9A83A] to-[#C084FC]',
    glassGradient: 'from-[#2F0843] via-[#1C0528] to-[#0F0216]',
    glassSheen: 'linear-gradient(135deg, rgba(192, 132, 252, 0.35) 0%, rgba(147, 51, 234, 0.12) 40%, rgba(59, 7, 100, 0.5) 100%)',
    textColor: '#E9D5FF',
    rimColor: '#C084FC',
    glowColor: 'rgba(192, 132, 252, 0.45)',
  },
  {
    id: 'turquoise',
    name: 'Persian Turquoise (Fairouz)',
    borderGradient: 'from-[#2DD4BF] via-[#042F2E] to-[#0D9488]',
    speakingBorder: 'from-[#14B8A6] via-[#E9A83A] to-[#2DD4BF]',
    glassGradient: 'from-[#0A3330] via-[#051F1D] to-[#02100F]',
    glassSheen: 'linear-gradient(135deg, rgba(45, 212, 191, 0.35) 0%, rgba(13, 148, 136, 0.12) 40%, rgba(4, 47, 46, 0.5) 100%)',
    textColor: '#99F6E4',
    rimColor: '#2DD4BF',
    glowColor: 'rgba(45, 212, 191, 0.45)',
  },
  {
    id: 'rose',
    name: 'Rose Quartz (Ward)',
    borderGradient: 'from-[#F472B6] via-[#500724] to-[#DB2777]',
    speakingBorder: 'from-[#EC4899] via-[#E9A83A] to-[#F472B6]',
    glassGradient: 'from-[#3A0A27] via-[#220517] to-[#11020B]',
    glassSheen: 'linear-gradient(135deg, rgba(244, 114, 182, 0.35) 0%, rgba(219, 39, 119, 0.12) 40%, rgba(80, 7, 36, 0.5) 100%)',
    textColor: '#FBCFE8',
    rimColor: '#F472B6',
    glowColor: 'rgba(244, 114, 182, 0.45)',
  },
  {
    id: 'terracotta',
    name: 'Terracotta Bronze (Nahs)',
    borderGradient: 'from-[#FB923C] via-[#431407] to-[#EA580C]',
    speakingBorder: 'from-[#F97316] via-[#E9A83A] to-[#FB923C]',
    glassGradient: 'from-[#381609] via-[#220D05] to-[#120702]',
    glassSheen: 'linear-gradient(135deg, rgba(251, 146, 60, 0.35) 0%, rgba(234, 88, 12, 0.12) 40%, rgba(67, 20, 7, 0.5) 100%)',
    textColor: '#FED7AA',
    rimColor: '#FB923C',
    glowColor: 'rgba(251, 146, 60, 0.45)',
  },
  {
    id: 'cobalt',
    name: 'Deep Cobalt (Azraq)',
    borderGradient: 'from-[#818CF8] via-[#1E1B4B] to-[#4F46E5]',
    speakingBorder: 'from-[#6366F1] via-[#E9A83A] to-[#818CF8]',
    glassGradient: 'from-[#17153E] via-[#0E0C26] to-[#070614]',
    glassSheen: 'linear-gradient(135deg, rgba(129, 140, 248, 0.35) 0%, rgba(79, 70, 229, 0.12) 40%, rgba(30, 27, 75, 0.5) 100%)',
    textColor: '#C7D2FE',
    rimColor: '#818CF8',
    glowColor: 'rgba(129, 140, 248, 0.45)',
  },
  {
    id: 'citrine',
    name: 'Citrine Gold (Dhahab)',
    borderGradient: 'from-[#FDE047] via-[#422006] to-[#CA8A04]',
    speakingBorder: 'from-[#EAB308] via-[#FFFFFF] to-[#FDE047]',
    glassGradient: 'from-[#352305] via-[#201503] to-[#100B01]',
    glassSheen: 'linear-gradient(135deg, rgba(253, 224, 71, 0.35) 0%, rgba(202, 138, 4, 0.12) 40%, rgba(66, 32, 6, 0.5) 100%)',
    textColor: '#FEF08A',
    rimColor: '#FDE047',
    glowColor: 'rgba(253, 224, 71, 0.45)',
  },
];

/**
 * Returns a deterministic stained glass palette for a given string key (e.g. participant ID or name).
 */
export function getStainedGlassTheme(key: string, indexOffset: number = 0): StainedGlassTheme {
  if (!key) return STAINED_GLASS_PALETTES[0];
  let hash = indexOffset;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) & 0xffffffff;
  }
  const index = Math.abs(hash) % STAINED_GLASS_PALETTES.length;
  return STAINED_GLASS_PALETTES[index];
}
