import { createOptimizedPicture } from '../../scripts/aem.js';

/* eslint-disable */
export function decorateButtons(...buttons) {
  return buttons
    .map((div) => {
      const a = div.querySelector('a');
      if (a) {
        a.classList.add('button');
        if (a.parentElement.tagName === 'EM') {
          a.classList.add('secondary');
        }

        if (a.parentElement.tagName === 'STRONG') {
          a.classList.add('primary');
        }

        a.classList.add('teaser-cta');
        return a.outerHTML;
      }
      return '';
    })
    .join('');
}

export function generateTeaserDOM(props, classes) {
  // Extract properties, always same order as in model, empty string if not set
  const [pictureContainer, eyebrow, title, longDescr, shortDescr, firstCta, secondCta] = props;
  const picture = pictureContainer.querySelector('picture');

  // if (picture) {
  //   const pictureSrc = picture.querySelector('img').src;
  //   const optimizedPicture = createOptimizedPicture(pictureSrc, '', false, [{ width: '1360' }]);
  //   pictureContainer.textContent = '';
  //   pictureContainer.appendChild(optimizedPicture);
  // }

  const image = picture?.querySelector('img');

  if (image?.src) {
    const optimizedPicture = createOptimizedPicture(
      image.src,
      image.alt || '',
      false,
      [{ width: '1360' }],
    );

    pictureContainer.textContent = '';
    pictureContainer.appendChild(optimizedPicture);
  }

  const hasShortDescr = shortDescr.textContent.trim() !== '';

  // Build DOM: .background holds the image, .foreground holds .text + .spacer
  const teaserDOM = document.createRange().createContextualFragment(`
    <div class="background">
      ${picture ? picture.outerHTML : ''}
    </div>
    <div class="foreground">
      <div class="text">
        ${eyebrow.textContent.trim() !== ''
      ? `<p class="eyebrow">${eyebrow.textContent.trim().toUpperCase()}</p>`
      : ''
    }
        <div class="title">${title.innerHTML}</div>
        <div class="long-description">${longDescr.innerHTML}</div>
        ${hasShortDescr ? `<div class="short-description">${shortDescr.innerHTML}</div>` : ''}
        <div class="cta">${decorateButtons(firstCta, secondCta)}</div>
      </div>
      <div class="spacer"></div>
    </div>
  `);

  // set the mobile/desktop background color from the tcs-background-* variant class
  const backgroundColor = [...classes].find((cls) => cls.startsWith('tcs-background-'));
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
    teaserDOM
      .querySelector('.foreground')
      .style.setProperty(
        '--teaser-background-color',
        `var(--${colorName}, var(--tcs-background-${colorName}, ${fallbackColor}))`,
      );
  }

  // return final teaser DOM, used as child component
  return teaserDOM;
}

export default function decorate(block) {
  console.log('====================');
  console.log('BLOCK');
  console.log(block);

  console.log('====================');
  console.log('BLOCK DATASET');
  console.log(block.dataset);

  console.log('====================');
  console.log('BLOCK CLASSES');
  console.log([...block.classList]);

  console.log('====================');
  console.log('BLOCK OUTER HTML');
  console.log(block.outerHTML);

  console.log('====================');
  console.log('BLOCK INNER HTML');
  console.log(block.innerHTML);

  const props = [...block.children].map((row) => row.firstElementChild);

  console.log('====================');
  console.log('PROPS');
  console.log(props);

  console.log('====================');
  console.log('PROP VALUES');
  props.forEach((prop, index) => {
    console.log(`PROP ${index + 1}`, prop?.outerHTML);
  });

  console.log('====================');
  console.log('TYPOGRAPHY VALUES');
  console.log('titleFontFamily:', block.dataset.titleFontFamily);
  console.log('titleFontSize:', block.dataset.titleFontSize);
  console.log('descriptionFontFamily:', block.dataset.descriptionFontFamily);
  console.log('descriptionFontSize:', block.dataset.descriptionFontSize);

  const teaserDOM = generateTeaserDOM(props, block.classList);

  block.textContent = '';
  block.append(teaserDOM);

  const typographyClasses = [
    block.dataset.titleFontFamily,
    block.dataset.titleFontSize,
    block.dataset.descriptionFontFamily,
    block.dataset.descriptionFontSize,
  ];

  console.log('====================');
  console.log('TYPOGRAPHY CLASSES TO APPLY');
  console.log(typographyClasses);

  typographyClasses
    .filter(Boolean)
    .forEach((cls) => {
      console.log('ADDING CLASS:', cls);
      block.classList.add(cls);
    });

  console.log('====================');
  console.log('FINAL BLOCK CLASSES');
  console.log([...block.classList]);

}