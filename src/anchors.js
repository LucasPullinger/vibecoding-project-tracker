export const DEFAULT_ANCHORS = [
  { id: 'presentation', label: 'Presentation', url: null },
  { id: 'demo', label: 'Demo', url: null },
  { id: 'report', label: 'Report', url: null },
  { id: 'documentation', label: 'Documentation', url: null },
];

export function isValidDeliverableUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidAnchors(anchors) {
  if (!Array.isArray(anchors) || anchors.length !== DEFAULT_ANCHORS.length) return false;

  const ids = new Set();

  return anchors.every((anchor) => {
    if (!anchor || typeof anchor !== 'object') return false;

    const keys = Object.keys(anchor).sort();
    if (keys.join(',') !== 'id,label,url') return false;
    if (ids.has(anchor.id) || typeof anchor.label !== 'string' || !anchor.label.trim()) return false;

    ids.add(anchor.id);
    return anchor.url === null || isValidDeliverableUrl(anchor.url);
  });
}
