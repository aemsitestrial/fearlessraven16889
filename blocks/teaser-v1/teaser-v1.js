import { createOptimizedPicture } from '../../scripts/aem.js';
import {
  getDecision,
  getTargetConfig,
  sendPropositionDisplay,
  setPersonalizationAttributes,
} from '../../scripts/target-personalization.js';

/*
 * Keep this order exactly aligned with the teaser-v1 model.
 *
 * Child teaser-v1-link components are excluded before the parent rows
 * are mapped against this array.
 */
const FIELD_ORDER = [
  'eyebrow',
  'title',
  'titleType',
  'image',
  'imageAlt',
  'backgroundImage',
  'arrowIcon',
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

const VALID_COMPONENT_STYLES = [
  'default',
  'no-image-right-desc-links',
];

const VALID_BACKGROUND_COLORS = [
  'default',
  'grey',
];

const VALID_IMAGE_POSITIONS = [
  'left',
  'right',
];

const VALID_LINK_STYLES = [
  'default',
  'list',
  'primary',
  'secondary',
];

const VALID_DATE_FORMATS = [
  'dd-mm-yyyy',
  'mm-dd-yyyy',
  'mmm-d-yyyy',
];

/*
 * These classes are author-controlled.
 * They must be removed before applying the latest authoring values.
 */
const CONFIGURATION_CLASSES = [
  'default',
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
  return String(value)
    .trim()
    .replace(/[-_\s]+(.)?/g, (_, character) => (
      character ? character.toUpperCase() : ''
    ))
    .replace(/^(.)/, (character) => character.toLowerCase());
}

function normalizeOptionValue(value, fallback, validValues) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalizedValue = value.trim().toLowerCase();

  return validValues.includes(normalizedValue)
    ? normalizedValue
    : fallback;
}

function parseBoolean(value, defaultValue = false) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  if (typeof value === 'string') {
    const normalizedValue = value.trim().toLowerCase();

    if (
      normalizedValue === 'true'
      || normalizedValue === '1'
      || normalizedValue === 'yes'
      || normalizedValue === 'on'
    ) {
      return true;
    }

    if (
      normalizedValue === 'false'
      || normalizedValue === '0'
      || normalizedValue === 'no'
      || normalizedValue === 'off'
    ) {
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

function getImageData(element) {
  if (!element) {
    return {
      picture: null,
      src: '',
    };
  }

  const image = element.matches?.('img')
    ? element
    : element.querySelector('img');

  const picture = element.matches?.('picture')
    ? element
    : element.closest?.('picture')
    || element.querySelector('picture')
    || image?.closest('picture');

  const src = image?.getAttribute('src')
    || image?.getAttribute('data-src')
    || element.getAttribute?.('src')
    || element.textContent.trim();

  return {
    picture: picture || null,
    src,
  };
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
    return getImageData(element);
  }

  if (
    key === 'viewAllLink'
    || key === 'primaryCtaLink'
    || key === 'secondaryCtaLink'
    || key === 'link'
  ) {
    return getAnchorHref(element)
      || element.getAttribute?.('href')
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

function assignExtractedValue(data, key, value) {
  if (
    value === undefined
    || value === null
  ) {
    return;
  }

  if (key === 'image') {
    data.imagePicture = value.picture || null;
    data.image = value.src || '';
    return;
  }

  if (key === 'backgroundImage') {
    data.backgroundImage = value.src || '';
    return;
  }

  if (key === 'arrowIcon') {
    data.arrowIcon = value.src || '';
    return;
  }

  if (
    value !== ''
    || typeof value === 'boolean'
  ) {
    data[key] = value;
  }
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
    multiLinksEnabled: false,

    /*
     * These values now match the JSON model defaults.
     *
     * When an individual CTA type is "default", linkStyle acts as
     * the fallback style.
     */
    primaryCtaLinkType: 'default',
    secondaryCtaLinkType: 'default',
    linkStyle: 'default',
    ...data,
  };
}

function isTeaserLinkItem(element) {
  if (!element) {
    return false;
  }

  return (
    element.dataset?.aueComponent === 'teaser-v1-link'
    || element.dataset?.aueModel === 'teaser-v1-link'
    || element.dataset?.blockName === 'teaser-v1-link'
    || element.getAttribute?.('data-aue-component') === 'teaser-v1-link'
    || element.getAttribute?.('data-aue-model') === 'teaser-v1-link'
    || element.getAttribute?.('data-block-name') === 'teaser-v1-link'
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
  const selector = [
    '[data-aue-component="teaser-v1-link"]',
    '[data-aue-model="teaser-v1-link"]',
    '[data-block-name="teaser-v1-link"]',
    '.teaser-v1-link',
  ].join(', ');

  const items = [
    ...[...block.children].filter(isTeaserLinkItem),
    ...block.querySelectorAll(selector),
  ];

  return items.filter((item, index, allItems) => (
    allItems.indexOf(item) === index
    && !getClosestTeaserLinkItem(item.parentElement, block)
  ));
}

function containsTeaserLinkItem(element, childItems) {
  return childItems.some((item) => (
    element !== item && element.contains(item)
  ));
}

function getParentPropertyRows(block) {
  const childItems = getTeaserLinkItems(block);

  return [...block.children].filter((child) => {
    if (isTeaserLinkItem(child)) {
      return false;
    }

    if (childItems.includes(child)) {
      return false;
    }

    /*
     * AEM may add a wrapper around all child items.
     * Do not treat that wrapper as a parent field row.
     */
    if (containsTeaserLinkItem(child, childItems)) {
      return false;
    }

    return true;
  });
}

function getParentPropertyElement(block, propertyName) {
  return [...block.querySelectorAll(
    `[data-aue-prop="${propertyName}"]`,
  )].find((element) => (
    !getClosestTeaserLinkItem(element, block)
  )) || null;
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

    if (!FIELD_ORDER.includes(key)) {
      return;
    }

    if (data[key] !== undefined) {
      return;
    }

    assignExtractedValue(
      data,
      key,
      extractValue(key, element),
    );
  });

  return data;
}

function getRowValueElement(row) {
  if (!row) {
    return null;
  }

  const namedElement = row.querySelector('[data-aue-prop]');

  if (namedElement) {
    return namedElement;
  }

  /*
   * Crosswalk block rows commonly contain one value cell.
   */
  return row.children[0] || row;
}

function parseLiveStructuralProperties(rows, existingData) {
  const data = { ...existingData };

  const valueElements = rows.map((row) => (
    getRowValueElement(row)
  ));

  const pictureElements = valueElements.filter((element) => (
    element?.querySelector?.('picture')
  ));

  const headingElement = valueElements.find((element) => (
    element?.querySelector?.('h1, h2, h3, h4, h5, h6')
  ));

  const contentElement = valueElements.find((element) => (
    element?.querySelectorAll?.('p').length >= 2
  ));

  /*
   * Live output contains a generated heading row.
   * Use that heading as the title when named Author properties
   * are unavailable.
   */
  if (data.title === undefined) {
    const heading = headingElement?.querySelector(
      'h1, h2, h3, h4, h5, h6',
    );

    const firstParagraph = contentElement?.querySelector('p');

    const title = heading?.textContent.trim()
      || firstParagraph?.textContent.trim()
      || '';

    if (title) {
      data.title = title;
    }
  }

  /*
   * In the Live structure, the combined content row contains:
   *
   * paragraph 0 = title
   * paragraph 1 = description
   */
  if (
    data.description === undefined
    && contentElement
  ) {
    const paragraphs = [
      ...contentElement.querySelectorAll('p'),
    ];

    const descriptionParagraph = paragraphs[1];

    if (descriptionParagraph) {
      data.description = descriptionParagraph.innerHTML.trim();
    }
  }

  /*
   * Based on the current Live output:
   *
   * picture 0 = main image
   * picture 1 = background image
   * picture 2 = CTA arrow icon
   */
  if (
    data.image === undefined
    && pictureElements[0]
  ) {
    assignExtractedValue(
      data,
      'image',
      getImageData(pictureElements[0]),
    );
  }

  if (
    data.backgroundImage === undefined
    && pictureElements[1]
  ) {
    assignExtractedValue(
      data,
      'backgroundImage',
      getImageData(pictureElements[1]),
    );
  }

  if (
    data.arrowIcon === undefined
    && pictureElements[2]
  ) {
    assignExtractedValue(
      data,
      'arrowIcon',
      getImageData(pictureElements[2]),
    );
  }

  return data;
}

function findConfigurationStart(rows) {
  return rows.findIndex((row, index) => {
    const style = getRowValueElement(row)
      ?.textContent
      .trim()
      .toLowerCase();

    const personalizationEnabled = getRowValueElement(
      rows[index + 1],
    )
      ?.textContent
      .trim()
      .toLowerCase();

    const backgroundColor = getRowValueElement(
      rows[index + 2],
    )
      ?.textContent
      .trim()
      .toLowerCase();

    const imagePosition = getRowValueElement(
      rows[index + 3],
    )
      ?.textContent
      .trim()
      .toLowerCase();

    return (
      VALID_COMPONENT_STYLES.includes(style)
      && ['true', 'false'].includes(
        personalizationEnabled,
      )
      && VALID_BACKGROUND_COLORS.includes(
        backgroundColor,
      )
      && VALID_IMAGE_POSITIONS.includes(
        imagePosition,
      )
    );
  });
}

function parseLiveConfiguration(rows, existingData) {
  const data = { ...existingData };
  const start = findConfigurationStart(rows);
  if (start < 0) return data;

  const keys = FIELD_ORDER.slice(FIELD_ORDER.indexOf('style'));
  rows.slice(start, start + keys.length).forEach((row, index) => {
    const key = keys[index];
    if (!key || data[key] !== undefined) return;
    assignExtractedValue(data, key, extractValue(key, getRowValueElement(row)));
  });
  return data;
}

function parsePositionalProperties(block, existingData) {
  const rows = getParentPropertyRows(block);
  let data = parseLiveStructuralProperties(rows, existingData);
  data = parseLiveConfiguration(rows, data);

  /* Standard author fallback when named properties or Live markers exist. */
  if (findConfigurationStart(rows) < 0) {
    rows.slice(0, FIELD_ORDER.length).forEach((row, index) => {
      const key = FIELD_ORDER[index];
      if (!key || data[key] !== undefined) return;
      assignExtractedValue(data, key, extractValue(key, getRowValueElement(row)));
    });
  }
  return data;
}

function getTopLevelRow(element, block) {
  let current = element;

  while (
    current?.parentElement
    && current.parentElement !== block
  ) {
    current = current.parentElement;
  }

  return current?.parentElement === block
    ? current
    : null;
}

function findNextParentLink(block, propertyName) {
  const propertyElement = getParentPropertyElement(
    block,
    propertyName,
  );

  if (!propertyElement) {
    return '';
  }

  const propertyRow = getTopLevelRow(
    propertyElement,
    block,
  );

  if (!propertyRow) {
    return '';
  }

  const childItems = getTeaserLinkItems(block);
  let nextRow = propertyRow.nextElementSibling;

  while (nextRow) {
    const isChildItem = (
      isTeaserLinkItem(nextRow)
      || containsTeaserLinkItem(
        nextRow,
        childItems,
      )
    );

    if (!isChildItem) {
      const anchor = [...nextRow.querySelectorAll('a')]
        .find((item) => (
          !getClosestTeaserLinkItem(item, block)
        ));

      if (anchor) {
        return anchor.getAttribute('href') || '';
      }

      const namedProperty = nextRow.querySelector(
        '[data-aue-prop]',
      );

      const name = namedProperty?.getAttribute(
        'data-aue-prop',
      );

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

  const mappings = [
    {
      titleProperty: 'viewAllText',
      linkProperty: 'viewAllLink',
    },
    {
      titleProperty: 'primaryCtaTitle',
      linkProperty: 'primaryCtaLink',
    },
    {
      titleProperty: 'secondaryCtaTitle',
      linkProperty: 'secondaryCtaLink',
    },
  ];

  mappings.forEach(({ titleProperty, linkProperty }) => {
    if (!nextData[titleProperty]) {
      return;
    }

    /*
     * Keep an already parsed link. Only use DOM sibling discovery
     * when the normal property parser did not find the link.
     */
    if (nextData[linkProperty]) {
      return;
    }

    const href = findNextParentLink(
      block,
      titleProperty,
    );

    if (href) {
      nextData[linkProperty] = href;
    }
  });

  return nextData;
}

function resolveLinkStyle(linkType, linkStyle) {
  const normalizedLinkType = normalizeOptionValue(
    linkType,
    'default',
    VALID_LINK_STYLES,
  );

  const normalizedLinkStyle = normalizeOptionValue(
    linkStyle,
    'default',
    VALID_LINK_STYLES,
  );

  /*
   * Per-link style takes priority unless it is "default".
   */
  if (normalizedLinkType !== 'default') {
    return normalizedLinkType;
  }

  return normalizedLinkStyle;
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
    getRowValueElement(row)
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

    if (!LINK_ITEM_FIELD_ORDER.includes(key)) {
      return;
    }

    if (data[key] !== undefined) {
      return;
    }

    data[key] = extractValue(key, element);
  });

  const rows = readChildItemRows(item);

  rows
    .slice(0, LINK_ITEM_FIELD_ORDER.length)
    .forEach((row, index) => {
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
    .map((item) => (
      readTeaserLinkItem(item, fallbackStyle)
    ))
    .filter(Boolean);
}

function isValidText(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const normalizedValue = value.trim().toLowerCase();

  return (
    normalizedValue !== ''
    && normalizedValue !== 'true'
    && normalizedValue !== 'false'
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

  normalizedData.titleType = normalizeOptionValue(
    normalizedData.titleType,
    'h2',
    VALID_HEADING_TAGS,
  );

  normalizedData.style = normalizeOptionValue(
    normalizedData.style,
    'default',
    VALID_COMPONENT_STYLES,
  );

  normalizedData.backgroundColor = normalizeOptionValue(
    normalizedData.backgroundColor,
    'default',
    VALID_BACKGROUND_COLORS,
  );

  normalizedData.imagePosition = normalizeOptionValue(
    normalizedData.imagePosition,
    'right',
    VALID_IMAGE_POSITIONS,
  );

  normalizedData.dateFormat = normalizeOptionValue(
    normalizedData.dateFormat,
    'mmm-d-yyyy',
    VALID_DATE_FORMATS,
  );

  normalizedData.primaryCtaLinkType = normalizeOptionValue(
    normalizedData.primaryCtaLinkType,
    'default',
    VALID_LINK_STYLES,
  );

  normalizedData.secondaryCtaLinkType = normalizeOptionValue(
    normalizedData.secondaryCtaLinkType,
    'default',
    VALID_LINK_STYLES,
  );

  normalizedData.linkStyle = normalizeOptionValue(
    normalizedData.linkStyle,
    'default',
    VALID_LINK_STYLES,
  );

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

  return normalizedData;
}

function logRawStructure(block) {
  const parentRows = getParentPropertyRows(block);
  const childItems = getTeaserLinkItems(block);

  console.log('[teaser-v1] Raw structure', {
    expectedParentRows: FIELD_ORDER.length,
    actualParentRows: parentRows.length,
    childCount: childItems.length,
    parentRows: parentRows.map((row, index) => ({
      index,
      expectedField: FIELD_ORDER[index] || 'extra-row',
      property: row
        .querySelector('[data-aue-prop]')
        ?.getAttribute('data-aue-prop') || '',
      text: row.textContent.trim(),
    })),
    children: childItems.map((item) => ({
      model: item.getAttribute('data-aue-model'),
      component: item.getAttribute('data-aue-component'),
      blockName: item.getAttribute('data-block-name'),
      className: item.className,
    })),
  });
}

function readBlockData(block) {
  /*
   * Named properties are the safest source because child insertion
   * cannot change their mapping.
   */
  let data = parseNamedProperties(block);

  /*
   * Positional parsing fills properties that were not exposed with
   * data-aue-prop. Child components are excluded from parent rows.
   */
  data = parsePositionalProperties(block, data);

  data = assignFixedLinksFromDom(data, block);
  data = applyDefaults(data);
  data = normalizeConfiguration(data);

  const fixedLinks = createFixedLinks(data);
  const childLinks = readTeaserLinkItems(
    block,
    data.linkStyle,
  );

  /*
   * Multi Links OFF:
   * Use the fixed parent primary and secondary CTA fields.
   *
   * Multi Links ON:
   * Use child teaser-v1-link components.
   *
   * Safety:
   * If Multi Links is ON but no valid child has been added,
   * keep the parent CTAs instead of rendering no CTAs.
   */
  data.links = (
    data.multiLinksEnabled
    && childLinks.length
  )
    ? childLinks
    : fixedLinks;

  data.childLinks = childLinks;

  console.log('[teaser-v1] Final parsed data', {
    style: data.style,
    backgroundColor: data.backgroundColor,
    imagePosition: data.imagePosition,
    showEyebrow: data.showEyebrow,
    hideTitle: data.hideTitle,
    showDescription: data.showDescription,
    hideImage: data.hideImage,
    multiLinksEnabled: data.multiLinksEnabled,
    primaryCtaLinkType: data.primaryCtaLinkType,
    secondaryCtaLinkType: data.secondaryCtaLinkType,
    linkStyle: data.linkStyle,
    childLinkCount: childLinks.length,
    renderedLinkCount: data.links.length,
    links: data.links,
  });

  console.log('==============================');
  console.log('TITLE:', data.title);
  console.log('DESCRIPTION:', data.description);
  console.log('IMAGE:', data.image);
  console.log('PRIMARY CTA TITLE:', data.primaryCtaTitle);
  console.log('PRIMARY CTA LINK:', data.primaryCtaLink);
  console.log('SECONDARY CTA TITLE:', data.secondaryCtaTitle);
  console.log('SECONDARY CTA LINK:', data.secondaryCtaLink);
  console.log('LINKS:', data.links);
  console.log('FULL DATA:', data);
  console.log('==============================');

  return data;
}

function formatDate(dateValue, format = 'mmm-d-yyyy') {
  if (!dateValue) {
    return '';
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.valueOf())) {
    return String(dateValue);
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
  /*
   * Remove old authoring classes first.
   *
   * This prevents image-right from surviving when the author changes
   * Image Position to left.
   */
  block.classList.remove(...CONFIGURATION_CLASSES);

  if (data.style === 'no-image-right-desc-links') {
    block.classList.add('no-image-right-desc-links');
  }

  if (data.backgroundColor === 'grey') {
    block.classList.add('grey');
  }

  /*
   * Image position has no effect when the style is no-image-right-desc-links.
   */
  if (data.style !== 'no-image-right-desc-links') {
    if (data.imagePosition === 'right') {
      block.classList.add('image-right');
    } else {
      block.classList.add('image-left');
    }
  }
}

function createPicture(data) {
  if (data.hideImage || !data.image) {
    return null;
  }

  const imageWrapper = document.createElement('div');
  imageWrapper.className = 'teaser-image';

  let picture;

  if (data.imagePicture) {
    picture = data.imagePicture.cloneNode(true);

    const image = picture.querySelector('img');

    if (image) {
      image.alt = data.imageAlt || '';
      image.loading = 'lazy';
    }
  } else {
    picture = createOptimizedPicture(
      data.image,
      data.imageAlt || '',
      false,
      [{ width: '750' }],
    );
  }

  imageWrapper.append(picture);

  return imageWrapper;
}

function createEyebrow(data) {
  if (
    !data.showEyebrow
    || !isValidText(data.eyebrow)
  ) {
    return null;
  }

  const eyebrow = document.createElement('p');
  eyebrow.className = 'teaser-eyebrow';
  eyebrow.textContent = stripHtml(data.eyebrow);

  return eyebrow;
}

function createTitle(data) {
  if (
    data.hideTitle
    || !isValidText(data.title)
  ) {
    return null;
  }

  const title = document.createElement(data.titleType);
  title.className = 'teaser-title';
  title.textContent = stripHtml(data.title);

  return title;
}

function createDescription(data) {
  if (
    !data.showDescription
    || !isValidText(data.description)
  ) {
    return null;
  }

  const description = document.createElement('div');
  description.className = 'teaser-description';
  description.innerHTML = data.description;

  return description;
}

function createShortDescription(data) {
  if (!isValidText(data.shortDescription)) {
    return null;
  }

  const shortDescription = document.createElement('div');
  shortDescription.className = 'teaser-short-description';
  shortDescription.innerHTML = data.shortDescription;

  return shortDescription;
}

function createDate(data) {
  if (
    !data.showDate
    || !data.date
  ) {
    return null;
  }

  const formattedDate = formatDate(
    data.date,
    data.dateFormat,
  );

  if (!formattedDate) {
    return null;
  }

  const date = document.createElement('time');
  date.className = 'teaser-date';
  date.textContent = formattedDate;

  const parsedDate = new Date(data.date);

  if (!Number.isNaN(parsedDate.valueOf())) {
    date.dateTime = parsedDate.toISOString();
  }

  return date;
}

function createViewAllLink(data) {
  if (
    !isValidText(data.viewAllText)
    || !isValidText(data.viewAllLink)
  ) {
    return null;
  }

  const link = document.createElement('a');
  link.className = 'teaser-view-all';
  link.href = data.viewAllLink.trim();
  link.textContent = stripHtml(data.viewAllText);

  return link;
}

function createCtaIcon(data) {
  if (!isValidText(data.arrowIcon)) {
    return null;
  }

  const icon = document.createElement('img');
  icon.className = 'teaser-cta-icon';
  icon.src = data.arrowIcon;
  icon.alt = '';
  icon.loading = 'lazy';

  return icon;
}

function createCtas(data) {
  const links = normalizeLinks(
    data.links,
    data.linkStyle,
  );

  if (!links.length) {
    return null;
  }

  const ctas = document.createElement('div');
  ctas.className = 'teaser-ctas';

  links.forEach((item) => {
    const cta = document.createElement('a');
    cta.className = [
      'teaser-cta',
      `teaser-cta-${item.style}`,
    ].join(' ');
    cta.href = item.link;

    const label = document.createElement('span');
    label.className = 'teaser-cta-label';
    label.textContent = item.title;
    cta.append(label);

    const icon = createCtaIcon(data);

    if (icon) {
      cta.append(icon);
    }

    ctas.append(cta);
  });

  return ctas;
}

function createTags(data) {
  if (
    !data.displayTags
    || !Array.isArray(data.tags)
    || !data.tags.length
  ) {
    return null;
  }

  const tags = document.createElement('ul');
  tags.className = 'teaser-tags';

  data.tags
    .filter(isValidText)
    .forEach((tagValue) => {
      const tag = document.createElement('li');
      tag.className = 'teaser-tag';
      tag.textContent = stripHtml(tagValue);
      tags.append(tag);
    });

  return tags.children.length ? tags : null;
}

function createContent(data) {
  const content = document.createElement('div');
  content.className = 'teaser-content';

  const elements = [
    createEyebrow(data),
    createTitle(data),
    createDate(data),
    createDescription(data),
    createShortDescription(data),
    createTags(data),
    createViewAllLink(data),
    createCtas(data),
  ];

  elements
    .filter(Boolean)
    .forEach((element) => content.append(element));

  return content;
}

function applyBackgroundImage(wrapper, data) {
  if (!isValidText(data.backgroundImage)) {
    return;
  }

  wrapper.style.backgroundImage = `url("${data.backgroundImage}")`;
  wrapper.classList.add('has-background-image');
}

function renderTeaser(block, data) {
  const wrapper = document.createElement('div');
  wrapper.className = 'teaser-wrapper';

  const body = document.createElement('div');
  body.className = 'teaser-body';

  const content = createContent(data);
  const image = createPicture(data);

  /*
   * The visual order is controlled here instead of relying only on CSS.
   * This also gives the correct reading order when the image is authored left.
   */
  if (
    data.style === 'no-image-right-desc-links'
    || !image
  ) {
    body.append(content);
  } else if (data.imagePosition === 'left') {
    body.append(image, content);
  } else {
    body.append(content, image);
  }

  wrapper.append(body);
  applyBackgroundImage(wrapper, data);
  block.replaceChildren(wrapper);
}

async function applyPersonalization(block, data) {
  if (!data.personalizationEnabled) {
    return;
  }

  try {
    const targetConfig = await getTargetConfig();

    if (!targetConfig) {
      return;
    }

    setPersonalizationAttributes(
      block,
      targetConfig,
    );

    const decision = await getDecision(
      targetConfig,
      block,
    );

    if (decision) {
      await sendPropositionDisplay(decision);
    }
  } catch (error) {
    /*
     * Personalization must never prevent the default teaser from rendering.
     */
    console.warn(
      '[teaser-v1] Personalization failed. Default content is retained.',
      error,
    );
  }
}

export default async function decorate(block) {
  /*
   * Parse every authored value before replacing the source rows.
   */
  logRawStructure(block);

  const data = readBlockData(block);

  applyClasses(block, data);
  renderTeaser(block, data);

  await applyPersonalization(block, data);
}
