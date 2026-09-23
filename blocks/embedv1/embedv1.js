import { moveInstrumentation } from '../../scripts/scripts.js';

function asText(value) {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  const text = value.textContent || '';
  return text.trim();
}

function getCellValue(cell) {
  if (!cell) {
    return '';
  }

  if (cell.querySelector) {
    const anchor = cell.querySelector('a');
    if (anchor) {
      return anchor.getAttribute('href') || anchor.textContent.trim();
    }

    const iframe = cell.querySelector('iframe');
    if (iframe) {
      return iframe.getAttribute('src') || '';
    }
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

function isUrl(text) {
  if (!text) {
    return false;
  }

  return /^(https?:\/\/|\/\/|www\.|\/)/i.test(text.trim()) || /(?:youtube\.com|youtu\.be|vimeo\.com)/i.test(text);
}

function hasLink(cell) {
  if (!cell) {
    return false;
  }

  if (cell.querySelector && (cell.querySelector('a[href]') || cell.querySelector('iframe[src]'))) {
    return true;
  }

  if (cell.href) {
    return true;
  }

  return isUrl(asText(cell));
}

function normalizeType(value, url) {
  const normalized = (value || '').trim().toLowerCase().replace(/\s+/g, '-');

  const supported = ['iframe', 'youtube', 'vimeo', 'generic'];
  if (supported.includes(normalized) && normalized !== 'generic') {
    return normalized;
  }

  const detected = detectTypeFromUrl(url);
  if (detected) {
    return detected;
  }

  return supported.includes(normalized) ? normalized : 'iframe';
}

function buildYouTubeEmbed(url) {
  const match = url.match(/(?:v=|\.be\/|embed\/|shorts\/)([\w-]{11})/i);
  const videoId = match ? match[1] : '';

  if (!videoId) {
    return url;
  }

  return `https://www.youtube.com/embed/${videoId}`;
}

function buildVimeoEmbed(url) {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  const videoId = match ? match[1] : '';

  if (!videoId) {
    return url;
  }

  return `https://player.vimeo.com/video/${videoId}`;
}

function normalizeBlock(block) {
  const data = {
    type: '',
    url: '',
    title: '',
    caption: '',
  };
  let titleCell = null;
  let captionCell = null;

  if (!block) {
    return { data, titleCell, captionCell };
  }

  if (block.type || block.url || block.title || block.caption) {
    data.type = block.type || '';
    data.url = block.url || '';
    data.title = block.title || '';
    data.caption = block.caption || '';
    data.type = normalizeType(data.type, data.url);
    return { data, titleCell, captionCell };
  }

  // Universal Editor instrumentation attributes
  const ueType = block.querySelector('[data-aue-prop="type"]');
  const ueUrl = block.querySelector('[data-aue-prop="url"]');
  const ueTitle = block.querySelector('[data-aue-prop="title"]');
  const ueCaption = block.querySelector('[data-aue-prop="caption"]');

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

  const rows = [...block.children || []];

  if (!data.url) {
    const isKeyValue = rows.some((row) => {
      const cells = [...row.children || []];
      if (cells.length >= 2) {
        const key = asText(cells[0]).toLowerCase();
        return [
          'type',
          'embed type',
          'embed-type',
          'url',
          'embed url',
          'embed-url',
          'link',
          'embed',
          'title',
          'embed title',
          'caption',
          'embed caption',
          'description',
        ].includes(key);
      }
      return false;
    });

    if (isKeyValue) {
      rows.forEach((row) => {
        const cells = [...row.children || []];
        if (cells.length >= 2) {
          const key = asText(cells[0]).toLowerCase();
          const valCell = cells[1];
          const textVal = asText(valCell);

          switch (key) {
            case 'type':
            case 'embed type':
            case 'embed-type':
              data.type = textVal || data.type;
              break;
            case 'url':
            case 'embed url':
            case 'embed-url':
            case 'link':
            case 'embed':
              data.url = getCellValue(valCell) || data.url;
              break;
            case 'title':
            case 'embed title':
              data.title = textVal || data.title;
              titleCell = valCell;
              break;
            case 'caption':
            case 'embed caption':
            case 'description':
              data.caption = textVal || data.caption;
              captionCell = valCell;
              break;
            default:
              break;
          }
        }
      });
    } else {
      // Single-column positional format (DA Live / Document authoring table)
      const cells = rows.map((row) => (row.children.length > 0 ? row.children[0] : row));
      const [cell0, cell1, cell2, cell3] = cells;
      if (cells.length === 1) {
        data.url = getCellValue(cell0);
      } else if (cells.length > 1) {
        const cell0Text = asText(cell0).toLowerCase();
        const isCell0Type = ['iframe', 'youtube', 'vimeo', 'generic'].includes(cell0Text) && !hasLink(cell0);

        if (isCell0Type) {
          data.type = cell0Text;
          data.url = getCellValue(cell1) || data.url;
          if (cell2) {
            data.title = asText(cell2);
            titleCell = cell2;
          }
          if (cell3) {
            data.caption = asText(cell3);
            captionCell = cell3;
          }
        } else if (hasLink(cell0)) {
          data.url = getCellValue(cell0);
          if (cell1) {
            data.title = asText(cell1);
            titleCell = cell1;
          }
          if (cell2) {
            data.caption = asText(cell2);
            captionCell = cell2;
          }
        } else if (hasLink(cell1)) {
          data.title = asText(cell0);
          titleCell = cell0;
          data.url = getCellValue(cell1);
          if (cell2) {
            data.caption = asText(cell2);
            captionCell = cell2;
          }
        }
      }
    }
  }

  // Global fallback if URL was not found in structured rows
  if (!data.url) {
    const anchor = block.querySelector('a');
    if (anchor) {
      data.url = anchor.getAttribute('href') || anchor.textContent.trim();
    }
  }

  if (!data.url) {
    const iframe = block.querySelector('iframe');
    if (iframe) {
      data.url = iframe.getAttribute('src') || '';
    }
  }

  data.type = normalizeType(data.type, data.url);

  return { data, titleCell, captionCell };
}

function createElement(tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;

  if (text) {
    element.textContent = text;
  }

  return element;
}

function createFrame(data) {
  let source;

  if (data.type === 'youtube') {
    source = buildYouTubeEmbed(data.url);
  } else if (data.type === 'vimeo') {
    source = buildVimeoEmbed(data.url);
  } else {
    source = data.url;
  }

  const iframe = document.createElement('iframe');
  iframe.src = source;
  iframe.title = data.title || 'Embedded content';
  iframe.loading = 'lazy';
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  iframe.allowFullscreen = true;
  iframe.className = 'embed-iframe';

  return iframe;
}

export default async function decorate(block) {
  const { data, titleCell, captionCell } = normalizeBlock(block);

  if (!data.url) {
    block.classList.add('embed-empty');
    block.innerHTML = '<div class="embed-placeholder"><p class="embed-empty-message">Please provide an embed URL.</p></div>';
    return;
  }

  block.textContent = '';

  const wrapper = document.createElement('figure');
  wrapper.className = `embed embed-${normalizeType(data.type, data.url)}`;

  const frame = createFrame(data);
  const frameWrap = document.createElement('div');
  frameWrap.className = 'embed-frame';
  frameWrap.append(frame);
  wrapper.append(frameWrap);

  if (data.title) {
    const title = createElement('figcaption', 'embed-title', data.title);
    if (titleCell) {
      moveInstrumentation(titleCell, title);
    }
    wrapper.append(title);
  }

  if (data.caption) {
    const caption = createElement('figcaption', 'embed-caption', data.caption);
    if (captionCell) {
      moveInstrumentation(captionCell, caption);
    }
    wrapper.append(caption);
  }

  block.append(wrapper);
}
