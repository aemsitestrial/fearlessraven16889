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

function normalizeType(value) {
  const normalized = (value || 'iframe').trim().toLowerCase().replace(/\s+/g, '-');

  const supported = ['iframe', 'youtube', 'vimeo', 'generic'];
  return supported.includes(normalized) ? normalized : 'iframe';
}

function buildYouTubeEmbed(url) {
  const match = url.match(/(?:v=|\.be\/)([\w-]{11})/i);
  const videoId = match ? match[1] : '';

  if (!videoId) {
    return url;
  }

  return `https://www.youtube.com/embed/${videoId}`;
}

function buildVimeoEmbed(url) {
  const match = url.match(/vimeo\.com\/(\d+)/i);
  const videoId = match ? match[1] : '';

  if (!videoId) {
    return url;
  }

  return `https://player.vimeo.com/video/${videoId}`;
}

function normalizeBlock(block) {
  const data = {
    type: 'iframe',
    url: '',
    title: '',
    caption: '',
  };

  if (!block) {
    return data;
  }

  if (block.type || block.url || block.title || block.caption) {
    data.type = normalizeType(block.type || data.type);
    data.url = block.url || data.url;
    data.title = block.title || data.title;
    data.caption = block.caption || data.caption;
    return data;
  }

  if (!block.children) {
    return data;
  }

  [...block.children].forEach((row) => {
    const cells = [...row.children || []];
    if (cells.length < 2) {
      return;
    }

    const key = asText(cells[0]).toLowerCase();
    const value = cells[1];
    const textValue = asText(value);

    switch (key) {
      case 'type':
      case 'embed type':
      case 'embed-type':
        data.type = normalizeType(textValue || data.type);
        break;
      case 'url':
      case 'embed url':
      case 'embed-url':
        data.url = getCellValue(value) || data.url;
        break;
      case 'title':
        data.title = textValue || data.title;
        break;
      case 'caption':
        data.caption = textValue || data.caption;
        break;
      default:
        break;
    }
  });

  return data;
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
  const data = normalizeBlock(block);

  if (!data.url) {
    block.remove();
    return;
  }

  block.textContent = '';

  const wrapper = document.createElement('figure');
  wrapper.className = `embed embed-${normalizeType(data.type)}`;

  const frame = createFrame(data);
  const frameWrap = document.createElement('div');
  frameWrap.className = 'embed-frame';
  frameWrap.append(frame);
  wrapper.append(frameWrap);

  if (data.title) {
    const title = createElement('figcaption', 'embed-title', data.title);
    wrapper.append(title);
  }

  if (data.caption) {
    const caption = createElement('figcaption', 'embed-caption', data.caption);
    wrapper.append(caption);
  }

  block.append(wrapper);
}
