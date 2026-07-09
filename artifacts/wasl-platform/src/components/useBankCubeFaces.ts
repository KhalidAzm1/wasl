import { useMemo } from 'react';
import { useListBanks } from '@workspace/api-client-react';

// Flagship banks that must appear on the cube faces, with alias fragments to
// match against `nameEn` (handles both short and full/parenthesized forms,
// e.g. "Saudi National Bank (SNB)").
const FLAGSHIP_BANKS: { aliases: string[]; initials: string }[] = [
  { aliases: ['al rajhi', 'rajhi'], initials: 'AR' },
  { aliases: ['saudi national', 'snb'], initials: 'SNB' },
  { aliases: ['alinma'], initials: 'ALI' },
  { aliases: ['riyad bank', 'riyad'], initials: 'RB' },
  { aliases: ['banque saudi fransi', 'bsf', 'fransi'], initials: 'BSF' },
];

function placeholderTexture(initials: string): string {
  // A branded fallback (dark glass chip with the bank's initials) so a face
  // is never left blank if the API's bank list doesn't include a match yet.
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'>
    <rect width='256' height='256' rx='24' fill='#0c0c16'/>
    <text x='128' y='142' font-family='Arial, sans-serif' font-size='54' font-weight='700' fill='#c4c4d6' text-anchor='middle'>${initials}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

// Abstract purple/blue "network" glyph used for the cube's 6th face instead
// of the Wasl wordmark logo. The sidebar already shows exactly one Wasl
// logo at the top; the cube must never repeat it (that was the original
// duplicate-logo bug), so this face carries the brand colors/motif only.
function abstractBrandTexture(): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'>
    <defs>
      <linearGradient id='g' x1='0%' y1='0%' x2='100%' y2='100%'>
        <stop offset='0%' stop-color='#7c3aed'/>
        <stop offset='100%' stop-color='#22d3ee'/>
      </linearGradient>
    </defs>
    <rect width='256' height='256' rx='24' fill='#0c0c16'/>
    <circle cx='128' cy='128' r='58' fill='none' stroke='url(#g)' stroke-width='6'/>
    <circle cx='128' cy='70' r='10' fill='url(#g)'/>
    <circle cx='176' cy='158' r='10' fill='url(#g)'/>
    <circle cx='80' cy='158' r='10' fill='url(#g)'/>
    <line x1='128' y1='70' x2='176' y2='158' stroke='url(#g)' stroke-width='3'/>
    <line x1='176' y1='158' x2='80' y2='158' stroke='url(#g)' stroke-width='3'/>
    <line x1='80' y1='158' x2='128' y2='70' stroke='url(#g)' stroke-width='3'/>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

function findBankLogo(banks: { nameEn: string; logoUrl?: string | null }[], aliases: string[]): string | null {
  const bank = banks.find((b) => {
    const name = b.nameEn.toLowerCase();
    return aliases.some((alias) => name.includes(alias));
  });
  return bank?.logoUrl || null;
}

/** Shared cube-face texture list (5 flagship bank logos + 1 abstract brand
 * glyph) used by both the sidebar cube and the entry-experience vault cube.
 * Deliberately excludes the Wasl wordmark logo itself — the sidebar already
 * shows exactly one Wasl logo at the top, and the cube must never rotate
 * into a second one. Always returns 6 visibly-branded textures, falling
 * back to an initials chip per bank if the live API logo isn't available. */
export function useBankCubeFaces(): string[] {
  const { data: banks } = useListBanks();

  return useMemo(() => {
    const list = banks || [];
    return [
      abstractBrandTexture(),
      ...FLAGSHIP_BANKS.map(({ aliases, initials }) => findBankLogo(list, aliases) || placeholderTexture(initials)),
    ];
  }, [banks]);
}
