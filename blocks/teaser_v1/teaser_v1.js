import { createOptimizedPicture } from '../../scripts/aem.js';

const SUPPORTED_VARIANTS = [
  'default',
  'horizontal',
  'horizontal-reverse',
  'overlay',
  'featured',
  'compact',
];

function asText(value) {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  const text = value.textContent || '';
  return text.trim();
}

function getCellValue(cell) {
  if (!cell) {
    return '';
  }

  if (cell.querySelector) {
    const anchor = cell.querySelector('a');
    if (anchor) {
      return anchor.getAttribute('href') || anchor.textContent.trim();
    }

    const image = cell.querySelector('picture img, img');
    if (image) {
      return image.getAttribute('src') || image.getAttribute('data-src') || '';
    }
  }

  if (cell.href) {
    return cell.href;
  }

  return asText(cell);
}

function normalizeVariant(value) {
  const normalized = (value || 'default')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');

  return SUPPORTED_VARIANTS.includes(normalized) ? normalized : 'default';
}

function normalizeBlock(block) {
  const data = {
    variant: 'default',
    image: '',
    title: '',
    description: '',
    ctaLabel: '',
    ctaLink: '',
  };

  if (!block || !block.children) {
    return data;
  }

  [...block.children].forEach((row) => {
    const cells = [...row.children || []];
    if (cells.length < 2) {
      return;
    }

    const key = asText(cells[0]).toLowerCase();
    const value = cells[1];
    const textValue = asText(value);

    switch (key) {
      case 'variant':
      case 'layout style':
      case 'layout-style':
        data.variant = textValue || data.variant;
        break;
      case 'image':
        data.image = getCellValue(value) || data.image;
        break;
      case 'title':
        data.title = textValue || data.title;
        break;
      case 'description':
        data.description = textValue || data.description;
        break;
      case 'cta label':
      case 'cta-label':
        data.ctaLabel = textValue || data.ctaLabel;
        break;
      case 'cta link':
      case 'cta-link':
        data.ctaLink = getCellValue(value) || data.ctaLink;
        break;
      default:
        break;
    }
  });

  return data;
}

function createElement(tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;

  if (text) {
    element.textContent = text;
  }

  return element;
}

function createCTA(label, link) {
  if (!label || !link) {
    return null;
  }

  const cta = createElement('a', 'teaser__cta', label);
  cta.href = link;
  cta.setAttribute('aria-label', label);

  if (/^https?:\/\//i.test(link)) {
    cta.target = '_blank';
    cta.rel = 'noopener noreferrer';
  }

  return cta;
}

function createImage(data) {
  if (!data.image) {
    return null;
  }

  const imageWrapper = createElement('div', 'teaser__image');
  const picture = createOptimizedPicture(
    data.image,
    data.title || 'Teaser image',
    false,
    [{ width: '750' }, { width: '1200' }],
  );

  const image = picture.querySelector('img');
  if (image) {
    image.loading = 'lazy';
    image.decoding = 'async';
    image.setAttribute('alt', data.title || 'Teaser image');
  }

  imageWrapper.append(picture);
  return imageWrapper;
}

function createContent(data) {
  const content = createElement('div', 'teaser__content');

  if (data.title) {
    content.append(createElement('h2', 'teaser__title', data.title));
  }

  if (data.description) {
    content.append(createElement('p', 'teaser__description', data.description));
  }

  const cta = createCTA(data.ctaLabel, data.ctaLink);
  if (cta) {
    content.append(cta);
  }

  return content;
}

export default async function decorate(block) {
  const data = normalizeBlock(block);
  const variant = normalizeVariant(data.variant);

  if (!data.title && !data.description && !data.image) {
    block.remove();
    return;
  }

  block.textContent = '';

  const article = document.createElement('article');
  article.className = `teaser teaser--${variant}`;
  article.setAttribute('aria-label', data.title || 'Teaser content');

  const image = createImage(data);
  const content = createContent(data);

  if (image) {
    article.append(image);
  }

  article.append(content);
  block.append(article);
}
