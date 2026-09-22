import { createOptimizedPicture } from '../../scripts/aem.js';

const SUPPORTED_VARIANTS = [
  'default',
  'horizontal',
  'horizontal-reverse',
  'overlay',
  'featured',
  'compact',
];

// function getValue(row) {
//   if (!row) {
//     return '';
//   }

//   const cells = [...row.children];

//   if (cells.length > 1) {
//     return cells[1];
//   }

//   return cells[0];
// }

function normalizeBlock(block) {
  const rows = [...block.children];

  const data = {};

  rows.forEach((row) => {
    const cols = [...row.children];

    if (cols.length < 2) {
      return;
    }

    const key = cols[0].textContent.trim().toLowerCase();

    switch (key) {
      case 'variant':
        data.variant = cols[1].textContent.trim();
        break;

      case 'image':
        data.image = cols[1].querySelector('picture img')?.src
          || cols[1].querySelector('img')?.src
          || cols[1].textContent.trim();
        break;

      case 'title':
        data.title = cols[1].textContent.trim();
        break;

      case 'description':
        data.description = cols[1].textContent.trim();
        break;

      case 'cta label':
        data.ctaLabel = cols[1].textContent.trim();
        break;

      case 'cta link':
        data.ctaLink = cols[1].textContent.trim();
        break;

      default:
        break;
    }
  });

  return data;
}

function createCTA(ctaLabel, ctaLink) {
  if (!ctaLabel || !ctaLink) {
    return '';
  }

  //   const isExternal = /^https?:\/\//i.test(ctaLink);

  return `
    ${ctaLink}
      ${ctaLabel}
    </a>
  `;
}

export default async function decorate(block) {
  const data = normalizeBlock(block);

  const variantRaw = (data.variant || 'default')
    .toLowerCase()
    .replace(/\s+/g, '-');

  const variant = SUPPORTED_VARIANTS.includes(variantRaw)
    ? variantRaw
    : 'default';

  if (!data.title && !data.description && !data.image) {
    block.remove();
    return;
  }

  block.textContent = '';

  const article = document.createElement('article');
  article.className = `teaser teaser--${variant}`;

  const imageDiv = document.createElement('div');
  imageDiv.className = 'teaser__image';

  if (data.image) {
    imageDiv.append(
      createOptimizedPicture(
        data.image,
        data.title || 'Teaser Image',
        false,
        [
          { width: '750' },
          { width: '1200' },
        ],
      ),
    );
  }

  const contentDiv = document.createElement('div');
  contentDiv.className = 'teaser__content';

  contentDiv.innerHTML = `
    ${data.title ? `<h2 class="teaser__title">${data.title}</h2>` : ''}
    ${data.description ? `<p class="teaser__description">${data.description}</p>` : ''}
    ${createCTA(data.ctaLabel, data.ctaLink)}
  `;

  article.append(imageDiv, contentDiv);

  block.append(article);
}
