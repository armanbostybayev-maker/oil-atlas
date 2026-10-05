const names = new Intl.DisplayNames(['en'], {type:'region'});
const russian = new Intl.DisplayNames(['ru'], {type:'region'});
const codes = new Map();
for (let a=65;a<=90;a++) for (let b=65;b<=90;b++) {
  const code=String.fromCharCode(a,b), name=names.of(code);
  if (name !== code) codes.set(name.toLowerCase(),code);
}
for (const [name,code] of Object.entries({'russia':'RU','south korea':'KR','north korea':'KP','iran':'IR','syria':'SY','vietnam':'VN','taiwan':'TW','tanzania':'TZ','bolivia':'BO','venezuela':'VE','united states of america':'US','uk':'GB'})) codes.set(name,code);
export function countryCode(value) {
  const raw=String(value || '').trim();
  return /^[a-z]{2}$/i.test(raw) ? raw.toUpperCase() : codes.get(raw.toLowerCase()) || null;
}
export function countryName(value, language='en') {
  const code=countryCode(value);
  return code ? (language === 'ru' ? russian : names).of(code) : value;
}
export function oilfieldName(field, language='en') {
  return language === 'ru' && /[А-Яа-яЁё]/.test(field.localName || '') ? field.localName : field.name || field.id;
}
