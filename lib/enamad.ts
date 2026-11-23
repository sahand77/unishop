export const enamadCodeLimit = 4096;

const sealOrigin = "https://trustseal.enamad.ir";

function readAttribute(attributes: string, name: string) {
  const values = Array.from(attributes.matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g))
    .filter(match => match[1].toLowerCase() === name);
  if (values.length !== 1) return null;
  const [, , doubleQuoted, singleQuoted, unquoted] = values[0];
  return (doubleQuoted ?? singleQuoted ?? unquoted)?.replace(/&amp;/gi, "&") ?? null;
}

function sealUrl(value: string | null, pathname: string) {
  const url = value && URL.parse(value);
  if (!url || url.origin !== sealOrigin || url.pathname !== pathname || url.username || url.password) return null;
  const ids = url.searchParams.getAll("id");
  const codes = url.searchParams.getAll("Code");
  if (ids.length !== 1 || codes.length !== 1 || !/^\d+$/.test(ids[0]) || !codes[0]) return null;
  return { id: ids[0], code: codes[0] };
}

export function parseEnamadEmbed(input: string) {
  if (input.length > enamadCodeLimit) return null;
  const html = input.trim().replace(/\\([<>:])/g, "$1");
  const match = /^<a\s+((?:"[^"]*"|'[^']*'|[^<>"'])+)>\s*<img\s+((?:"[^"]*"|'[^']*'|[^<>"'])+)>\s*<\/a\s*>$/i.exec(html);
  if (!match) return null;

  const link = sealUrl(readAttribute(match[1], "href"), "/");
  const image = sealUrl(readAttribute(match[2], "src"), "/logo.aspx");
  if (!link || !image || link.id !== image.id || link.code !== image.code) return null;

  const query = new URLSearchParams({ id: link.id, Code: link.code });
  return { href: `${sealOrigin}/?${query}`, src: `${sealOrigin}/logo.aspx?${query}`, code: link.code };
}
