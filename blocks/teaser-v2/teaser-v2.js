import { createOptimizedPicture } from '../../scripts/aem.js';

export function decorateButtons(...buttons) {
  return buttons
    .filter(Boolean)
    .map((div, index) => {
      const a = div.tagName === 'A' ? div : div.querySelector('a');
      if (a) {
        a.classList.add('button', 'teaser-cta');
        if (a.parentElement?.tagName === 'EM') {
          a.classList.add('secondary');
        } else if (a.parentElement?.tagName === 'STRONG') {
          a.classList.add('primary');
        } else if (!a.classList.contains('secondary') && !a.classList.contains('primary')) {
          a.classList.add(index === 0 ? 'primary' : 'secondary');
        }
        return a.outerHTML;
      }
      return '';
    })
    .filter(Boolean)
    .join('');
}

function extractProps(props) {
  if (!Array.isArray(props)) {
    return {
      pictureContainer: null,
      eyebrow: null,
      title: null,
      longDescr: null,
      shortDescr: null,
      firstCta: null,
      secondCta: null,
      typographyTokens: [],
    };
  }

  // If 11 or more rows are passed (legacy order where rows 4-7 are typography tokens)
  if (props.length >= 11) {
    return {
      pictureContainer: props[0],
      eyebrow: props[1],
      title: props[2],
      longDescr: props[3],
      typographyTokens: [props[4], props[5], props[6], props[7]],
      shortDescr: props[8],
      firstCta: props[9],
      secondCta: props[10],
    };
  }

  // Standard 7-row EDS / DA order
  return {
    pictureContainer: props[0] || null,
    eyebrow: props[1] || null,
    title: props[2] || null,
    longDescr: props[3] || null,
    shortDescr: props[4] || null,
    firstCta: props[5] || null,
    secondCta: props[6] || null,
    typographyTokens: [],
  };
}

export function generateTeaserDOM(props, classes) {
  const {
    pictureContainer,
    eyebrow,
    title,
    longDescr,
    shortDescr,
    firstCta,
    secondCta,
  } = extractProps(props);

  let pictureHtml = '';
  const existingPicture = pictureContainer?.querySelector('picture');
  const image = existingPicture?.querySelector('img') || pictureContainer?.querySelector('img');

  if (image?.src) {
    const optimizedPicture = createOptimizedPicture(
      image.src,
      image.alt || '',
      false,
      [{ media: '(min-width: 900px)', width: '2000' }, { width: '750' }],
    );
    pictureHtml = optimizedPicture.outerHTML;
  } else if (existingPicture) {
    pictureHtml = existingPicture.outerHTML;
  }

  const eyebrowText = eyebrow?.textContent?.trim() || '';
  const titleHtml = title?.innerHTML?.trim() || '';
  const longDescrHtml = longDescr?.innerHTML?.trim() || '';
  const shortDescrText = shortDescr?.textContent?.trim() || '';
  const shortDescrHtml = shortDescr?.innerHTML?.trim() || '';
  const hasShortDescr = shortDescrText !== '' && shortDescrHtml !== '';
  const buttonsHtml = decorateButtons(firstCta, secondCta);

  // Build DOM: .background holds the picture, .foreground holds .text + .spacer
  const teaserDOM = document.createRange().createContextualFragment(`
    <div class="background">
      ${pictureHtml}
    </div>
    <div class="foreground">
      <div class="text">
        ${eyebrowText ? `<p class="eyebrow">${eyebrowText.toUpperCase()}</p>` : ''}
        ${titleHtml ? `<div class="title">${titleHtml}</div>` : ''}
        ${longDescrHtml ? `<div class="long-description">${longDescrHtml}</div>` : ''}
        ${hasShortDescr ? `<div class="short-description">${shortDescrHtml}</div>` : ''}
        ${buttonsHtml ? `<div class="cta">${buttonsHtml}</div>` : ''}
      </div>
      <div class="spacer"></div>
    </div>
  `);

  // Set the background color custom property from any tcs-background-* variant class
  const classList = Array.from(classes || []);
  const backgroundColor = classList.find((cls) => cls.startsWith('tcs-background-'));
  if (backgroundColor) {
    const colorName = backgroundColor.substring('tcs-background-'.length);
    const colorMap = {
      red: '#eb1c24',
      yellow: '#ffcc00',
      blue: '#0076a8',
      beige: '#f5f0eb',
      black: '#111111',
    };
    const fallbackColor = colorMap[colorName] || colorName;
    const fg = teaserDOM.querySelector('.foreground');
    if (fg) {
      fg.style.setProperty(
        '--teaser-background-color',
        `var(--${colorName}, var(--tcs-background-${colorName}, ${fallbackColor}))`,
      );
    }
  }

  return teaserDOM;
}

export default function decorate(block) {
  const props = [...block.children].map((row) => row.firstElementChild);
  const { typographyTokens } = extractProps(props);

  // Normalize 3x3 alignment alias classes
  const matrixAliases = {
    'center-left': 'middle-left',
    'center-center': 'middle-center',
    'center-right': 'middle-right',
    'position-top-left': 'top-left',
    'position-top-center': 'top-center',
    'position-top-right': 'top-right',
    'position-middle-left': 'middle-left',
    'position-middle-center': 'middle-center',
    'position-middle-right': 'middle-right',
    'position-bottom-left': 'bottom-left',
    'position-bottom-center': 'bottom-center',
    'position-bottom-right': 'bottom-right',
  };

  Object.entries(matrixAliases).forEach(([alias, target]) => {
    if (block.classList.contains(alias)) {
      block.classList.add(target);
    }
  });

  const teaserDOM = generateTeaserDOM(props, block.classList);
  block.textContent = '';
  block.append(teaserDOM);

  // Extract and apply typography variant classes from dataset or validated props
  const typoPattern = /^(title-font-|title-size-|desc-font-|desc-size-)/;
  const datasetTypo = [
    block.dataset.titleFontFamily,
    block.dataset.titleFontSize,
    block.dataset.descriptionFontFamily,
    block.dataset.descriptionFontSize,
  ];

  const tokenTypo = typographyTokens
    .map((token) => token?.textContent?.trim())
    .filter((token) => token && typoPattern.test(token));

  [...datasetTypo, ...tokenTypo]
    .filter(Boolean)
    .forEach((cls) => {
      block.classList.add(cls);
    });
}
