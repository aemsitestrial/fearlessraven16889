import { moveInstrumentation } from '../../scripts/scripts.js';

function asText(cell) {
  return cell?.textContent?.trim() || '';
}

function getImage(cell) {
  return cell?.querySelector('picture');
}

function getHref(cell) {
  if (!cell) return '';
  const anchor = cell.querySelector('a[href]');
  if (anchor) return anchor.getAttribute('href') || anchor.href;
  return asText(cell);
}

function normalizeKey(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseNavigationContainer(container) {
  if (!container) return [];
  const items = [];

  // 1. Check for <a> tags
  const links = [...container.querySelectorAll('a[href]')];
  if (links.length) {
    return links.map((a) => ({
      label: a.textContent.trim(),
      link: a.getAttribute('href') || a.href,
      instrumentation: a,
    })).filter((item) => item.label && item.link);
  }

  // 2. Check for child items with data-aue-prop="label"
  const labelEls = [...container.querySelectorAll('[data-aue-prop="label"]')];
  if (labelEls.length) {
    labelEls.forEach((labelEl) => {
      const parent = labelEl.closest('[data-aue-resource]') || labelEl.parentElement;
      const linkEl = parent?.querySelector('[data-aue-prop="link"]');
      const label = labelEl.textContent.trim();
      const link = linkEl?.getAttribute('href') || linkEl?.textContent?.trim() || '#';
      if (label) {
        items.push({ label, link, instrumentation: parent || labelEl });
      }
    });
    if (items.length) return items;
  }

  // 3. Check for child elements (multi-column or comma/pipe separated)
  const children = [...container.children];
  children.forEach((child) => {
    if (child.children.length >= 2) {
      const label = child.children[0]?.textContent?.trim();
      const link = getHref(child.children[1]);
      if (label && link) {
        items.push({ label, link, instrumentation: child });
        return;
      }
    }
    const text = child.textContent.trim();
    if (text) {
      const parts = text.split(/[,|]\s*/);
      if (parts.length >= 2) {
        items.push({ label: parts[0].trim(), link: parts[1].trim(), instrumentation: child });
      }
    }
  });

  return items;
}

function extractFields(block) {
  const rows = [...block.children];
  const fields = {
    logo: null,
    logoLink: '/',
    navigation: [],
    ctaLabel: '',
    ctaLink: '',
    theme: 'light',
    layout: 'default',
    behavior: 'fixed',
    showBreadcrumbs: false,
  };

  // Check 1: Universal Editor data-aue-prop attributes
  const ueProps = [...block.querySelectorAll('[data-aue-prop]')];
  if (ueProps.length > 0) {
    ueProps.forEach((el) => {
      const prop = el.getAttribute('data-aue-prop');
      if (prop === 'logo') fields.logo = el;
      else if (prop === 'logoLink') fields.logoLink = getHref(el) || '/';
      else if (prop === 'navigation') fields.navigation.push(...parseNavigationContainer(el));
      else if (prop === 'ctaLabel') fields.ctaLabel = asText(el);
      else if (prop === 'ctaLink') fields.ctaLink = getHref(el);
      else if (prop === 'theme') fields.theme = asText(el).toLowerCase() || fields.theme;
      else if (prop === 'layout') fields.layout = asText(el).toLowerCase() || fields.layout;
      else if (prop === 'behavior') fields.behavior = asText(el).toLowerCase() || fields.behavior;
      else if (prop === 'showBreadcrumbs') fields.showBreadcrumbs = asText(el).toLowerCase() === 'true';
    });
    if (fields.navigation.length > 0 || fields.logo || fields.ctaLabel) {
      return fields;
    }
  }

  // Check 2: 2-column Key-Value format
  const isKeyValue = rows.some((row) => {
    if (row.children.length >= 2) {
      const key = normalizeKey(row.children[0].textContent);
      return ['logo', 'logolink', 'navigation', 'nav', 'menu', 'ctalabel', 'ctalink', 'theme', 'layout', 'behavior', 'showbreadcrumbs'].includes(key);
    }
    return false;
  });

  if (isKeyValue) {
    rows.forEach((row) => {
      if (row.children.length >= 2) {
        const key = normalizeKey(row.children[0].textContent);
        const valueCell = row.children[1];
        if (key === 'logo') fields.logo = valueCell;
        else if (key === 'logolink') fields.logoLink = getHref(valueCell) || '/';
        else if (key === 'navigation' || key === 'nav' || key === 'menu') {
          const parsed = parseNavigationContainer(valueCell);
          if (parsed.length) fields.navigation.push(...parsed);
          else if (asText(valueCell)) {
            const parts = asText(valueCell).split(/[,|]\s*/);
            if (parts.length >= 2) {
              fields.navigation.push({
                label: parts[0].trim(),
                link: parts[1].trim(),
                instrumentation: valueCell,
              });
            }
          }
        } else if (key === 'ctalabel') fields.ctaLabel = asText(valueCell);
        else if (key === 'ctalink') fields.ctaLink = getHref(valueCell);
        else if (key === 'theme') fields.theme = asText(valueCell).toLowerCase() || fields.theme;
        else if (key === 'layout') fields.layout = asText(valueCell).toLowerCase() || fields.layout;
        else if (key === 'behavior') fields.behavior = asText(valueCell).toLowerCase() || fields.behavior;
        else if (key === 'showbreadcrumbs' || key === 'breadcrumbs') fields.showBreadcrumbs = asText(valueCell).toLowerCase() === 'true';
      }
    });
    return fields;
  }

  // Check 3: Legacy 16-row format
  if (rows.length === 16) {
    const cells = rows.map((r) => r.firstElementChild || r);
    [fields.logo] = cells;
    fields.logoLink = getHref(cells[1]) || '/';
    for (let i = 2; i < 10; i += 2) {
      const label = asText(cells[i]);
      const link = getHref(cells[i + 1]);
      if (label) {
        fields.navigation.push({ label, link: link || '#', instrumentation: cells[i] });
      }
    }
    fields.ctaLabel = asText(cells[10]);
    fields.ctaLink = getHref(cells[11]);
    fields.theme = asText(cells[12]).toLowerCase() || 'light';
    fields.layout = asText(cells[13]).toLowerCase() || 'default';
    fields.behavior = asText(cells[14]).toLowerCase() || 'fixed';
    fields.showBreadcrumbs = asText(cells[15]).toLowerCase() === 'true';
    return fields;
  }

  // Check 4: 9-row format (matching model fields)
  if (rows.length === 9) {
    const cells = rows.map((r) => r.firstElementChild || r);
    [fields.logo] = cells;
    fields.logoLink = getHref(cells[1]) || '/';
    fields.navigation = parseNavigationContainer(cells[2]);
    fields.ctaLabel = asText(cells[3]);
    fields.ctaLink = getHref(cells[4]);
    fields.theme = asText(cells[5]).toLowerCase() || 'light';
    fields.layout = asText(cells[6]).toLowerCase() || 'default';
    fields.behavior = asText(cells[7]).toLowerCase() || 'fixed';
    fields.showBreadcrumbs = asText(cells[8]).toLowerCase() === 'true';
    return fields;
  }

  // Check 5: General rows
  const cells = rows.map((r) => r.firstElementChild || r);
  if (cells.length > 0) [fields.logo] = cells;
  if (cells.length > 1) fields.logoLink = getHref(cells[1]) || '/';

  rows.slice(2).forEach((row) => {
    if (row.children.length >= 2) {
      const col0Text = asText(row.children[0]);
      const col1Text = asText(row.children[1]);
      const col0Key = normalizeKey(col0Text);

      if (col0Key === 'ctalabel') fields.ctaLabel = col1Text;
      else if (col0Key === 'ctalink') fields.ctaLink = getHref(row.children[1]);
      else if (col0Key === 'theme') fields.theme = col1Text.toLowerCase() || fields.theme;
      else if (col0Key === 'layout') fields.layout = col1Text.toLowerCase() || fields.layout;
      else if (col0Key === 'behavior') fields.behavior = col1Text.toLowerCase() || fields.behavior;
      else if (col0Key === 'showbreadcrumbs') fields.showBreadcrumbs = col1Text.toLowerCase() === 'true';
      else if (col0Text && col1Text) {
        fields.navigation.push({
          label: col0Text,
          link: getHref(row.children[1]),
          instrumentation: row,
        });
      }
    } else {
      const parsed = parseNavigationContainer(row);
      if (parsed.length) {
        fields.navigation.push(...parsed);
      }
    }
  });

  return fields;
}

function createMenuItem(item) {
  if (!item?.label) {
    return null;
  }

  const li = document.createElement('li');
  const link = document.createElement('a');

  link.href = item.link || '#';
  link.textContent = item.label;

  if (item.instrumentation) {
    moveInstrumentation(item.instrumentation, link);
  }

  li.append(link);
  return li;
}

export default function decorate(block) {
  const fields = extractFields(block);

  const theme = fields.theme || 'light';
  const layout = fields.layout || 'default';
  const behavior = fields.behavior || 'fixed';
  const { showBreadcrumbs } = fields;

  block.classList.add(theme, layout, behavior);

  const picture = getImage(fields.logo);

  const authoredContent = document.createElement('div');
  authoredContent.className = 'headerv1-authored';

  while (block.firstChild) {
    authoredContent.append(block.firstChild);
  }

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';

  const nav = document.createElement('nav');
  nav.className = 'nav';
  nav.setAttribute('aria-label', 'Primary Navigation');

  /* ---------------------------
     BRAND
  --------------------------- */
  const brand = document.createElement('div');
  brand.className = 'nav-brand';

  if (picture) {
    const brandLinkEl = document.createElement('a');
    brandLinkEl.href = fields.logoLink || '/';
    brandLinkEl.setAttribute('aria-label', 'Home');
    brandLinkEl.append(picture.cloneNode(true));
    brand.append(brandLinkEl);
  }

  /* ---------------------------
     MENU
  --------------------------- */
  const navSections = document.createElement('div');
  navSections.className = 'nav-sections';

  const ul = document.createElement('ul');
  fields.navigation.forEach((item) => {
    const li = createMenuItem(item);
    if (li) ul.append(li);
  });
  navSections.append(ul);

  /* ---------------------------
     TOOLS / CTA
  --------------------------- */
  const navTools = document.createElement('div');
  navTools.className = 'nav-tools';

  if (fields.ctaLabel && fields.ctaLink) {
    const cta = document.createElement('a');
    cta.href = fields.ctaLink;
    cta.textContent = fields.ctaLabel;
    cta.className = 'button';
    navTools.append(cta);
  }

  /* ---------------------------
     MOBILE HAMBURGER
  --------------------------- */
  const hamburger = document.createElement('button');
  hamburger.className = 'nav-hamburger';
  hamburger.type = 'button';
  hamburger.setAttribute('aria-label', 'Toggle Navigation');
  hamburger.innerHTML = `
    <span></span>
    <span></span>
    <span></span>
  `;

  hamburger.addEventListener('click', () => {
    nav.classList.toggle('is-open');
  });

  nav.append(hamburger);
  nav.append(brand);
  nav.append(navSections);
  nav.append(navTools);

  navWrapper.append(nav);

  /* ---------------------------
     BREADCRUMBS
  --------------------------- */
  if (showBreadcrumbs) {
    const breadcrumbs = document.createElement('div');
    breadcrumbs.className = 'breadcrumbs';
    breadcrumbs.innerHTML = `
      <a href="/">Home</a>
      <span>/</span>
      <span>${document.title}</span>
    `;
    navWrapper.append(breadcrumbs);
  }

  block.append(authoredContent);
  block.append(navWrapper);
}
