function asText(cell) {
  return cell?.textContent?.trim() || '';
}

function getImage(cell) {
  return cell?.querySelector('picture');
}

function getHref(cell) {
  const anchor = cell?.querySelector('a');

  if (anchor) {
    return anchor.getAttribute('href') || anchor.href;
  }

  return asText(cell);
}

function createMenuItem(item) {
  const li = document.createElement('li');
  const a = document.createElement('a');

  a.href = item.link || '#';
  a.textContent = item.label;

  li.append(a);

  return li;
}

function parseNavigation(cell) {
  if (!cell) return [];

  const items = [];

  [...cell.children].forEach((item) => {
    const cols = [...item.children];

    if (cols.length >= 2) {
      const label = cols[0]?.textContent?.trim();
      const link = cols[1]?.textContent?.trim();

      if (label && link) {
        items.push({
          label,
          link,
        });
      }
    }
  });

  return items;
}

export default function decorate(block) {
  const rows = [...block.children];
  const cells = rows.map((row) => row.firstElementChild || row);

  const [
    logoCell,
    logoLinkCell,
    navigationCell,
    ctaLabelCell,
    ctaLinkCell,
    themeCell,
    layoutCell,
    behaviorCell,
    breadcrumbsCell,
  ] = cells;

  const theme = asText(themeCell).toLowerCase();
  const layout = asText(layoutCell).toLowerCase();
  const behavior = asText(behaviorCell).toLowerCase();

  block.classList.add(
    ['light', 'dark', 'transparent'].includes(theme)
      ? theme
      : 'light',

    ['default', 'compact', 'center-logo'].includes(layout)
      ? layout
      : 'default',

    ['fixed', 'sticky', 'static'].includes(behavior)
      ? behavior
      : 'fixed',
  );

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

  const brand = document.createElement('div');
  brand.className = 'nav-brand';

  const picture = getImage(logoCell);

  if (picture) {
    const logoLinkEl = document.createElement('a');

    logoLinkEl.href = getHref(logoLinkCell) || '/';
    logoLinkEl.append(picture.cloneNode(true));

    brand.append(logoLinkEl);
  }

  const navSections = document.createElement('div');
  navSections.className = 'nav-sections';

  const ul = document.createElement('ul');

  parseNavigation(navigationCell).forEach((item) => {
    ul.append(createMenuItem(item));
  });

  navSections.append(ul);

  const navTools = document.createElement('div');
  navTools.className = 'nav-tools';

  const ctaLabel = asText(ctaLabelCell);
  const ctaLink = getHref(ctaLinkCell);

  if (ctaLabel && ctaLink) {
    const cta = document.createElement('a');

    cta.href = ctaLink;
    cta.textContent = ctaLabel;
    cta.className = 'button';

    navTools.append(cta);
  }

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

  if (
    asText(breadcrumbsCell).toLowerCase() === 'true'
  ) {
    const breadcrumbs = document.createElement('div');

    breadcrumbs.className = 'breadcrumbs';

    breadcrumbs.innerHTML = `
      /Home</a>
      <span>/</span>
      <span>${document.title}</span>
    `;

    navWrapper.append(breadcrumbs);
  }

  block.append(authoredContent);
  block.append(navWrapper);
}
