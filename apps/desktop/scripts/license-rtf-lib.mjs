export const normalizeLicenseSource = (value) => value
  .replace(/^\uFEFF/, '')
  .replace(/\r\n/g, '\n')
  .trim();

export const encodeLicenseRtfBody = (value) => [...value].map((character) => {
  if (character === '\\') return '\\\\';
  if (character === '{') return '\\{';
  if (character === '}') return '\\}';
  if (character === '\n') return '\\par\n';
  const codePoint = character.codePointAt(0);
  if (codePoint >= 32 && codePoint <= 126) return character;
  return `\\u${codePoint > 32767 ? codePoint - 65536 : codePoint}?`;
}).join('');

export const renderLicenseRtf = (source) => {
  const normalized = normalizeLicenseSource(source);
  return `{\\rtf1\\ansi\\ansicpg1254\\deff0{\\fonttbl{\\f0\\fswiss Segoe UI;}}\\viewkind4\\uc1\\pard\\f0\\fs18\n${encodeLicenseRtfBody(normalized)}\\par\n}`;
};
