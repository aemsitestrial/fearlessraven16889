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
 * Parses block data supporting both EDS key-value rows and Universal Editor properties.
 */
function readBlockData(block) {
  const data = {};

  [...block.children].forEach((row) => {
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
        const text = cell.textContent.trim();
        if (text.toLowerCase() === 'true') {
          data[key] = true;
        } else if (text.toLowerCase() === 'false') {
          data[key] = false;
        } else if (!Number.isNaN(Number(text)) && text !== '') {
          data[key] = Number(text);
        } else {
          data[key] = cell.innerHTML.trim();
        }
      }
    } else if (cells.length === 1) {
      const picture = cells[0].querySelector('picture');
      if (picture && !data.imagePicture) {
        data.imagePicture = picture;
      }
    }
  });

  block.querySelectorAll('[data-aue-prop]').forEach((el) => {
    const prop = el.getAttribute('data-aue-prop');
    const key = normalizeKey(prop);
    if (!data[key]) {
      if (key === 'image') {
        data.imagePicture = el.querySelector('picture') || el.querySelector('img');
      } else {
        data[key] = el.innerHTML.trim();
      }
    }
  });

  return data;
}

/**
 * Apply authored classes.
 */
function applyClasses(block, data) {
  const classes = ['teaser-v1'];

  if (data.teaserType && data.teaserType !== 'default') {
    classes.push(data.teaserType);
  }

  const bgColor = data.backgroundColor;
  if (bgColor && bgColor !== 'default') {
    classes.push(bgColor);
  }

  const sectionType = data.sectionType || 'curated';
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

  if (data.motionType && data.motionType !== 'none') {
    classes.push(data.motionType);
  }

  block.classList.add(...classes);
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
  if (!hideTitle && data.title) {
    const headingTag = data.titleType || 'h2';
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
  if (data.viewAllLink && data.viewAllText) {
    ctasList.push({
      title: data.viewAllText.replace(/<[^>]*>?/gm, '').trim(),
      link: data.viewAllLink.replace(/<[^>]*>?/gm, '').trim(),
      style: 'primary',
    });
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
  console.log('BLOCK', block);
  console.log('DATASET', block.dataset);
  console.log('ATTRIBUTES', [...block.attributes].map(a => ({
    name: a.name,
    value: a.value,
  })));
  console.log('TEASER DATA', data);
  applyClasses(block, data);

  const sectionType = (data.sectionType || data.sectiontype || 'curated').toLowerCase().trim();

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
