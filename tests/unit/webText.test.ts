import { describe, expect, it } from 'vitest';
import { decodeEntities, htmlToText, isPrivateAddress, readablePage } from '../../shared/webText';

const long = (s: string) => Array.from({ length: 12 }, () => s).join(' ');

describe('reading a web page', () => {
  it('keeps the article and drops menus, scripts and footers', () => {
    const html = `<html><head><title>Ignored</title><meta property="og:title" content="Photosynthesis &amp; light"></head><body>
      <nav><a>Home</a><a>About</a></nav><header>Site header</header>
      <script>var x = "<p>no</p>";</script>
      <article><h1>Photosynthesis</h1><p>${long('Plants turn light into sugar.')}</p><ul><li>Chlorophyll</li><li>Water</li></ul></article>
      <footer>© 2026</footer></body></html>`;
    const page = readablePage(html);
    expect(page.title).toBe('Photosynthesis & light');
    expect(page.text).toMatch(/^Photosynthesis\n\nPlants turn light into sugar\./);
    expect(page.text).toContain('• Chlorophyll\n• Water');
    expect(page.text).not.toMatch(/Home|Site header|var x|2026/);
  });

  it('falls back to the body when there is no real article, in any language', () => {
    const page = readablePage(`<title>שיעור</title><body><div><p>פוטוסינתזה היא תהליך&nbsp;שבו צמחים</p></div><article>short</article></body>`);
    expect(page.title).toBe('שיעור');
    expect(page.text).toBe('פוטוסינתזה היא תהליך שבו צמחים\n\nshort');
  });

  it('decodes entities and tidies spaces', () => {
    expect(decodeEntities('a &lt;b&gt; &#1513; &#x5d0; &unknown;')).toBe('a <b> ש א &unknown;');
    expect(htmlToText('<p>One</p>\n\n\n<p>  Two   words </p><br>Three')).toBe('One\n\nTwo words\n\nThree');
  });

  it('never fetches private or internal addresses', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.10', '172.20.1.1', '169.254.169.254', '0.0.0.0', '100.64.0.1', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1']) expect(isPrivateAddress(ip)).toBe(true);
    for (const ip of ['8.8.8.8', '151.101.1.69', '172.32.0.1', '2606:4700::1111']) expect(isPrivateAddress(ip)).toBe(false);
  });
});
