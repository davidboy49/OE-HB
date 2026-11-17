import { FilterXSS } from 'xss';

const MAX_LENGTH = 20_000;

/**
 * The concern comes from a rich-text editor and is shown to other people, so it is reduced
 * to a small allow-list of formatting tags on the server. Scripts, event handlers, styles,
 * links and images are all stripped, whatever the client sent.
 */
const filter = new FilterXSS({
  whiteList: {
    p: [],
    br: [],
    strong: [],
    b: [],
    em: [],
    i: [],
    u: [],
    s: [],
    ul: [],
    ol: [],
    li: [],
    h1: [],
    h2: [],
    h3: [],
    blockquote: [],
    code: [],
    pre: [],
    hr: [],
    table: [],
    thead: [],
    tbody: [],
    tr: [],
    th: ['colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
    colgroup: [],
    col: [],
  },
  // Tags outside the list (a, img, iframe, ...) are dropped but their text is kept;
  // script/style are dropped together with their contents.
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
  css: false,
});

export function sanitizeConcern(html: string): string {
  return filter.process((html ?? '').slice(0, MAX_LENGTH)).trim();
}
