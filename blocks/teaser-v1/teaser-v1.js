import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';
import {
  getDecision,
  getTargetConfig,
  sendPropositionDisplay,
  setPersonalizationAttributes,
} from '../../scripts/target-personalization.js';

const FIELD_ORDER = [
  'eyebrow',
  'title',
  'titleType',
  'description',
  'shortDescription',
  'backgroundImage',
  'viewAllText',
  'viewAllLink',
  'style',
  'personalizationEnabled',
  'backgroundColor',
  'imagePosition',
  'showEyebrow',
  'hideTitle',
  'showDescription',
  'hideImage',
  'showDate',
  'date',
  'dateFormat',
  'displayTags',
  'tags',
];

const VALID_HEADING_TAGS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
];

const VALID_LINK_STYLES = [
  'default',
  'list',
  'primary',
  'secondary',
];

const CONFIGURATION_CLASSES = [
  'no-image-right-desc-links',
  'grey',
  'image-left',
  'image-right',
  'hide-image',
  'hide-title',
  'hide-description',
  'hide-eyebrow',
  'personalized',
];

function normalizeKey(value = '') {
  return value
    .trim()
    .replace(/[-_\s]+(.)?/g, (_, character) => (
      character ? character.toUpperCase() : ''
    ))
    .replace(/^(.)/, (character) => character.toLowerCase());
}

function parseBoolean(value, defaultValue = false) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalizedValue = value.trim().toLowerCase();

    if (normalizedValue === 'true') {
      return true;
    }

    if (normalizedValue === 'false') {
      return false;
    }
  }

  return defaultValue;
}

function stripHtml(value = '') {
  const element = document.createElement('div');
  element.innerHTML = String(value);
  return element.textContent.trim();
}

function getAnchorHref(element) {
  if (!element) {
    return '';
  }

  const anchor = element.matches?.('a')
    ? element
    : element.querySelector('a');

  return anchor?.getAttribute('href') || '';
}

function extractValue(key, element) {
  if (!element) {
    return '';
  }

  if (
    key === 'image'
    || key === 'backgroundImage'
    || key === 'arrowIcon'
    || key === 'fileReference'
    || key === 'filereference'
  ) {
    const image = element.matches?.('img')
      ? element
      : element.querySelector('img');

    const picture = element.matches?.('picture')
      ? element
      : element.closest('picture')
      || element.querySelector('picture')
      || image?.closest('picture');

    return {
      picture: picture || null,
      src: image?.getAttribute('src')
        || element.textContent.trim(),
    };
  }

  if (
    key === 'viewAllLink'
    || key === 'link'
    || key === 'ctaLink'
  ) {
    return getAnchorHref(element)
      || element.textContent.trim();
  }

  if (
    key === 'description'
    || key === 'shortDescription'
  ) {
    return element.innerHTML.trim();
  }

  const text = element.textContent.trim();
  const normalizedText = text.toLowerCase();

  if (normalizedText === 'true') {
    return true;
  }

  if (normalizedText === 'false') {
    return false;
  }

  return text;
}

function applyDefaults(data) {
  return {
    titleType: 'h2',
    style: 'default',
    personalizationEnabled: false,
    backgroundColor: 'default',
    imagePosition: 'right',
    showEyebrow: true,
    hideTitle: false,
    showDescription: true,
    hideImage: false,
    showDate: false,
    dateFormat: 'mmm-d-yyyy',
    displayTags: false,
    ...data,
  };
}

function isTeaserLinkItem(element) {
  return Boolean(element) && (
    element.dataset?.aueComponent === 'teaser-v1-cta'
    || element.dataset?.aueModel === 'cta'
    || element.dataset?.blockName === 'teaser-v1-cta'
    || element.classList?.contains('teaser-v1-cta')
  );
}

function isTeaserImageItem(element) {
  return Boolean(element) && (
    element.dataset?.aueComponent === 'teaser-v1-image'
    || element.dataset?.aueModel === 'teaser-v1-image'
    || element.dataset?.blockName === 'teaser-v1-image'
    || element.classList?.contains('teaser-v1-image')
  );
}

function isTeaserChildItem(element) {
  return isTeaserLinkItem(element) || isTeaserImageItem(element);
}

function getClosestTeaserChildItem(element, block) {
  let current = element;

  while (current && current !== block) {
    if (isTeaserChildItem(current)) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

function getTeaserLinkItems(block) {
  const componentItems = [
    ...block.querySelectorAll(
      '[data-aue-component="teaser-v1-cta"], '
      + '[data-block-name="teaser-v1-cta"], '
      + '.teaser-v1-cta',
    ),
  ];

  if (componentItems.length) {
    return [...new Set(componentItems)];
  }

  return [
    ...block.querySelectorAll('[data-aue-model="cta"]'),
  ];
}

function getTeaserImageItems(block) {
  return [
    ...block.querySelectorAll(
      '[data-aue-component="teaser-v1-image"], '
      + '[data-aue-model="teaser-v1-image"], '
      + '[data-block-name="teaser-v1-image"], '
      + '.teaser-v1-image',
    ),
  ].filter((item, index, items) => (
    items.indexOf(item) === index
  ));
}

function getTeaserChildItems(block) {
  return [
    ...new Set([
      ...getTeaserLinkItems(block),
      ...getTeaserImageItems(block),
    ]),
  ];
}

function getParentPropertyRows(block) {
  const childItems = new Set(getTeaserChildItems(block));

  return [...block.children].filter((child) => {
    if (isTeaserChildItem(child) || childItems.has(child)) {
      return false;
    }

    return ![...childItems].some((item) => child.contains(item));
  });
}

function parseNamedProperties(block) {
  const data = {};

  block.querySelectorAll('[data-aue-prop]').forEach((element) => {
    if (getClosestTeaserChildItem(element, block)) {
      return;
    }

    const property = element.getAttribute('data-aue-prop');

    if (!property) {
      return;
    }

    const key = normalizeKey(property);

    if (data[key] !== undefined) {
      return;
    }

    const value = extractValue(key, element);

    if (key === 'backgroundImage') {
      data.backgroundImage = value.src;
      data.backgroundImagePicture = value.picture;
    } else {
      data[key] = value;
    }
  });

  return data;
}

function getSemanticPropertyRows(block) {
  const rows = getParentPropertyRows(block);
  const headingRow = rows.find((row) => row.querySelector(
    'h1, h2, h3, h4, h5, h6',
  ));
  const headingIndex = rows.indexOf(headingRow);
  const descriptionRow = rows.find((row, index) => (
    index > headingIndex && row.querySelector('p')
  ));

  return {
    headingRow,
    heading: headingRow?.querySelector('h1, h2, h3, h4, h5, h6'),
    descriptionRow,
  };
}

function parseSemanticProperties(block, existingData) {
  const data = { ...existingData };
  const {
    heading,
    descriptionRow,
  } = getSemanticPropertyRows(block);

  if (heading) {
    if (!data.title) {
      data.title = heading.textContent.trim();
    }

    if (!data.titleType) {
      data.titleType = heading.tagName.toLowerCase();
    }
  }

  if (descriptionRow && !data.description) {
    data.description = descriptionRow.innerHTML.trim();
  }

  return data;
}

function parsePositionalProperties(block, existingData) {
  const data = { ...existingData };
  const semanticRows = getSemanticPropertyRows(block);
  const rows = getParentPropertyRows(block).filter((row) => (
    !Object.values(semanticRows).includes(row)
    && !row.querySelector('[data-aue-prop]')
  ));
  const semanticFields = new Set([
    'title',
    'titleType',
    'description',
  ]);
  const fields = FIELD_ORDER.filter((key) => (
    !semanticFields.has(key) && data[key] === undefined
  ));
  let rowIndex = 0;

  fields.forEach((key) => {
    const row = rows[rowIndex];

    if (!row) {
      return;
    }

    const valueElement = row.children[0] || row;
    const value = extractValue(key, valueElement);

    rowIndex += 1;

    if (key === 'backgroundImage') {
      if (value?.src) {
        data.backgroundImage = value.src;
        data.backgroundImagePicture = value.picture;
      }
    } else if (
      value !== ''
      && value !== null
      && value !== undefined
    ) {
      data[key] = value;
    }
  });

  return data;
}

function getTopLevelRow(element, block) {
  let current = element;

  while (current?.parentElement && current.parentElement !== block) {
    current = current.parentElement;
  }

  return current?.parentElement === block ? current : null;
}

function findNextParentLink(block, propertyName) {
  const propertyElement = [...block.querySelectorAll(
    `[data-aue-prop="${propertyName}"]`,
  )].find((element) => !getClosestTeaserChildItem(element, block));

  if (!propertyElement) {
    return '';
  }

  const propertyRow = getTopLevelRow(propertyElement, block);

  if (!propertyRow) {
    return '';
  }

  let nextRow = propertyRow.nextElementSibling;

  while (nextRow) {
    if (!isTeaserChildItem(nextRow)) {
      const anchor = [...nextRow.querySelectorAll('a')]
        .find((item) => !getClosestTeaserChildItem(item, block));

      if (anchor) {
        return anchor.getAttribute('href') || '';
      }

      const namedProperty = nextRow.querySelector('[data-aue-prop]');
      const name = namedProperty?.getAttribute('data-aue-prop');

      if (name === 'viewAllText') {
        break;
      }
    }

    nextRow = nextRow.nextElementSibling;
  }
  return '';
}

function assignViewAllLinkFromDom(data, block) {
  const nextData = { ...data };

  if (nextData.viewAllText) {
    const viewAllLink = findNextParentLink(block, 'viewAllText');

    if (viewAllLink) {
      nextData.viewAllLink = viewAllLink;
    }
  }

  return nextData;
}

function resolveLinkStyle(linkType, fallbackStyle) {
  if (
    typeof linkType === 'string'
    && VALID_LINK_STYLES.includes(linkType)
    && linkType !== 'default'
  ) {
    return linkType;
  }

  if (
    typeof fallbackStyle === 'string'
    && VALID_LINK_STYLES.includes(fallbackStyle)
  ) {
    return fallbackStyle;
  }

  return 'default';
}

function normalizeLinks(
  links,
  fallbackStyle = 'default',
  authoredLinks = [],
) {
  if (!Array.isArray(links)) {
    return [];
  }

  return links
    .filter((item) => item?.title && item?.link)
    .map((item, index) => {
      const authoredLink = authoredLinks[index];

      return {
        title: stripHtml(item.title),
        link: String(item.link).trim(),
        style: resolveLinkStyle(
          item.linkType || item.style,
          authoredLink?.style || fallbackStyle,
        ),
        target:
          item.target
          || item.linkTarget
          || authoredLink?.target
          || 'default',
        shape:
          item.shape
          || authoredLink?.shape
          || 'rectangle',
        backgroundColor:
          item.backgroundColor
          || authoredLink?.backgroundColor
          || '',
        textColor:
          item.textColor
          || authoredLink?.textColor
          || '',
        borderColor:
          item.borderColor
          || authoredLink?.borderColor
          || '',
        arrowIcon:
          item.arrowIcon
          || authoredLink?.arrowIcon
          || '',
        arrowDirection:
          item.arrowDirection
          || authoredLink?.arrowDirection
          || 'none',
        arrowColor:
          item.arrowColor
          || authoredLink?.arrowColor
          || 'white',
        instrumentation:
          authoredLink?.instrumentation || null,
      };
    });
}

function readChildItemRows(item) {
  return [...item.children].map((row) => (
    row.children[0] || row
  ));
}

function readTeaserLinkItem(item, fallbackStyle = 'default') {
  const data = {};
  const instrumentation = {
    item,
    title: null,
    link: null,
  };

  item.querySelectorAll('[data-aue-prop]').forEach((element) => {
    const property = element.getAttribute('data-aue-prop');

    if (!property) {
      return;
    }

    const propertyKey = normalizeKey(property);
    const key = {
      textCta: 'title',
      ctaLink: 'link',
      ctaView: 'linkType',
      linkTarget: 'target',
    }[propertyKey] || propertyKey;
    if (key === 'title' || key === 'link') {
      instrumentation[key] = element;
    }

    if (data[key] === undefined) {
      data[key] = extractValue(key, element);
    }
  });

  const rows = readChildItemRows(item);
  const rowFields = [
    'textCta',
    'ctaLink',
    'arrowIcon',
    'linkTarget',
    'ctaView',
    'shape',
    'backgroundColor',
    'textColor',
    'borderColor',
    'arrowDirection',
    'arrowColor',
  ];

  rows.forEach((row, index) => {
    const propertyKey = rowFields[index];
    const key = {
      textCta: 'title',
      ctaLink: 'link',
      ctaView: 'linkType',
      linkTarget: 'target',
    }[propertyKey] || propertyKey;

    if (key === 'title' || key === 'link') {
      instrumentation[key] ||= row;
    }

    if (!key || data[key] !== undefined) {
      return;
    }

    const value = extractValue(key, row);

    if (
      value !== ''
      && value !== undefined
      && value !== null
    ) {
      data[key] = value;
    }
  });

  const title = typeof data.title === 'string'
    ? stripHtml(data.title).trim()
    : '';

  let link = typeof data.link === 'string'
    ? data.link.trim()
    : '';

  if (!link) {
    link = item.querySelector('a')?.getAttribute('href') || '';
  }

  if (!title || !link) {
    return {
      title: title || 'CTA',
      link: link || '#',
      style: 'default',
      target: 'default',
      shape: 'rectangle',
      backgroundColor: '',
      textColor: '',
      borderColor: '',
      arrowIcon: '',
      arrowDirection: 'none',
      arrowColor: 'white',
      instrumentation,
      incomplete: true,
    };
  }

  const renderedStyle = [...item.classList]
    .find((className) => (
      className.startsWith('teaser-cta-')
      || className.startsWith('cta-view-')
    ))
    ?.replace(/^(teaser-cta-|cta-view-)/, '');

  return {
    title,
    link,
    style: resolveLinkStyle(
      data.linkType || renderedStyle,
      fallbackStyle,
    ),
    target: data.target,
    shape: data.shape || 'rectangle',
    backgroundColor: data.backgroundColor || '',
    textColor: data.textColor || '',
    borderColor: data.borderColor || '',
    arrowIcon: data.arrowIcon?.src || data.arrowIcon || '',
    arrowDirection: data.arrowDirection || 'none',
    arrowColor: data.arrowColor || 'white',
    instrumentation,
  };
}

function readTeaserLinkItems(block, fallbackStyle = 'default') {
  return getTeaserLinkItems(block)
    .map((item) => readTeaserLinkItem(item, fallbackStyle))
    .filter(Boolean);
}

function readTeaserImageItem(item) {
  const data = {
    image: '',
    imageAlt: '',
    imagePicture: null,
    imageInstrumentation: {
      item,
      image: null,
      imageAlt: null,
    },
  };

  item.querySelectorAll('[data-aue-prop]').forEach((element) => {
    const property = normalizeKey(
      element.getAttribute('data-aue-prop') || '',
    );

    if (property === 'image' && !data.image) {
      const value = extractValue('image', element);
      data.image = value.src;
      data.imagePicture = value.picture;
      data.imageInstrumentation.image = element;
    } else if (property === 'imageAlt' && !data.imageAlt) {
      data.imageAlt = extractValue('imageAlt', element);
      data.imageInstrumentation.imageAlt = element;
    }
  });

  const rows = readChildItemRows(item);
  ['image', 'imageAlt'].forEach((key, index) => {
    if (data[key]) {
      return;
    }

    const row = rows[index];
    if (!row) {
      return;
    }

    if (key === 'image') {
      const value = extractValue(key, row);
      data.image = value.src;
      data.imagePicture = value.picture;
      data.imageInstrumentation.image = row;
    } else {
      data.imageAlt = extractValue(key, row);
      data.imageInstrumentation.imageAlt = row;
    }
  });

  const image = item.querySelector('picture img, img');
  if (!data.image && image) {
    data.image = image.getAttribute('src') || '';
    data.imagePicture = image.closest('picture');
    data.imageInstrumentation.image = image;
  }
  if (!data.imageAlt && image) {
    data.imageAlt = image.getAttribute('alt') || '';
    data.imageInstrumentation.imageAlt = image;
  }

  return data;
}

function normalizeConfiguration(data) {
  const normalizedData = { ...data };

  const validStyles = [
    'default',
    'no-image-right-desc-links',
  ];

  const validBackgroundColors = [
    'default',
    'grey',
  ];

  const validImagePositions = [
    'left',
    'right',
  ];

  const validDateFormats = [
    'dd-mm-yyyy',
    'mm-dd-yyyy',
    'mmm-d-yyyy',
  ];

  if (!validStyles.includes(normalizedData.style)) {
    normalizedData.style = 'default';
  }

  if (!validBackgroundColors.includes(normalizedData.backgroundColor)) {
    normalizedData.backgroundColor = 'default';
  }

  if (!validImagePositions.includes(normalizedData.imagePosition)) {
    normalizedData.imagePosition = 'right';
  }

  if (!validDateFormats.includes(normalizedData.dateFormat)) {
    normalizedData.dateFormat = 'mmm-d-yyyy';
  }

  normalizedData.personalizationEnabled = parseBoolean(
    normalizedData.personalizationEnabled,
    false,
  );

  normalizedData.showEyebrow = parseBoolean(
    normalizedData.showEyebrow,
    true,
  );

  normalizedData.hideTitle = parseBoolean(
    normalizedData.hideTitle,
    false,
  );

  normalizedData.showDescription = parseBoolean(
    normalizedData.showDescription,
    true,
  );

  normalizedData.hideImage = parseBoolean(
    normalizedData.hideImage,
    false,
  );

  normalizedData.showDate = parseBoolean(
    normalizedData.showDate,
    false,
  );

  normalizedData.displayTags = parseBoolean(
    normalizedData.displayTags,
    false,
  );

  return normalizedData;
}

function readBlockData(block) {
  let data = parseSemanticProperties(
    block,
    parseNamedProperties(block),
  );

  data = parsePositionalProperties(block, data);
  data.images = getTeaserImageItems(block)
    .map(readTeaserImageItem)
    .filter(Boolean);
  data = assignViewAllLinkFromDom(data, block);
  data = applyDefaults(data);
  data = normalizeConfiguration(data);

  data.links = readTeaserLinkItems(block, 'default');

  return data;
}

function formatDate(dateValue, format = 'mmm-d-yyyy') {
  if (!dateValue) {
    return '';
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.valueOf())) {
    return dateValue;
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  const monthName = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ][date.getMonth()];

  switch (String(format).toLowerCase()) {
    case 'dd-mm-yyyy':
      return `${day}-${month}-${year}`;

    case 'mm-dd-yyyy':
      return `${month}-${day}-${year}`;

    case 'mmm-d-yyyy':
    default:
      return `${monthName} ${date.getDate()}, ${year}`;
  }
}

function applyClasses(block, data) {
  const classes = [];

  block.classList.remove(...CONFIGURATION_CLASSES);

  if (
    typeof data.style === 'string'
    && data.style === 'no-image-right-desc-links'
  ) {
    classes.push(data.style);
  }

  if (
    typeof data.backgroundColor === 'string'
    && data.backgroundColor === 'grey'
  ) {
    classes.push(data.backgroundColor);
  }

  if (
    typeof data.imagePosition === 'string'
    && ['left', 'right'].includes(data.imagePosition)
    && data.style !== 'no-image-right-desc-links'
  ) {
    classes.push(`image-${data.imagePosition}`);
  }

  if (
    data.hideImage
    || data.style === 'no-image-right-desc-links'
  ) {
    classes.push('hide-image');
  }

  if (data.hideTitle) {
    classes.push('hide-title');
  }

  if (!data.showDescription) {
    classes.push('hide-description');
  }

  if (!data.showEyebrow) {
    classes.push('hide-eyebrow');
  }

  if (data.personalizationEnabled) {
    classes.push('personalized');
  }

  block.classList.add(...classes);
}

function createCTAArrow(arrowIcon, direction, color) {
  const source = typeof arrowIcon === 'string'
    ? arrowIcon
    : arrowIcon?.src;

  if (!source || !['left', 'right'].includes(direction)) {
    return null;
  }

  const arrow = document.createElement('img');

  arrow.src = source;
  arrow.alt = '';
  arrow.className = `teaser-cta-arrow teaser-cta-arrow-${direction} teaser-cta-arrow-${color}`;
  arrow.setAttribute('aria-hidden', 'true');
  arrow.decoding = 'async';

  arrow.addEventListener('error', () => {
    arrow.remove();
  });

  return arrow;
}

function createCTA(link) {
  if (!link?.title || !link?.link) {
    return null;
  }

  const anchor = document.createElement('a');
  let childWrapper = null;
  const style = resolveLinkStyle(link.style, 'default');

  anchor.href = link.link;
  anchor.classList.add(
    'teaser-cta',
    `teaser-cta-${style}`,
    `teaser-cta-shape-${link.shape}`,
  );

  if (link.instrumentation?.item) {
    childWrapper = document.createElement('div');
    childWrapper.className = 'teaser-v1-cta teaser-cta-item';
    moveInstrumentation(link.instrumentation.item, childWrapper);
  }

  if (link.backgroundColor) {
    anchor.style.backgroundColor = link.backgroundColor;
  }

  if (link.textColor) {
    anchor.style.color = link.textColor;
  }

  if (link.borderColor) {
    anchor.style.borderColor = link.borderColor;
  }

  if (link.incomplete) {
    childWrapper?.classList.add('is-incomplete');
  }

  const label = document.createElement('span');
  label.className = 'teaser-cta-label';
  label.textContent = link.title;

  if (link.instrumentation?.title) {
    moveInstrumentation(link.instrumentation.title, label);
  }

  if (link.instrumentation?.link) {
    moveInstrumentation(link.instrumentation.link, anchor);
  }

  if (link.target === 'new-window') {
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  }

  const arrow = createCTAArrow(
    link.arrowIcon,
    link.arrowDirection,
    link.arrowColor,
  );

  if (arrow && link.arrowDirection === 'left') {
    anchor.append(arrow);
  }

  anchor.append(label);

  if (arrow && link.arrowDirection === 'right') {
    anchor.append(arrow);
  }

  if (childWrapper) {
    childWrapper.append(anchor);
    return childWrapper;
  }

  return anchor;
}

function createCTAs(links = []) {
  if (!links.length) {
    return null;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'teaser-ctas';

  links.forEach((link) => {
    const anchor = createCTA(link);

    if (anchor) {
      wrapper.append(anchor);
    }
  });

  return wrapper.children.length ? wrapper : null;
}

function createViewAll(data) {
  const text = typeof data.viewAllText === 'string'
    ? data.viewAllText.trim()
    : '';

  const href = typeof data.viewAllLink === 'string'
    ? data.viewAllLink.trim()
    : '';

  if (
    !text
    || !href
    || text === 'true'
    || text === 'false'
    || href === 'true'
    || href === 'false'
    || VALID_LINK_STYLES.includes(text)
  ) {
    return null;
  }

  const anchor = document.createElement('a');

  anchor.className = 'teaser-view-all';
  anchor.href = href;
  anchor.textContent = stripHtml(text);

  return anchor;
}

function createTags(data) {
  if (!parseBoolean(data.displayTags)) {
    return null;
  }

  const values = Array.isArray(data.tags)
    ? data.tags
    : String(data.tags || '').split(',');
  const tags = values
    .map((tag) => stripHtml(tag).trim())
    .filter(Boolean);

  if (!tags.length) {
    return null;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'teaser-tags';

  tags.forEach((tag) => {
    const element = document.createElement('span');
    element.className = 'teaser-tag';
    element.textContent = tag;
    wrapper.append(element);
  });

  return wrapper;
}

function renderImageItem(imageData) {
  const imageContainer = document.createElement('div');
  imageContainer.className = 'teaser-image teaser-v1-image';

  if (imageData.imageInstrumentation?.item) {
    moveInstrumentation(
      imageData.imageInstrumentation.item,
      imageContainer,
    );
  }

  const altText = stripHtml(
    imageData.imageAlt || 'Teaser image',
  );

  if (imageData.imagePicture) {
    const picture = imageData.imagePicture.cloneNode(true);
    const image = picture.querySelector('img');

    if (image) {
      image.alt = altText;

      if (imageData.imageInstrumentation?.image) {
        moveInstrumentation(
          imageData.imageInstrumentation.image,
          image,
        );
      }
    }

    imageContainer.append(picture);
    return imageContainer;
  }

  if (!imageData.image) {
    imageContainer.classList.add('is-empty');

    const placeholder = document.createElement('span');
    placeholder.className = 'teaser-image-placeholder';
    placeholder.textContent = 'Select an image';

    imageContainer.append(placeholder);
    return imageContainer;
  }

  const picture = createOptimizedPicture(
    stripHtml(imageData.image).trim(),
    altText,
    false,
    [{ width: '800' }],
  );

  const image = picture.querySelector('img');

  if (image && imageData.imageInstrumentation?.image) {
    moveInstrumentation(
      imageData.imageInstrumentation.image,
      image,
    );
  }

  imageContainer.append(picture);
  return imageContainer;
}

function renderImages(data) {
  if (!Array.isArray(data.images) || !data.images.length) {
    return null;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'teaser-images';

  data.images.forEach((imageData) => {
    wrapper.append(renderImageItem(imageData));
  });

  return wrapper;
}

function renderContent(data) {
  const wrapper = document.createElement('div');
  wrapper.className = 'teaser-content';

  if (
    parseBoolean(data.showEyebrow, true)
    && data.eyebrow
  ) {
    const eyebrow = document.createElement('p');
    eyebrow.className = 'teaser-eyebrow';
    eyebrow.textContent = stripHtml(data.eyebrow);
    wrapper.append(eyebrow);
  }

  if (!parseBoolean(data.hideTitle) && data.title) {
    const requestedTag = String(data.titleType).toLowerCase();
    const headingTag = VALID_HEADING_TAGS.includes(requestedTag)
      ? requestedTag
      : 'h2';

    const heading = document.createElement(headingTag);
    heading.className = 'teaser-title';
    heading.textContent = stripHtml(data.title);
    wrapper.append(heading);
  }

  if (
    parseBoolean(data.showDate)
    && (data.date || data.lastModified)
  ) {
    const date = document.createElement('div');
    date.className = 'teaser-date';
    date.textContent = formatDate(
      data.date || data.lastModified,
      data.dateFormat,
    );

    wrapper.append(date);
  }

  if (
    parseBoolean(data.showDescription, true)
    && (data.description || data.shortDescription)
  ) {
    if (data.description) {
      const description = document.createElement('div');
      description.className = 'teaser-description';
      description.innerHTML = data.description;
      wrapper.append(description);
    }

    if (data.shortDescription) {
      const shortDescription = document.createElement('div');
      shortDescription.className = 'teaser-short-description';
      shortDescription.innerHTML = data.shortDescription;
      wrapper.append(shortDescription);
    }
  }

  const tags = createTags(data);

  if (tags) {
    wrapper.append(tags);
  }

  const ctas = createCTAs(data.links);

  if (ctas) {
    wrapper.append(ctas);
  }

  const viewAll = createViewAll(data);

  if (viewAll) {
    wrapper.append(viewAll);
  }

  return wrapper;
}

function renderTeaser(data) {
  const wrapper = document.createElement('div');
  wrapper.className = 'teaser-wrapper';

  const images = renderImages(data);

  if (images) {
    wrapper.append(images);
  }

  const body = document.createElement('div');
  body.className = 'teaser-body';
  body.append(renderContent(data));

  wrapper.append(body);
  return wrapper;
}

async function renderPersonalized(block, data) {
  try {
    const targetConfig = getTargetConfig('teaser-v1');
    const decision = await getDecision(targetConfig);

    if (!decision?.data) {
      setPersonalizationAttributes(
        block,
        true,
        'fallback',
      );

      return renderTeaser(data);
    }

    const personalizedImage = decision.data.image || '';

    const personalizedData = {
      ...data,
      eyebrow: decision.data.eyebrow || data.eyebrow,
      title: decision.data.title || data.title,
      description:
        decision.data.description || data.description,
      shortDescription:
        decision.data.shortDescription
        || data.shortDescription,
      images: personalizedImage
        ? [
          {
            image: personalizedImage,
            imageAlt:
              decision.data.imageAlt
              || data.images?.[0]?.imageAlt
              || '',
            imagePicture: null,
            imageInstrumentation:
              data.images?.[0]?.imageInstrumentation || null,
          },
          ...((data.images || []).slice(1)),
        ]
        : data.images,
      links: Array.isArray(decision.data.links)
        ? normalizeLinks(
          decision.data.links,
          'default',
          data.links,
        )
        : data.links,
    };

    setPersonalizationAttributes(
      block,
      true,
      'personalized',
      decision.data.persona,
    );

    await sendPropositionDisplay(decision);

    return renderTeaser(personalizedData);
  } catch (error) {
    setPersonalizationAttributes(
      block,
      true,
      'fallback',
    );

    return renderTeaser(data);
  }
}

function createBackground(data) {
  if (!data.backgroundImage && !data.backgroundImagePicture) {
    return null;
  }

  const background = document.createElement('div');
  background.className = 'teaser-background';
  background.setAttribute('aria-hidden', 'true');

  if (data.backgroundImagePicture) {
    const picture = data.backgroundImagePicture.cloneNode(true);
    const image = picture.querySelector('img');

    if (image) {
      image.alt = '';
    }

    background.append(picture);
    return background;
  }

  const image = document.createElement('img');
  image.src = data.backgroundImage;
  image.alt = '';
  image.decoding = 'async';

  image.addEventListener('error', () => {
    background.remove();
  });

  background.append(image);
  return background;
}

export default async function decorate(block) {
  const data = readBlockData(block);

  applyClasses(block, data);

  const content = parseBoolean(data.personalizationEnabled)
    ? await renderPersonalized(block, data)
    : renderTeaser(data);

  const background = createBackground(data);

  if (background) {
    block.replaceChildren(background, content);
  } else {
    block.replaceChildren(content);
  }
}
