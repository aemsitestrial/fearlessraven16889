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
  'links',
  'primaryCtaTitle',
  'primaryCtaLink',
  'primaryCtaLinkType',
  'secondaryCtaTitle',
  'secondaryCtaLink',
  'secondaryCtaLinkType',
  'linkStyle',
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
  element.innerHTML = value;
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
    primaryCtaLinkType: 'default',
    secondaryCtaLinkType: 'default',
    linkStyle: 'default',
    ...data,
  };
}

function parseNamedProperties(block) {
  const data = {};

  block.querySelectorAll('[data-aue-prop]').forEach((element) => {
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
  const rows = [...block.children];

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

/**
 * Attempts to parse the experimental composite multifield.
 *
 * The method intentionally supports multiple possible DOM structures because
 * multifield serialization can differ between Universal Editor environments.
 */
function parseMultifieldLinks(block) {
  const linksRoot = block.querySelector('[data-aue-prop="links"]');

  if (!linksRoot) {
    return [];
  }

  let itemElements = [
    ...linksRoot.querySelectorAll(
      ':scope > [data-aue-type="item"], '
      + ':scope > [data-aue-prop="item"], '
      + ':scope > [data-aue-resource]',
    ),
  ];

  if (!itemElements.length) {
    itemElements = [...linksRoot.children];
  }

  return itemElements
    .map((item) => {
      const titleElement = item.querySelector(
        '[data-aue-prop="title"], '
        + '[data-aue-prop="ctaTitle"]',
      );

      const linkElement = item.querySelector(
        '[data-aue-prop="link"], '
        + '[data-aue-prop="ctaLink"]',
      );

      const linkTypeElement = item.querySelector(
        '[data-aue-prop="linkType"], '
        + '[data-aue-prop="ctaLinkType"]',
      );

      const title = titleElement?.textContent.trim() || '';
      const link = getAnchorHref(linkElement)
        || linkElement?.textContent.trim()
        || '';

      const linkType = linkTypeElement?.textContent.trim()
        || 'default';

      return {
        title,
        link,
        linkType,
      };
    })
    .filter(({ title, link }) => title && link);
}

function extractAuthoredPathLinks(block) {
  return [...block.querySelectorAll('.button-container a')]
    .map((anchor) => anchor.getAttribute('href'))
    .filter(Boolean);
}

function assignFixedLinksFromDom(data, block) {
  const nextData = { ...data };
  const authoredPaths = extractAuthoredPathLinks(block);

  let pathIndex = 0;

  if (nextData.viewAllText && authoredPaths[pathIndex]) {
    nextData.viewAllLink = nextData.viewAllLink
      || authoredPaths[pathIndex];

    pathIndex += 1;
  }

  if (nextData.primaryCtaTitle && authoredPaths[pathIndex]) {
    nextData.primaryCtaLink = nextData.primaryCtaLink
      || authoredPaths[pathIndex];

    pathIndex += 1;
  }

  if (nextData.secondaryCtaTitle && authoredPaths[pathIndex]) {
    nextData.secondaryCtaLink = nextData.secondaryCtaLink
      || authoredPaths[pathIndex];
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

function normalizeMultifieldLinks(links, linkStyle) {
  if (!Array.isArray(links)) {
    return [];
  }

  return links
    .filter(({ title, link }) => title && link)
    .map((item) => ({
      title: item.title,
      link: item.link,
      style: resolveLinkStyle(
        item.linkType || item.style,
        linkStyle,
      ),
    }));
}

function createFixedLinks(data) {
  const links = [];

  if (data.primaryCtaTitle && data.primaryCtaLink) {
    links.push({
      title: data.primaryCtaTitle,
      link: data.primaryCtaLink,
      style: resolveLinkStyle(
        data.primaryCtaLinkType,
        data.linkStyle,
      ),
    });
  }

  if (data.secondaryCtaTitle && data.secondaryCtaLink) {
    links.push({
      title: data.secondaryCtaTitle,
      link: data.secondaryCtaLink,
      style: resolveLinkStyle(
        data.secondaryCtaLinkType,
        data.linkStyle,
      ),
    });
  }

  return links;
}

function readBlockData(block) {
  let data = parseNamedProperties(block);

  data = parsePositionalProperties(block, data);
  data = assignFixedLinksFromDom(data, block);
  data = applyDefaults(data);

  const multifieldLinks = parseMultifieldLinks(block);

  if (parseBoolean(data.multiLinksEnabled)) {
    data.links = normalizeMultifieldLinks(
      multifieldLinks,
      data.linkStyle,
    );
  } else {
    data.links = createFixedLinks(data);
  }

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

  switch (format.toLowerCase()) {
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

  if (data.style && data.style !== 'default') {
    classes.push(data.style);
  }

  if (
    data.backgroundColor
    && data.backgroundColor !== 'default'
  ) {
    classes.push(data.backgroundColor);
  }

  if (
    data.imagePosition
    && data.style !== 'no-image-right-desc-links'
  ) {
    classes.push(`image-${data.imagePosition}`);
  }

  if (
    parseBoolean(data.hideImage)
    || data.style === 'no-image-right-desc-links'
  ) {
    classes.push('hide-image');
  }

  if (parseBoolean(data.hideTitle)) {
    classes.push('hide-title');
  }

  if (!parseBoolean(data.showDescription, true)) {
    classes.push('hide-description');
  }

  if (!parseBoolean(data.showEyebrow, true)) {
    classes.push('hide-eyebrow');
  }

  if (parseBoolean(data.personalizationEnabled)) {
    classes.push('personalized');
  }

  block.classList.add(
    ...classes.filter((className) => (
      /^[a-zA-Z0-9_-]+$/.test(className)
    )),
  );
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
  if (!data.viewAllText || !data.viewAllLink) {
    return null;
  }

  const anchor = document.createElement('a');

  anchor.className = 'teaser-view-all';
  anchor.href = data.viewAllLink;
  anchor.textContent = data.viewAllText;

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

    const personalizedData = {
      ...data,
      eyebrow: decision.data.eyebrow || data.eyebrow,
      title: decision.data.title || data.title,
      description:
        decision.data.description || data.description,
      shortDescription:
        decision.data.shortDescription
        || data.shortDescription,
      image: decision.data.image || data.image,
      imageAlt: decision.data.imageAlt || data.imageAlt,
      links: Array.isArray(decision.data.links)
        ? normalizeMultifieldLinks(
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
  // Multifield content must be parsed before clearing the raw block.
  const data = readBlockData(block);

  applyClasses(block, data);

  const content = parseBoolean(data.personalizationEnabled)
    ? await renderPersonalized(block, data)
    : renderTeaser(data);

  block.replaceChildren(content);
}
