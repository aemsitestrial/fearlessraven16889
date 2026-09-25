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
    menu1LabelCell,
    menu1LinkCell,
    menu2LabelCell,
    menu2LinkCell,
    menu3LabelCell,
    menu3LinkCell,
    menu4LabelCell,
    menu4LinkCell,
    ctaLabelCell,
    ctaLinkCell,
    themeCell,
    layoutCell,
    behaviorCell,
    breadcrumbsCell,
  ] = cells;

  const logoLink = asText(logoLinkCell) || '/';

  const menu1Label = asText(menu1LabelCell);
  const menu1Link = asText(menu1LinkCell);

  const menu2Label = asText(menu2LabelCell);
  const menu2Link = asText(menu2LinkCell);

  const menu3Label = asText(menu3LabelCell);
  const menu3Link = asText(menu3LinkCell);

  const menu4Label = asText(menu4LabelCell);
  const menu4Link = asText(menu4LinkCell);

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

  block.textContent = '';

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

    brandLinkEl.href = logoLink;

    brandLinkEl.append(picture);

    brand.append(brandLinkEl);
  }

  /* ---------------------------
     MENU
  --------------------------- */

  const navSections = document.createElement('div');
  navSections.className = 'nav-sections';

  const ul = document.createElement('ul');

  [
    createMenuItem(menu1Label, menu1Link),
    createMenuItem(menu2Label, menu2Link),
    createMenuItem(menu3Label, menu3Link),
    createMenuItem(menu4Label, menu4Link),
  ]
    .filter(Boolean)
    .forEach((item) => ul.append(item));

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
      /Home</a>
      <span>/</span>
      <span>${document.title}</span>
    `;

    navWrapper.append(breadcrumbs);
  }

  block.append(navWrapper);
}
