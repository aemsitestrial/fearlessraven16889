import { createOptimizedPicture } from '../../scripts/aem.js';

export function decorateButtons(...buttons) {
  return buttons
    .filter(Boolean)
    .map((div, index) => {
      const a = div.tagName === 'A' ? div : div.querySelector('a');
      if (a) {
        a.classList.add(
          'button',
          'teaser-cta',
          index === 0 ? 'cta-one' : 'cta-two',
        );
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

  const typoPattern = /^(title-font-|title-size-|desc-font-|desc-size-)/;
  const isTypoToken = (el) => {
    const text = el?.textContent?.trim() || '';
    return typoPattern.test(text);
  };

  const isAnchorContainer = (el) => Boolean(el?.querySelector('a') || el?.tagName === 'A');

  // If authored with typography token rows mixed in (e.g., 8-11 rows)
  const typographyTokens = props.filter(isTypoToken);
  const contentProps = props.filter((prop) => !isTypoToken(prop));

  // If longDescr is just a typography string that leaked through, suppress it
  const rawLongDescr = contentProps[3] || null;
  const longDescr = (rawLongDescr && !isTypoToken(rawLongDescr)) ? rawLongDescr : null;

  // Find CTA elements dynamically (rows that contain <a> links)
  const ctaCandidates = contentProps.filter(isAnchorContainer);
  const nonCtaContent = contentProps.filter((prop) => !isAnchorContainer(prop));

  const pictureContainer = nonCtaContent[0] || null;
  const eyebrow = nonCtaContent[1] || null;
  const title = nonCtaContent[2] || null;
  const shortDescr = nonCtaContent[4] || null;

  const firstCta = ctaCandidates[0] || contentProps[5] || null;
  const secondCta = ctaCandidates[1] || contentProps[6] || null;

  return {
    pictureContainer,
    eyebrow,
    title,
    longDescr,
    shortDescr,
    firstCta,
    secondCta,
    typographyTokens,
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
