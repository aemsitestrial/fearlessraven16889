import { createOptimizedPicture } from '../../scripts/aem.js';

function asText(cell) {
  return cell?.textContent?.trim() || '';
}

function getLink(cell) {
  const anchor = cell?.querySelector('a');

  if (!anchor) {
    return '';
  }

  return anchor.href || anchor.textContent.trim();
}

function createButton(text, href, isPrimary = true) {
  if (!text || !href) {
    return '';
  }

  return `
    ${href}
      ${text}
    </a>
  `;
}

export default function decorate(block) {
  const rows = [...block.children];
  const cells = rows.map((row) => row.firstElementChild || row);

  const [
    eyebrowCell,
    titleCell,
    descriptionCell,
    imageCell,
    primaryTextCell,
    primaryLinkCell,
    secondaryTextCell,
    secondaryLinkCell,
  ] = cells;

  const eyebrow = asText(eyebrowCell);
  const title = titleCell?.innerHTML || '';
  const description = descriptionCell?.innerHTML || '';

  const primaryCtaText = asText(primaryTextCell);
  const primaryCtaLink = getLink(primaryLinkCell) || asText(primaryLinkCell);

  const secondaryCtaText = asText(secondaryTextCell);
  const secondaryCtaLink = getLink(secondaryLinkCell) || asText(secondaryLinkCell);

  const picture = imageCell?.querySelector('picture');

  let imageMarkup = '';

  if (picture) {
    const src = picture.querySelector('img')?.src;

    if (src) {
      const optimizedPicture = createOptimizedPicture(
        src,
        '',
        false,
        [{ width: '1600' }],
      );

      imageMarkup = optimizedPicture.outerHTML;
    }
  }

  const heroDOM = document.createRange().createContextualFragment(`
    ${imageMarkup ? `
      <div class="header-background">
        ${imageMarkup}
      </div>
    ` : ''}

    <div class="header-content">

      ${
        eyebrow
          ? `<p class="header-eyebrow">${eyebrow.toUpperCase()}</p>`
          : ''
      }

      ${
        title
          ? `<div class="header-title">${title}</div>`
          : ''
      }

      ${
        description
          ? `<div class="header-description">${description}</div>`
          : ''
      }

      ${
        primaryCtaText || secondaryCtaText
          ? `
            <div class="header-actions">
              ${
                createButton(
                  primaryCtaText,
                  primaryCtaLink,
                  true,
                )
              }
              ${
                createButton(
                  secondaryCtaText,
                  secondaryCtaLink,
                  false,
                )
              }
            </div>
          `
          : ''
      }

    </div>
  `);

  block.textContent = '';
  block.append(heroDOM);
}