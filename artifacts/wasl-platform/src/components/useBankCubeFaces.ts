import { useMemo } from 'react';
import { useListBanks } from '@workspace/api-client-react';
import waslLogoUrl from '@assets/wasl_brand/wasl_logo_2026.png';

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

function findBankLogo(banks: { nameEn: string; logoUrl?: string | null }[], aliases: string[]): string | null {
  const bank = banks.find((b) => {
    const name = b.nameEn.toLowerCase();
    return aliases.some((alias) => name.includes(alias));
  });
  return bank?.logoUrl || null;
}

/** Shared cube-face texture list (Wasl + 5 flagship bank logos) used by both
 * the sidebar cube and the entry-experience vault cube. Always returns 6
 * visibly-branded textures, falling back to an initials chip per bank if the
 * live API logo isn't available. */
export function useBankCubeFaces(): string[] {
  const { data: banks } = useListBanks();

  return useMemo(() => {
    const list = banks || [];
    return [
      waslLogoUrl,
      ...FLAGSHIP_BANKS.map(({ aliases, initials }) => findBankLogo(list, aliases) || placeholderTexture(initials)),
    ];
  }, [banks]);
}
