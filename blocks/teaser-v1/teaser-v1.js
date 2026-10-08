import { createOptimizedPicture } from '../../scripts/aem.js';
import {
  getDecision,
  getTargetConfig,
  sendPropositionDisplay,
  setPersonalizationAttributes,
} from '../../scripts/target-personalization.js';

const INDEX_SOURCES = ['/query-index.json', '/sitemap.json'];

function formatDate(dateValue, format = 'MMM d, yyyy') {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  if (Number.isNaN(date.valueOf())) return dateValue;

  const monthsShort = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const day = String(date.getDate()).padStart(2, '0');
  const monthNum = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const monthName = monthsShort[date.getMonth()];

  const fmt = (format || '').toLowerCase();
  if (fmt.includes('dd-mm-yyyy')) return `${day}-${monthNum}-${year}`;
  if (fmt.includes('mm-dd-yyyy')) return `${monthNum}-${day}-${year}`;
  return `${monthName} ${date.getDate()}, ${year}`;
}

function getItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

async function loadIndex() {
  const responses = await Promise.all(
    INDEX_SOURCES.map(async (source) => {
      try {
        const response = await fetch(source);
        return response.ok ? response.json() : null;
      } catch (error) {
        return null;
      }
    }),
  );
  const data = responses.find(Boolean);
  return data ? getItems(data) : [];
}

/**
 * Normalizes property keys to standard camelCase
 */
function normalizeKey(str) {
  return str
    .trim()
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^(.)/, (c) => c.toLowerCase());
}

/**
 * Applies default values for teaser-v1 properties as defined in the component model.
 */
function applyDefaults(data) {
  if (data.sectionType === undefined) data.sectionType = 'curated';
  if (data.personalizationEnabled === undefined) data.personalizationEnabled = false;
  if (data.fallbackToCurated === undefined) data.fallbackToCurated = true;
  if (data.teaserType === undefined) data.teaserType = 'default';
  if (data.backgroundColor === undefined) data.backgroundColor = 'default';
  if (data.motionType === undefined) data.motionType = 'none';
  if (data.titleType === undefined) data.titleType = 'h2';
  if (data.showEyebrow === undefined) data.showEyebrow = true;
  if (data.hideTitle === undefined) data.hideTitle = false;
  if (data.showDescription === undefined) data.showDescription = true;
  if (data.hideImage === undefined) data.hideImage = false;
  if (data.showDate === undefined) data.showDate = false;
  if (data.displayTags === undefined) data.displayTags = false;
  if (data.dateFormat === undefined) data.dateFormat = 'mmm-d-yyyy';
  if (data.dynamicLimit === undefined) data.dynamicLimit = 3;
  if (data.cta1Style === undefined) data.cta1Style = 'primary';
  if (data.cta2Style === undefined) data.cta2Style = 'primary';
}

/**
 * Extracts property value from an element based on key type.
 */
function extractValue(key, el) {
  if (key === 'image' || key === 'filereference') {
    const pic = el.querySelector('picture') || el.closest('picture') || (el.tagName === 'PICTURE' ? el : null);
    const img = el.querySelector('img') || (el.tagName === 'IMG' ? el : null);
    return {
      picture: pic || img?.closest('picture') || null,
      src: img?.getAttribute('src') || el.textContent.trim(),
    };
  }

  const text = el.textContent.trim();
  const lower = text.toLowerCase();
  if (lower === 'true') return true;
  if (lower === 'false') return false;

  if (key === 'dynamicLimit' || (text !== '' && !Number.isNaN(Number(text)) && /^\d+$/.test(text))) {
    return Number(text);
  }

  if (key === 'description' || key === 'shortDescription') {
    return el.innerHTML.trim();
  }

  const a = el.querySelector('a');
  if (
    a
    && (
      key === 'viewAllLink'
      || key === 'cta1Link'
      || key === 'cta2Link'
    )
  ) {
    return a.getAttribute('href') || a.textContent.trim();
  }

  return text;
}

/**
 * Parses block data supporting Universal Editor instrumentation, EDS 2-column key-value rows,
 * and 1-column positional authoring.
 */
function readBlockData(block) {
  const data = {};

  // 1. Check Universal Editor instrumentation attributes (data-aue-prop)
  const ueElements = [...block.querySelectorAll('[data-aue-prop]')];
  if (block.hasAttribute('data-aue-prop')) {
    ueElements.unshift(block);
  }

  if (ueElements.length > 0) {
    ueElements.forEach((el) => {
      const prop = el.getAttribute('data-aue-prop');
      const key = normalizeKey(prop);
      if (data[key] !== undefined) return;

      const val = extractValue(key, el);
      if (key === 'image' || key === 'filereference') {
        data.imagePicture = val.picture;
        data.image = val.src;
      } else {
        data[key] = val;
      }
    });

    const authoredLinks = [
      ...block.querySelectorAll('.button-container a'),
    ];

    let linkIndex = 0;

    if (data.viewAllText && authoredLinks[linkIndex]) {
      data.viewAllLink = data.viewAllLink
        || authoredLinks[linkIndex].getAttribute('href');
      linkIndex += 1;
    }

    if (data.cta1Title && authoredLinks[linkIndex]) {
      data.cta1Link = data.cta1Link
        || authoredLinks[linkIndex].getAttribute('href');
      linkIndex += 1;
    }

    if (data.cta2Title && authoredLinks[linkIndex]) {
      data.cta2Link = data.cta2Link
        || authoredLinks[linkIndex].getAttribute('href');
    }

    if (!Array.isArray(data.links)) {
      data.links = [];
    }
    if (data.cta1Title && data.cta1Link) {
      data.links.push({
        title: data.cta1Title,
        link: data.cta1Link,
        style: data.cta1Style || 'primary',
      });
    }
    if (data.cta2Title && data.cta2Link) {
      data.links.push({
        title: data.cta2Title,
        link: data.cta2Link,
        style: data.cta2Style || 'primary',
      });
    }

    applyDefaults(data);
    return data;
  }

  // 2. Check EDS 2-column key-value format (| Key | Value |)
  const rows = [...block.children];
  const isKeyValue = rows.some((row) => row.children.length >= 2);
  if (isKeyValue) {
    rows.forEach((row) => {
      const cells = [...row.children];
      if (cells.length >= 2) {
        const keyRaw = cells[0].textContent.trim();
        const key = normalizeKey(keyRaw);
        const cell = cells[1];

        const picture = cell.querySelector('picture');
        const links = [...cell.querySelectorAll('a')];

        if (key === 'image' || key === 'filereference') {
          data.imagePicture = picture || cell.querySelector('img');
          data.image = cell.querySelector('img')?.getAttribute('src') || cell.textContent.trim();
        } else if (key === 'links' || key === 'cta' || key === 'ctas') {
          data.links = links.map((a) => {
            let style = 'primary';
            if (a.parentElement?.tagName === 'EM') style = 'secondary';
            if (a.parentElement?.tagName === 'STRONG') style = 'primary';
            if (a.classList.contains('secondary')) style = 'secondary';
            return {
              title: a.textContent.trim(),
              link: a.getAttribute('href') || '#',
              style,
            };
          });
        } else {
          data[key] = extractValue(key, cell);
        }
      }
    });

    if (!Array.isArray(data.links)) {
      data.links = [];
    }
    if (data.cta1Title && data.cta1Link) {
      data.links.push({
        title: data.cta1Title,
        link: data.cta1Link,
        style: data.cta1Style || 'primary',
      });
    }
    if (data.cta2Title && data.cta2Link) {
      data.links.push({
        title: data.cta2Title,
        link: data.cta2Link,
        style: data.cta2Style || 'primary',
      });
    }

    applyDefaults(data);
    return data;
  }

  // 3. Single-column positional format (when neither UE nor 2-column format is present)
  const fieldOrder = [
    'sectionType',
    'personalizationEnabled',
    'audienceSegment',
    'fallbackToCurated',
    'teaserType',
    'backgroundColor',
    'motionType',
    'eyebrow',
    'title',
    'titleType',
    'description',
    'shortDescription',
    'image',
    'imageAlt',
    'showEyebrow',
    'hideTitle',
    'showDescription',
    'hideImage',
    'showDate',
    'displayTags',
    'dateFormat',
    'dynamicSource',
    'dynamicTag',
    'dynamicLimit',
    'viewAllText',
    'viewAllLink',
    'cta1Title',
    'cta1Link',
    'cta1Style',
    'cta2Title',
    'cta2Link',
    'cta2Style',
  ];

  const cells = rows.map((row) => (row.children.length > 0 ? row.children[0] : row));

  if (cells.length === fieldOrder.length) {
    cells.forEach((cell, index) => {
      const key = fieldOrder[index];
      const val = extractValue(key, cell);
      if (key === 'image') {
        data.imagePicture = cell.querySelector('picture') || null;
        data.image = cell.querySelector('img')?.getAttribute('src') || cell.textContent.trim();
      } else {
        data[key] = val;
      }
    });
  } else {
    // Dynamic content-type classification when optional/empty fields are omitted
    let remainingCells = [...cells];

    // Find image cell
    const imgIndex = remainingCells.findIndex((c) => {
      if (c.querySelector('picture, img')) return true;
      const text = c.textContent.trim();
      return (
        /\.(avif|webp|jpe?g|png|svg)(\?.*)?$/i.test(text)
        || /urn:aaid:aem:/i.test(text)
        || /\/adobe\/assets\//i.test(text)
        || /\/content\/dam\/.*\.(avif|webp|jpe?g|png|svg)/i.test(text)
      );
    });
    if (imgIndex !== -1) {
      const imgCell = remainingCells.splice(imgIndex, 1)[0];
      data.imagePicture = imgCell.querySelector('picture') || null;
      data.image = imgCell.querySelector('img')?.getAttribute('src') || imgCell.textContent.trim();
    }

    // Extract CTAs / Links
    const ctaLinks = [];
    remainingCells = remainingCells.filter((c) => {
      const a = c.querySelector('a');
      const txt = c.textContent.trim();
      if (a) {
        ctaLinks.push({
          title: txt,
          link: a ? a.getAttribute('href') : txt,
          style: 'primary',
        });
        return false;
      }
      return true;
    });
    if (ctaLinks.length) {
      data.links = ctaLinks;
    }

    // Classify config keywords vs content
    const contentTextCells = [];
    remainingCells.forEach((c) => {
      const txt = c.textContent.trim();
      const lower = txt.toLowerCase();

      if (lower === 'curated' || lower === 'dynamic') {
        data.sectionType = lower;
      } else if (['default', 'right-image', 'no-image'].includes(lower)) {
        data.teaserType = lower;
      } else if (['grey', 'dark'].includes(lower)) {
        data.backgroundColor = lower;
      } else if (['fade-in', 'slide-up', 'zoom-in'].includes(lower)) {
        data.motionType = lower;
      } else if (/^h[1-6]$/i.test(lower)) {
        data.titleType = lower;
      } else if (['dd-mm-yyyy', 'mm-dd-yyyy', 'mmm-d-yyyy'].includes(lower)) {
        data.dateFormat = lower;
      } else if (!Number.isNaN(Number(lower)) && lower !== '') {
        data.dynamicLimit = Number(lower);
      } else if (['primary', 'secondary', 'list', 'text'].includes(lower)) {
        // CTA style token
        if (data.links && data.links[0] && !data.cta1Style) {
          data.cta1Style = lower;
          data.links[0].style = lower;
        } else if (data.links && data.links[1]) {
          data.cta2Style = lower;
          data.links[1].style = lower;
        }
      } else if (lower === 'true' || lower === 'false') {
        // Handled below or kept as boolean
      } else if (txt) {
        contentTextCells.push(c);
      }
    });

    // Assign text content cells: title is first text, description is second
    if (contentTextCells.length === 1) {
      data.title = contentTextCells[0].textContent.trim();
    } else if (contentTextCells.length >= 2) {
      data.title = contentTextCells[0].textContent.trim();
      data.description = contentTextCells[1].innerHTML.trim();
      if (contentTextCells.length >= 3) {
        data.shortDescription = contentTextCells[2].innerHTML.trim();
      }
    }
  }

  if (!Array.isArray(data.links)) {
    data.links = [];
  }
  if (data.cta1Title && data.cta1Link) {
    data.links.push({
      title: data.cta1Title,
      link: data.cta1Link,
      style: data.cta1Style || 'primary',
    });
  }

  if (data.cta2Title && data.cta2Link) {
    data.links.push({
      title: data.cta2Title,
      link: data.cta2Link,
      style: data.cta2Style || 'primary',
    });
  }

  applyDefaults(data);
  return data;
}

/**
 * Apply authored classes.
 */
function applyClasses(block, data) {
  const classes = ['teaser-v1'];

  if (typeof data.teaserType === 'string' && data.teaserType && data.teaserType !== 'default') {
    classes.push(data.teaserType.trim());
  }

  const bgColor = data.backgroundColor;
  if (typeof bgColor === 'string' && bgColor && bgColor !== 'default') {
    classes.push(bgColor.trim());
  }

  const sectionType = typeof data.sectionType === 'string' ? data.sectionType.trim() : 'curated';
  classes.push(`source-${sectionType}`);

  if (data.hideImage === true || data.hideImage === 'true') {
    classes.push('hide-image');
  }

  if (data.hideTitle === true || data.hideTitle === 'true') {
    classes.push('hide-title');
  }

  if (data.showDescription === false || data.showDescription === 'false') {
    classes.push('hide-description');
  }

  if (data.showEyebrow === false || data.showEyebrow === 'false') {
    classes.push('hide-eyebrow');
  }

  if (typeof data.motionType === 'string' && data.motionType && data.motionType !== 'none') {
    classes.push(data.motionType.trim());
  }

  const safeClasses = classes.filter((cls) => typeof cls === 'string' && /^[a-zA-Z0-9-_]+$/.test(cls.trim()));
  block.classList.add(...safeClasses);
}

function createCTA(link) {
  const anchor = document.createElement('a');
  anchor.href = link.link || '#';
  anchor.textContent = link.title || '';

  const style = link.style || 'primary';
  anchor.classList.add('teaser-cta', `teaser-cta-${style}`);
  return anchor;
}

function createCTAs(links = []) {
  if (!links || !links.length) return null;

  const wrapper = document.createElement('div');
  wrapper.className = 'teaser-ctas';

  links.forEach((link) => {
    if (link) wrapper.append(createCTA(link));
  });

  return wrapper;
}

function renderImageElement(data) {
  if (data.hideImage === true || data.hideImage === 'true') return null;

  const imageContainer = document.createElement('div');
  imageContainer.className = 'teaser-image';

  if (data.imagePicture) {
    const existingPic = data.imagePicture.cloneNode(true);
    imageContainer.append(existingPic);
    return imageContainer;
  }

  if (data.image) {
    const cleanSrc = data.image.replace(/<[^>]*>?/gm, '').trim();
    if (cleanSrc) {
      const pic = createOptimizedPicture(cleanSrc, data.imageAlt || data.title || 'Teaser image', false, [{ width: '800' }]);
      imageContainer.append(pic);
      return imageContainer;
    }
  }

  return null;
}

function createViewAll(viewAllData) {
  if (!viewAllData.viewAllText || !viewAllData.viewAllLink) {
    return null;
  }

  const link = document.createElement('a');
  link.className = 'teaser-view-all';
  link.href = viewAllData.viewAllLink;
  link.textContent = viewAllData.viewAllText;

  return link;
}

function renderContent(data) {
  const wrapper = document.createElement('div');
  wrapper.className = 'teaser-content';

  const showEyebrow = data.showEyebrow !== false && data.showEyebrow !== 'false';
  if (showEyebrow && data.eyebrow) {
    const eyebrow = document.createElement('p');
    eyebrow.className = 'teaser-eyebrow';
    eyebrow.textContent = data.eyebrow.replace(/<[^>]*>?/gm, '').trim();
    wrapper.append(eyebrow);
  }

  const hideTitle = data.hideTitle === true || data.hideTitle === 'true';
  if (!hideTitle && data.title && typeof data.title === 'string') {
    const validHeadingTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    const headingTag = (typeof data.titleType === 'string' && validHeadingTags.includes(data.titleType.toLowerCase()))
      ? data.titleType.toLowerCase()
      : 'h2';
    const heading = document.createElement(headingTag);
    heading.className = 'teaser-title';
    heading.textContent = data.title.replace(/<[^>]*>?/gm, '').trim();
    wrapper.append(heading);
  }

  const showDate = data.showDate === true || data.showDate === 'true';
  if (showDate && (data.date || data.lastModified)) {
    const dateEl = document.createElement('div');
    dateEl.className = 'teaser-date';
    dateEl.textContent = formatDate(data.date || data.lastModified, data.dateFormat);
    wrapper.append(dateEl);
  }

  const showDescription = data.showDescription !== false && data.showDescription !== 'false';
  if (showDescription && (data.description || data.shortDescription)) {
    const descEl = document.createElement('div');
    descEl.className = 'teaser-description';
    descEl.innerHTML = data.description || data.shortDescription;
    wrapper.append(descEl);
  }

  const ctasList = Array.isArray(data.links) ? [...data.links] : [];

  const viewAll = createViewAll(data);

  if (viewAll) {
    wrapper.append(viewAll);
  }

  const ctas = createCTAs(ctasList);
  if (ctas) {
    wrapper.append(ctas);
  }

  return wrapper;
}

function renderCurated(data) {
  const outerWrapper = document.createElement('div');
  outerWrapper.className = 'teaser-wrapper';

  const imageEl = renderImageElement(data);
  if (imageEl) outerWrapper.append(imageEl);

  const bodyEl = document.createElement('div');
  bodyEl.className = 'teaser-body';
  bodyEl.append(renderContent(data));
  outerWrapper.append(bodyEl);

  return outerWrapper;
}

async function renderDynamic(data) {
  try {
    const indexItems = await loadIndex();
    if (!indexItems.length) {
      return renderCurated(data);
    }

    const tagFilter = (data.dynamicTag || '').toLowerCase().trim();
    const sourcePath = (data.dynamicSource || '').toLowerCase().trim();

    let matches = indexItems;

    if (sourcePath) {
      matches = matches.filter((item) => (item.path || '').toLowerCase().startsWith(sourcePath));
    }

    if (tagFilter) {
      matches = matches.filter((item) => {
        const tags = (item.tags || '').toLowerCase();
        return tags.includes(tagFilter);
      });
    }

    const targetItem = matches[0];
    if (!targetItem) {
      return renderCurated(data);
    }

    const dynamicData = {
      ...data,
      title: data.title || targetItem.title,
      description: data.description || targetItem.description,
      image: targetItem.image || data.image,
      lastModified: targetItem.lastModified,
      links: (data.links && data.links.length) ? data.links : [
        {
          title: data.viewAllText || 'Read More',
          link: targetItem.path || '#',
          style: 'primary',
        },
      ],
    };

    return renderCurated(dynamicData);
  } catch (error) {
    return renderCurated(data);
  }
}

async function renderPersonalization(block, data) {
  const targetConfig = getTargetConfig('teaserv1');
  const decision = await getDecision(targetConfig);

  if (!decision || !decision.data) {
    setPersonalizationAttributes(block, true, 'fallback');
    return renderCurated(data);
  }

  const audience = (data.audienceSegment || '').toLowerCase().trim();
  const decisionPersona = (decision.data.persona || '').toLowerCase().trim();

  if (audience && decisionPersona && audience !== decisionPersona) {
    setPersonalizationAttributes(block, true, 'fallback');
    return renderCurated(data);
  }

  const personalizedData = {
    ...data,
    title: decision.data.title || data.title,
    description: decision.data.description || data.description,
    image: decision.data.image || data.image,
    links: decision.data.links || data.links,
  };

  const rendered = renderCurated(personalizedData);
  setPersonalizationAttributes(block, true, 'personalized', decision.data.persona);
  await sendPropositionDisplay(decision);
  return rendered;
}

export default async function decorate(block) {
  const data = readBlockData(block);
  applyClasses(block, data);

  const sectionType = typeof data.sectionType === 'string'
    ? data.sectionType.toLowerCase().trim()
    : 'curated';

  let content;
  if (sectionType === 'dynamic') {
    if (data.personalizationEnabled) {
      content = await renderPersonalization(block, data);
    } else {
      content = await renderDynamic(data);
    }
  }
  if (sectionType === 'curated' || !content) {
    content = renderCurated(data);
  }

  block.textContent = '';
  if (content) {
    block.append(content);
  }
}
