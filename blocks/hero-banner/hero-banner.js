const FIELD_ORDER = [
  'label',
  'category',
  'readtime',
  'publishdate',
  'title',
  'subtitle',
  'ctatext',
  'ctalink',
  'author',
  'role',
  'backgroundimage',
];

function normalizeFieldName(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isImageElement(cell) {
  if (!cell) return false;
  if (cell.querySelector('picture, img')) return true;
  const text = cell.textContent.trim();
  return (
    /\.(avif|webp|jpe?g|png|svg)(\?.*)?$/i.test(text)
    || /urn:aaid:aem:/i.test(text)
    || /\/adobe\/assets\//i.test(text)
    || /\/content\/dam\/.*\.(avif|webp|jpe?g|png|svg)/i.test(text)
  );
}

function getFields(block) {
  const fields = {};
  const rows = [...block.children];

  // Check Universal Editor instrumentation attributes
  rows.forEach((row) => {
    const prop = row.getAttribute('data-aue-prop')
      || row.firstElementChild?.getAttribute('data-aue-prop');
    if (prop) {
      fields[normalizeFieldName(prop)] = row.children.length > 0 ? row.children[0] : row;
    }
  });
  if (Object.keys(fields).length > 0) return fields;

  // Check 2-column key-value format
  const isKeyValue = rows.some((row) => {
    if (row.children.length >= 2) {
      const key = normalizeFieldName(row.children[0].textContent);
      return FIELD_ORDER.includes(key);
    }
    return false;
  });

  if (isKeyValue) {
    rows.forEach((row) => {
      if (row.children.length >= 2) {
        const [keyCell, valueCell] = row.children;
        const key = normalizeFieldName(keyCell.textContent);
        fields[key] = valueCell;
      }
    });
    return fields;
  }

  // Single-column positional format
  const cells = rows.map((row) => (row.children.length > 0 ? row.children[0] : row));
  if (cells.length === FIELD_ORDER.length) {
    FIELD_ORDER.forEach((key, i) => {
      fields[key] = cells[i];
    });
    return fields;
  }

  // Heuristic mapping when optional fields are omitted in authoring
  let imageIndex = -1;
  cells.forEach((cell, idx) => {
    if (isImageElement(cell)) {
      imageIndex = idx;
      fields.backgroundimage = cell;
    }
  });

  const contentCells = cells.filter((_, idx) => idx !== imageIndex);

  let readTimeIdx = -1;
  contentCells.forEach((c, idx) => {
    const txt = c.textContent.trim();
    if (readTimeIdx === -1 && /\b\d+\s*min\b|\bread\b/i.test(txt) && txt.length < 30) {
      readTimeIdx = idx;
      fields.readtime = c;
    }
  });

  let publishDateIdx = -1;
  contentCells.forEach((c, idx) => {
    const txt = c.textContent.trim();
    if (publishDateIdx === -1 && idx !== readTimeIdx
      && /\bpublished\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(txt)
      && txt.length < 40) {
      publishDateIdx = idx;
      fields.publishdate = c;
    }
  });

  let roleIdx = -1;
  let authorIdx = -1;
  if (contentCells.length >= 2) {
    const lastCell = contentCells[contentCells.length - 1];
    const lastTxt = lastCell.textContent.trim();
    const rolePattern = /\b(strategist|director|chief|officer|manager|lead|vp|head)\b/i;
    const isRole = /^[A-Z\s]{4,}$/.test(lastTxt) || rolePattern.test(lastTxt);
    if (isRole) {
      roleIdx = contentCells.length - 1;
      fields.role = lastCell;
      authorIdx = contentCells.length - 2;
      fields.author = contentCells[authorIdx];
    }
  }

  let ctaTextIdx = -1;
  let ctaLinkIdx = -1;
  contentCells.forEach((c, idx) => {
    if (idx === readTimeIdx || idx === publishDateIdx
      || idx === authorIdx || idx === roleIdx) return;
    const txt = c.textContent.trim();
    const a = c.querySelector('a');
    const isUrl = (txt.startsWith('/') || txt.startsWith('http')) && !isImageElement(c);
    const isCta = /\b(read|learn|view|see|get|explore|download|report)\b/i.test(txt);
    if (a || isUrl) {
      ctaLinkIdx = idx;
      fields.ctalink = c;
    } else if (ctaTextIdx === -1 && isCta && txt.length < 40) {
      ctaTextIdx = idx;
      fields.ctatext = c;
    }
  });

  const remaining = contentCells.filter((_, idx) => (
    idx !== readTimeIdx
    && idx !== publishDateIdx
    && idx !== authorIdx
    && idx !== roleIdx
    && idx !== ctaTextIdx
    && idx !== ctaLinkIdx
  ));

  if (remaining.length >= 1 && !fields.label) fields.label = remaining.shift();
  if (remaining.length >= 1 && !fields.category) fields.category = remaining.shift();
  if (remaining.length >= 1 && !fields.title) fields.title = remaining.shift();
  if (remaining.length >= 1 && !fields.subtitle) fields.subtitle = remaining.shift();
  if (remaining.length >= 1 && !fields.ctatext) fields.ctatext = remaining.shift();
  if (remaining.length >= 1 && !fields.author) fields.author = remaining.shift();

  return fields;
}

function getText(fields, name, fallback = '') {
  return fields[normalizeFieldName(name)]?.textContent.trim() || fallback;
}

function getLines(fields, name, fallback = '') {
  const cell = fields[normalizeFieldName(name)];
  if (!cell) return fallback ? fallback.split('\n') : [];

  const copy = cell.cloneNode(true);
  copy.querySelectorAll('br').forEach((breakElement) => breakElement.replaceWith('\n'));
  const elements = [...copy.children];
  const value = elements.length > 1
    ? elements.map((element) => element.textContent.trim()).filter(Boolean).join('\n')
    : copy.textContent.trim();

  return (value || fallback).split(/\n+/).map((line) => line.trim()).filter(Boolean);
}

function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  return element;
}

function createMeta(fields) {
  const meta = document.createElement('div');
  meta.className = 'herobanner-meta';
  meta.setAttribute('aria-label', 'Report metadata');

  const label = getText(fields, 'label');
  const category = getText(fields, 'category');
  const readTime = getText(fields, 'readTime');

  if (label) meta.append(createTextElement('span', 'herobanner-label', label));
  if (category) meta.append(createTextElement('span', 'herobanner-category', category));
  if (readTime) meta.append(createTextElement('span', 'herobanner-read-time', readTime));

  return meta;
}

function createHeading(fields) {
  const lines = getLines(fields, 'title');
  if (lines.length === 0) return null;

  const heading = document.createElement('h1');
  heading.className = 'herobanner-title';

  lines.forEach((line) => {
    heading.append(createTextElement('span', 'herobanner-title-line', line));
  });

  return heading;
}

function createSubtitle(fields) {
  const lines = getLines(fields, 'subtitle');
  if (lines.length === 0) return null;

  const subtitle = document.createElement('p');
  subtitle.className = 'herobanner-subtitle';

  lines.forEach((line) => {
    subtitle.append(createTextElement('span', 'herobanner-subtitle-line', line));
  });

  return subtitle;
}

function createCallToAction(fields) {
  const text = getText(fields, 'ctaText');
  if (!text) return null;

  const linkCell = fields[normalizeFieldName('ctaLink')];
  const authoredLink = linkCell?.querySelector('a');
  const href = authoredLink?.getAttribute('href') || linkCell?.textContent.trim() || '#';

  const link = document.createElement('a');
  link.className = 'herobanner-cta';
  link.href = href;
  link.append(
    createTextElement('span', 'herobanner-cta-text', text),
    createTextElement('span', 'herobanner-cta-arrow', '→'),
  );
  link.querySelector('.herobanner-cta-arrow').setAttribute('aria-hidden', 'true');
  return link;
}

function createAuthor(fields) {
  const name = getText(fields, 'author');
  const role = getText(fields, 'role');
  if (!name && !role) return null;

  const author = document.createElement('footer');
  author.className = 'herobanner-author';
  if (name) author.append(createTextElement('p', 'herobanner-author-name', name));
  if (role) author.append(createTextElement('p', 'herobanner-author-role', role));
  return author;
}

function createBackground(fields) {
  const background = document.createElement('div');
  background.className = 'herobanner-background';
  background.setAttribute('aria-hidden', 'true');

  const cell = fields[normalizeFieldName('backgroundImage')];
  if (!cell) return background;

  const existing = cell.querySelector('picture, img');
  const a = cell.querySelector('a');
  let src = null;
  if (!existing) {
    src = a ? a.getAttribute('href') : cell.textContent.trim();
  }

  let media = null;
  if (existing) {
    media = existing.closest('picture') || existing;
  } else if (src) {
    const picture = document.createElement('picture');
    const img = document.createElement('img');
    img.src = src;
    img.alt = '';
    img.loading = 'eager';
    picture.append(img);
    media = picture;
  }

  if (media) {
    media.classList.add('herobanner-background-image');
    (media.matches('img') ? media : media.querySelector('img'))?.setAttribute('alt', '');
    background.append(media);
  }

  return background;
}

export default function decorate(block) {
  block.classList.add('herobanner');
  const fields = getFields(block);
  const hero = document.createElement('section');
  hero.className = 'herobanner-hero';
  hero.setAttribute('aria-label', 'Research report');

  const content = document.createElement('div');
  content.className = 'herobanner-content';

  const meta = createMeta(fields);
  if (meta.children.length > 0) content.append(meta);

  const publication = getText(fields, 'publishDate');
  if (publication) {
    content.append(createTextElement('p', 'herobanner-publication', publication));
  }

  const heading = createHeading(fields);
  if (heading) content.append(heading);

  const subtitle = createSubtitle(fields);
  if (subtitle) content.append(subtitle);

  const cta = createCallToAction(fields);
  if (cta) content.append(cta);

  const author = createAuthor(fields);
  if (author) content.append(author);

  hero.append(createBackground(fields), content);
  block.replaceChildren(hero);
}
