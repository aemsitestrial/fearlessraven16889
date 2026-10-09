import { createOptimizedPicture } from '../../scripts/aem.js';
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
  'image',
  'imageAlt',
  'description',
  'shortDescription',
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
  'dateFormat',
  'displayTags',
  'multiLinksEnabled',
  'primaryCtaTitle',
  'primaryCtaLink',
  'primaryCtaLinkType',
  'secondaryCtaTitle',
  'secondaryCtaLink',
  'secondaryCtaLinkType',
  'linkStyle',
];

const LINK_ITEM_FIELD_ORDER = [
  'title',
  'link',
  'linkType',
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
    || key === 'primaryCtaLink'
    || key === 'secondaryCtaLink'
    || key === 'link'
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
    imagePosition: 'left',
    showEyebrow: true,
    hideTitle: false,
    showDescription: true,
    hideImage: false,
    showDate: false,
    dateFormat: 'mmm-d-yyyy',
    displayTags: false,
    multiLinksEnabled: false,
    primaryCtaLinkType: 'list',
    secondaryCtaLinkType: 'list',
    linkStyle: 'list',
    ...data,
  };
}

function isTeaserLinkItem(element) {
  return Boolean(element) && (
    element.dataset?.aueComponent === 'teaser-v1-link'
    || element.dataset?.aueModel === 'teaser-v1-link'
    || element.dataset?.blockName === 'teaser-v1-link'
    || element.classList?.contains('teaser-v1-link')
  );
}

function getClosestTeaserLinkItem(element, block) {
  let current = element;

  while (current && current !== block) {
    if (isTeaserLinkItem(current)) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

function getTeaserLinkItems(block) {
  const directItems = [...block.children].filter(isTeaserLinkItem);

  if (directItems.length) {
    return directItems;
  }

  return [
    ...block.querySelectorAll(
      '[data-aue-component="teaser-v1-link"], '
      + '[data-aue-model="teaser-v1-link"], '
      + '[data-block-name="teaser-v1-link"], '
      + '.teaser-v1-link',
    ),
  ].filter((item, index, items) => items.indexOf(item) === index);
}

function getParentPropertyRows(block) {
  const childItems = new Set(getTeaserLinkItems(block));

  return [...block.children].filter((child) => {
    if (isTeaserLinkItem(child) || childItems.has(child)) {
      return false;
    }

    return ![...childItems].some((item) => child.contains(item));
  });
}

function parseNamedProperties(block) {
  const data = {};

  block.querySelectorAll('[data-aue-prop]').forEach((element) => {
    if (getClosestTeaserLinkItem(element, block)) {
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

    if (key === 'image') {
      data.imagePicture = value.picture;
      data.image = value.src;
    } else {
      data[key] = value;
    }
  });

  return data;
}

function parsePositionalProperties(block, existingData) {
  const data = { ...existingData };
  const rows = getParentPropertyRows(block);

  rows.forEach((row, index) => {
    const key = FIELD_ORDER[index];

    if (!key || data[key] !== undefined) {
      return;
    }

    const valueElement = row.children[0] || row;
    const value = extractValue(key, valueElement);

    if (key === 'image') {
      data.imagePicture = value.picture;
      data.image = value.src;
      return;
    }

    if (
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
  )].find((element) => !getClosestTeaserLinkItem(element, block));

  if (!propertyElement) {
    return '';
  }

  const propertyRow = getTopLevelRow(propertyElement, block);

  if (!propertyRow) {
    return '';
  }

  let nextRow = propertyRow.nextElementSibling;

  while (nextRow) {
    if (!isTeaserLinkItem(nextRow)) {
      const anchor = [...nextRow.querySelectorAll('a')]
        .find((item) => !getClosestTeaserLinkItem(item, block));

      if (anchor) {
        return anchor.getAttribute('href') || '';
      }

      const namedProperty = nextRow.querySelector('[data-aue-prop]');
      const name = namedProperty?.getAttribute('data-aue-prop');

      if (
        name === 'viewAllText'
        || name === 'primaryCtaTitle'
        || name === 'secondaryCtaTitle'
      ) {
        break;
      }
    }

    nextRow = nextRow.nextElementSibling;
  }
  return '';
}

function assignFixedLinksFromDom(data, block) {
  const nextData = { ...data };

  if (nextData.viewAllText) {
    const viewAllLink = findNextParentLink(block, 'viewAllText');

    if (viewAllLink) {
      nextData.viewAllLink = viewAllLink;
    }
  }

  if (nextData.primaryCtaTitle) {
    const primaryLink = findNextParentLink(block, 'primaryCtaTitle');

    if (primaryLink) {
      nextData.primaryCtaLink = primaryLink;
    }
  }

  if (nextData.secondaryCtaTitle) {
    const secondaryLink = findNextParentLink(block, 'secondaryCtaTitle');

    if (secondaryLink) {
      nextData.secondaryCtaLink = secondaryLink;
    }
  }

  return nextData;
}

function resolveLinkStyle(linkType, linkStyle) {
  if (
    typeof linkType === 'string'
    && VALID_LINK_STYLES.includes(linkType)
    && linkType !== 'default'
  ) {
    return linkType;
  }

  if (
    typeof linkStyle === 'string'
    && VALID_LINK_STYLES.includes(linkStyle)
  ) {
    return linkStyle;
  }

  return 'default';
}

function normalizeLinks(links, linkStyle) {
  if (!Array.isArray(links)) {
    return [];
  }

  return links
    .filter((item) => item?.title && item?.link)
    .map((item) => ({
      title: stripHtml(item.title),
      link: String(item.link).trim(),
      style: resolveLinkStyle(
        item.linkType || item.style,
        linkStyle,
      ),
    }));
}

function readChildItemRows(item) {
  return [...item.children].map((row) => (
    row.children[0] || row
  ));
}

function readTeaserLinkItem(item, fallbackStyle = 'default') {
  const data = {};

  item.querySelectorAll('[data-aue-prop]').forEach((element) => {
    const property = element.getAttribute('data-aue-prop');

    if (!property) {
      return;
    }

    const key = normalizeKey(property);

    if (data[key] === undefined) {
      data[key] = extractValue(key, element);
    }
  });

  const rows = readChildItemRows(item);

  rows.forEach((row, index) => {
    const key = LINK_ITEM_FIELD_ORDER[index];

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
    return null;
  }

  return {
    title,
    link,
    style: resolveLinkStyle(
      data.linkType,
      fallbackStyle,
    ),
  };
}

function readTeaserLinkItems(block, fallbackStyle = 'default') {
  return getTeaserLinkItems(block)
    .map((item) => readTeaserLinkItem(item, fallbackStyle))
    .filter(Boolean);
}

function isValidText(value) {
  return (
    typeof value === 'string'
    && value.trim() !== ''
    && value.trim() !== 'true'
    && value.trim() !== 'false'
  );
}

function createFixedLinks(data) {
  const links = [];

  if (
    isValidText(data.primaryCtaTitle)
    && isValidText(data.primaryCtaLink)
  ) {
    links.push({
      title: stripHtml(data.primaryCtaTitle),
      link: data.primaryCtaLink.trim(),
      style: resolveLinkStyle(
        data.primaryCtaLinkType,
        data.linkStyle,
      ),
    });
  }

  if (
    isValidText(data.secondaryCtaTitle)
    && isValidText(data.secondaryCtaLink)
  ) {
    links.push({
      title: stripHtml(data.secondaryCtaTitle),
      link: data.secondaryCtaLink.trim(),
      style: resolveLinkStyle(
        data.secondaryCtaLinkType,
        data.linkStyle,
      ),
    });
  }

  return links;
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
    normalizedData.imagePosition = 'left';
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

  normalizedData.multiLinksEnabled = parseBoolean(
    normalizedData.multiLinksEnabled,
    false,
  );

  if (!VALID_LINK_STYLES.includes(normalizedData.linkStyle)) {
    normalizedData.linkStyle = 'list';
  }

  if (!VALID_LINK_STYLES.includes(normalizedData.primaryCtaLinkType)) {
    normalizedData.primaryCtaLinkType = 'list';
  }

  if (!VALID_LINK_STYLES.includes(normalizedData.secondaryCtaLinkType)) {
    normalizedData.secondaryCtaLinkType = 'list';
  }

  return normalizedData;
}

function readBlockData(block) {
  let data = parseNamedProperties(block);

  const parentRows = getParentPropertyRows(block);

  /*
   * Positional parsing is safe only when every model field produced
   * exactly one parent row. Otherwise values shift into wrong fields.
   */
  if (parentRows.length === FIELD_ORDER.length) {
    data = parsePositionalProperties(block, data);
  }

  data = assignFixedLinksFromDom(data, block);
  data = applyDefaults(data);
  data = normalizeConfiguration(data);

  const childLinks = readTeaserLinkItems(
    block,
    data.linkStyle,
  );

  data.links = parseBoolean(data.multiLinksEnabled)
    ? childLinks
    : createFixedLinks(data);

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

function createCTA(link) {
  if (!link?.title || !link?.link) {
    return null;
  }

  const anchor = document.createElement('a');
  const style = resolveLinkStyle(link.style, 'default');

  anchor.href = link.link;
  anchor.textContent = link.title;
  anchor.classList.add(
    'teaser-cta',
    `teaser-cta-${style}`,
  );

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

function renderImage(data) {
  const shouldHideImage = parseBoolean(data.hideImage)
    || data.style === 'no-image-right-desc-links';

  if (shouldHideImage) {
    return null;
  }

  const imageContainer = document.createElement('div');
  imageContainer.className = 'teaser-image';

  const altText = stripHtml(
    data.imageAlt || data.title || 'Teaser image',
  );

  if (data.imagePicture) {
    const picture = data.imagePicture.cloneNode(true);
    const image = picture.querySelector('img');

    if (image) {
      image.alt = altText;
    }

    imageContainer.append(picture);
    return imageContainer;
  }

  if (!data.image) {
    return null;
  }

  const imageSrc = stripHtml(data.image).trim();

  if (!imageSrc) {
    return null;
  }

  const picture = createOptimizedPicture(
    imageSrc,
    altText,
    false,
    [{ width: '800' }],
  );

  imageContainer.append(picture);
  return imageContainer;
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
    const description = document.createElement('div');
    description.className = 'teaser-description';
    description.innerHTML = data.description
      || data.shortDescription;

    wrapper.append(description);
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

  const image = renderImage(data);

  if (image) {
    wrapper.append(image);
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
      image: personalizedImage || data.image,
      imagePicture: personalizedImage
        ? null
        : data.imagePicture,
      imageAlt: decision.data.imageAlt || data.imageAlt,
      links: Array.isArray(decision.data.links)
        ? normalizeLinks(
          decision.data.links,
          data.linkStyle,
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

export default async function decorate(block) {
  // Parent and child authoring data must be parsed before clearing the block.
  const data = readBlockData(block);

  applyClasses(block, data);

  const content = parseBoolean(data.personalizationEnabled)
    ? await renderPersonalized(block, data)
    : renderTeaser(data);

  block.replaceChildren(content);
}
