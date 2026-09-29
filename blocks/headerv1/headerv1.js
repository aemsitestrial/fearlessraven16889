function asText(cell) {
  return cell?.textContent?.trim() || '';
}

function getImage(cell) {
  return cell?.querySelector('picture');
}

function createMenuItem(label, href) {
  if (!label) {
    return null;
  }

  const li = document.createElement('li');
  const link = document.createElement('a');

  link.href = href || '#';
  link.textContent = label;

  li.append(link);

  return li;
}

export default function decorate(block) {
  const rows = [...block.children];

  const cells = rows.map(
    (row) => row.firstElementChild || row,
  );

  const [
    logoCell,
    logoLinkCell,
    navigationItemsCell,
    ctaLabelCell,
    ctaLinkCell,
    themeCell,
    layoutCell,
    behaviorCell,
    breadcrumbsCell,
  ] = cells;

  const logoLink = asText(logoLinkCell) || '/';

  const navigationItems = [];

  if (navigationItemsCell) {
    [...navigationItemsCell.children].forEach((item) => {
      const itemCells = [...(item.children || [])];

      if (itemCells.length >= 2) {
        navigationItems.push({
          label: asText(itemCells[0]),
          link: asText(itemCells[1]),
        });
      }
    });
  }

  console.log(navigationItems);
  console.log(navigationItemsCell);

  const ctaLabel = asText(ctaLabelCell);
  const ctaLink = asText(ctaLinkCell);

  const theme = asText(themeCell).toLowerCase() || 'light';

  const layout = asText(layoutCell).toLowerCase() || 'default';

  const behavior = asText(behaviorCell).toLowerCase() || 'fixed';

  const showBreadcrumbs = (
    asText(breadcrumbsCell).toLowerCase() === 'true'
  );

  block.classList.add(
    theme,
    layout,
    behavior,
  );

  const picture = getImage(logoCell);

  const authoredContent = document.createElement('div');
  authoredContent.className = 'headerv1-authored';

  while (block.firstChild) {
    authoredContent.append(block.firstChild);
  }

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';

  const nav = document.createElement('nav');
  nav.className = 'nav';
  nav.setAttribute(
    'aria-label',
    'Primary Navigation',
  );

  /* ---------------------------
     BRAND
  --------------------------- */

  const brand = document.createElement('div');
  brand.className = 'nav-brand';

  if (picture) {
    const brandLinkEl = document.createElement('a');

    brandLinkEl.href = logoLink;

    brandLinkEl.append(
      picture.cloneNode(true),
    );

    brand.append(brandLinkEl);
  }

  /* ---------------------------
     MENU
  --------------------------- */

  const navSections = document.createElement('div');
  navSections.className = 'nav-sections';

  const ul = document.createElement('ul');

  navigationItems
    .filter((item) => item.label)
    .forEach((item) => {
      ul.append(
        createMenuItem(
          item.label,
          item.link,
        ),
      );
    });

  navSections.append(ul);

  /* ---------------------------
     TOOLS / CTA
  --------------------------- */

  const navTools = document.createElement('div');
  navTools.className = 'nav-tools';

  if (ctaLabel && ctaLink) {
    const cta = document.createElement('a');

    cta.href = ctaLink;
    cta.textContent = ctaLabel;
    cta.className = 'button';

    navTools.append(cta);
  }

  /* ---------------------------
     MOBILE HAMBURGER
  --------------------------- */

  const hamburger = document.createElement('button');

  hamburger.className = 'nav-hamburger';
  hamburger.type = 'button';

  hamburger.setAttribute(
    'aria-label',
    'Toggle Navigation',
  );

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
      /Home</a>
      <span>/</span>
      <span>${document.title}</span>
    `;

    navWrapper.append(breadcrumbs);
  }

  block.append(authoredContent);
  block.append(navWrapper);
}
