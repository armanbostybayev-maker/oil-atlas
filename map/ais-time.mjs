// AISStream's Go timestamps have nanoseconds and a redundant UTC suffix;
// Date.parse in browsers does not accept that representation consistently.
export function parseAisTimestamp(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !value.trim()) return null;
  const provider = value.trim().match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(?:\.(\d+))? ([+-]\d{2})(\d{2})(?: UTC)?$/);
  const text = provider
    ? `${provider[1]}T${provider[2]}.${(provider[3] || '').padEnd(3,'0').slice(0,3)}${provider[4]}:${provider[5]}`
    : value;
  const time = Date.parse(text);
  return Number.isFinite(time) ? time : null;
}
