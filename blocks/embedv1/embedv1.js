import { moveInstrumentation } from '../../scripts/scripts.js';

function asText(value) {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  return (value.textContent || '').trim();
}

function getCellValue(cell) {
  if (!cell) {
    return '';
  }

  const anchor = cell.querySelector?.('a');
  if (anchor) {
    return anchor.getAttribute('href') || anchor.textContent.trim();
  }

  const iframe = cell.querySelector?.('iframe');
  if (iframe) {
    return iframe.getAttribute('src') || '';
  }

  if (cell.href) {
    return cell.href;
  }

  return asText(cell);
}

function detectTypeFromUrl(url) {
  if (!url) {
    return '';
  }

  if (/(?:youtube\.com|youtu\.be)/i.test(url)) {
    return 'youtube';
  }

  if (/vimeo\.com/i.test(url)) {
    return 'vimeo';
  }

  return '';
}

function normalizeType(value, url) {
  const normalized = (value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');

  const supported = ['iframe', 'youtube', 'vimeo', 'generic'];

  if (supported.includes(normalized)) {
    return normalized;
  }

  return detectTypeFromUrl(url) || 'iframe';
}

function normalizeAlignment(value) {
  const alignment = (value || '').trim().toLowerCase();

  return ['left', 'center', 'right'].includes(alignment)
    ? alignment
    : 'center';
}

function normalizeSize(value) {
  const size = (value || '').trim().toLowerCase();

  return ['small', 'medium', 'large', 'full-width'].includes(size)
    ? size
    : 'large';
}

function isUrl(text) {
  if (!text) {
    return false;
  }

  return (
    /^(https?:\/\/|\/\/|www\.|\/)/i.test(text.trim())
    || /(?:youtube\.com|youtu\.be|vimeo\.com)/i.test(text)
  );
}

function hasLink(cell) {
  if (!cell) {
    return false;
  }

  if (
    cell.querySelector?.('a[href]')
    || cell.querySelector?.('iframe[src]')
  ) {
    return true;
  }

  if (cell.href) {
    return true;
  }

  return isUrl(asText(cell));
}

function buildYouTubeEmbed(url) {
  const match = url.match(
    /(?:v=|\.be\/|embed\/|shorts\/)([\w-]{11})/i,
  );

  return match
    ? `https://www.youtube.com/embed/${match[1]}`
    : url;
}

function buildVimeoEmbed(url) {
  const match = url.match(
    /vimeo\.com\/(?:video\/)?(\d+)/i,
  );

  return match
    ? `https://player.vimeo.com/video/${match[1]}`
    : url;
}

function normalizeBlock(block) {
  const data = {
    type: '',
    url: '',
    title: '',
    caption: '',
    alignment: 'center',
    size: 'large',
  };

  let titleCell = null;
  let captionCell = null;

  if (!block) {
    return { data, titleCell, captionCell };
  }

  const ueType = block.querySelector('[data-aue-prop="type"]');
  const ueUrl = block.querySelector('[data-aue-prop="url"]');
  const ueTitle = block.querySelector('[data-aue-prop="title"]');
  const ueCaption = block.querySelector('[data-aue-prop="caption"]');
  const ueAlignment = block.querySelector('[data-aue-prop="alignment"]');
  const ueSize = block.querySelector('[data-aue-prop="size"]');

  if (ueType) data.type = asText(ueType);
  if (ueUrl) data.url = getCellValue(ueUrl);
  if (ueTitle) {
    data.title = asText(ueTitle);
    titleCell = ueTitle;
  }

  if (ueCaption) {
    data.caption = asText(ueCaption);
    captionCell = ueCaption;
  }

  if (ueAlignment) {
    data.alignment = asText(ueAlignment);
  }

  if (ueSize) {
    data.size = asText(ueSize);
  }

  const rows = [...(block.children || [])];

  if (!data.url) {
    const cells = rows.map((row) => (
      row.children.length > 0
        ? row.children[0]
        : row
    ));

    const [
      cell0,
      cell1,
      cell2,
      cell3,
      cell4,
      cell5,
    ] = cells;

    if (cells.length > 1) {
      const typeText = asText(cell0).toLowerCase();

      if (
        ['iframe', 'youtube', 'vimeo', 'generic'].includes(typeText)
        && !hasLink(cell0)
      ) {
        data.type = typeText;
        data.url = getCellValue(cell1);

        if (cell2) {
          data.title = asText(cell2);
          titleCell = cell2;
        }

        if (cell3) {
          data.caption = asText(cell3);
          captionCell = cell3;
        }

        if (cell4) {
          data.alignment = asText(cell4);
        }

        if (cell5) {
          data.size = asText(cell5);
        }
      }
    }
  }

  if (!data.url) {
    const anchor = block.querySelector('a');
    if (anchor) {
      data.url = anchor.href;
    }
  }

  if (!data.url) {
    const iframe = block.querySelector('iframe');
    if (iframe) {
      data.url = iframe.src;
    }
  }

  data.type = normalizeType(data.type, data.url);
  data.alignment = normalizeAlignment(data.alignment);
  data.size = normalizeSize(data.size);

  return { data, titleCell, captionCell };
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;

  if (text) {
    element.textContent = text;
  }

  return element;
}

function createFrame(data) {
  let source = data.url;

  if (data.type === 'youtube') {
    source = buildYouTubeEmbed(data.url);
  } else if (data.type === 'vimeo') {
    source = buildVimeoEmbed(data.url);
  }

  const iframe = document.createElement('iframe');
  iframe.src = source;
  iframe.className = 'embed-iframe';
  iframe.title = data.title || 'Embedded content';
  iframe.loading = 'lazy';
  iframe.allowFullscreen = true;
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';

  iframe.allow =
    'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';

  return iframe;
}

export default async function decorate(block) {
  const { data, titleCell, captionCell } = normalizeBlock(block);

  if (!data.url) {
    block.classList.add('embed-empty');

    block.innerHTML = `
      <div class="embed-placeholder">
        <p class="embed-empty-message">
          Please provide an embed URL.
        </p>
      </div>
    `;

    return;
  }

  block.textContent = '';

  const wrapper = document.createElement('figure');

  wrapper.className = [
    'embed',
    data.type,
    data.alignment,
    data.size,
  ].join(' ');

  const frameWrap = document.createElement('div');
  frameWrap.className = 'embed-frame';

  frameWrap.append(createFrame(data));
  wrapper.append(frameWrap);

  if (data.title) {
    const title = createElement(
      'figcaption',
      'embed-title',
      data.title,
    );

    if (titleCell) {
      moveInstrumentation(titleCell, title);
    }

    wrapper.append(title);
  }

  if (data.caption) {
    const caption = createElement(
      'figcaption',
      'embed-caption',
      data.caption,
    );

    if (captionCell) {
      moveInstrumentation(captionCell, caption);
    }

    wrapper.append(caption);
  }

  block.append(wrapper);
}