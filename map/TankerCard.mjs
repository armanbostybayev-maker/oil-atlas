import { normalizeVesselType, vesselCompany } from './vessel-types.mjs';
import { parseAisTimestamp } from './ais-time.mjs';
import { countryCode, countryName } from '../utils/country-display.mjs';

export function safePhotoUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
export function createTankerCard(vessel, translate = value => value, { grouped = false } = {}) {
  const content = document.createElement('div');
  content.className = 'tanker-card';
  content.style.cssText = 'width:360px;max-width:calc(100vw - 60px);font-family:Segoe UI,Arial,sans-serif';
  const text = value => value == null || /^(?:undefined|null|nan)?$/i.test(String(value).trim()) ? null : String(value).trim();
  const numeric = value => text(value) !== null && Number.isFinite(Number(value)) ? Number(value) : null;
  const angle = value => {const n=numeric(value);return n!==null && n>=0 && n<360 ? `${Math.round(n)}°` : null;};
  const type = normalizeVesselType(vessel);
  const title = document.createElement('strong');
  title.textContent = text(vessel.name) || translate('Vessel name unavailable');
  title.style.cssText = 'display:block;font-size:19px;color:#17232b;margin-bottom:10px';
  content.append(title);
  const flagCode = countryCode(vessel.flag);
  if (flagCode) {
    const flag = document.createElement('img');
    flag.src = `https://flagcdn.com/w80/${flagCode.toLowerCase()}.png`;
    flag.alt = countryName(vessel.flag, translate('Country') === 'Страна' ? 'ru' : 'en');
    flag.width = 40; flag.style.cssText = 'height:27px;object-fit:contain;margin:0 8px 10px 0';
    flag.addEventListener('error',()=>flag.remove(),{once:true});
    content.append(flag);
  }
  const photoNote = document.createElement('p');
  photoNote.textContent = translate('Photo not supplied by the source');
  photoNote.style.cssText = 'font-size:12px;color:#7b8991;margin:0 0 12px';
  const photoUrl = safePhotoUrl(vessel.photoUrl);
  if (photoUrl) {
    const photo = document.createElement('img');
    photo.alt = text(vessel.name) || translate('Vessel photo');
    photo.style.cssText = 'display:block;width:100%;max-height:190px;object-fit:contain;border-radius:8px;margin-bottom:8px';
    photo.referrerPolicy = 'no-referrer';
    photo.addEventListener('error', () => {
      photo.remove();
      photoNote.textContent = translate('Photo unavailable');
    }, { once: true });
    photo.src = photoUrl;
    content.append(photo);
    photoNote.textContent = text(vessel.photoCredit) || translate('Vessel photo');
  }
  content.append(photoNote);
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);border-top:1px solid #dce3e7;border-left:1px solid #dce3e7';
  const groups = ['Basic information','Position and movement','Voyage and destination','Technical characteristics','Source and update time'].map((label,index) => {
    const details = document.createElement('details');
    details.className = 'tanker-attribute-group';
    details.open = index === 0;
    const summary = document.createElement('summary');
    const body = grid.cloneNode();
    body.id = `tanker-group-${String(vessel.mmsi).replace(/\W/g,'')}-${index}`;
    summary.textContent = translate(label);
    summary.setAttribute('aria-controls',body.id);
    summary.setAttribute('aria-expanded',String(details.open));
    details.addEventListener('toggle',() => summary.setAttribute('aria-expanded',String(details.open)));
    details.append(summary,body);
    return { details,body };
  });
  const fieldGroup = label => {
    if (['Status','Speed','Course','Heading','Latitude','Longitude'].includes(label)) return 1;
    if (['Destination','Cargo state (source estimate)','Estimate confidence','Estimate reason'].includes(label)) return 2;
    if (['Draught','Deadweight'].includes(label)) return 3;
    if (['Position source','Draught source','Draught observed at','Draught age at source','Last AIS Position','Position age','Received at'].includes(label)) return 4;
    return 0;
  };
  const field = (label,value) => {
    if (text(value) === null) return;
    const cell = document.createElement('div');
    cell.style.cssText = 'padding:8px 9px;border-right:1px solid #dce3e7;border-bottom:1px solid #dce3e7';
    const caption = document.createElement('div');
    caption.textContent = translate(label);
    caption.style.cssText = 'font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:#7b8991';
    const result = document.createElement('div');
    result.textContent = String(value);
    result.style.cssText = 'font-size:13px;font-weight:600;color:#25343c;margin-top:3px;overflow-wrap:anywhere';
    cell.append(caption,result);(grouped ? groups[fieldGroup(label)].body : grid).append(cell);
  };
  field('MMSI',vessel.mmsi);
  field('Flag state', countryName(text(vessel.flag), translate('Country') === 'Страна' ? 'ru' : 'en') || translate('Not supplied'));
  field('Vessel ID',vessel.vesselId);
  if (Number(vessel.imo)>0) field('IMO',vessel.imo);
  field('Call Sign',vessel.callSign);
  field('Source type',vessel.vesselTypeName || vessel.typeName || (typeof vessel.vesselType==='string' && !Number.isFinite(Number(vessel.vesselType)) ? vessel.vesselType : null));
  field('AIS ship type code',type?.aisShipType);
  field('Normalized type',type ? translate(type.vesselTypeLabel) : null);
  field('Company / Owner',vesselCompany(vessel));
  field('Status',text(vessel.status) ? translate(vessel.status) : null);
  const speed = numeric(vessel.speed);
  field('Speed',speed!==null && speed>=0 && speed<102.3 ? `${speed.toFixed(1)} kn` : null);
  field('Course',angle(vessel.course));
  field('Heading',angle(vessel.heading));
  const draught = numeric(vessel.draught);
  field('Draught',draught!==null && draught>0 ? `${draught.toFixed(1)} m` : null);
  field('Destination',vessel.destination);
  field('Deadweight', numeric(vessel.deadweight) !== null ? `${numeric(vessel.deadweight).toLocaleString()} t` : null);
  field('Cargo state (source estimate)', text(vessel.cargoState) ? translate(vessel.cargoState) : null);
  const confidence = numeric(vessel.cargoStateConfidence);
  field('Estimate confidence', confidence !== null && confidence >= 0 && confidence <= 1 ? `${Math.round(confidence * 100)}%` : null);
  field('Estimate reason',vessel.cargoStateReason);
  field('Position source',vessel.positionSource);
  field('Sanctions status (source)',text(vessel.sanctionsStatus) || translate('Not supplied'));
  field('Draught source',vessel.draughtSource);
  const draughtTime = parseAisTimestamp(vessel.draughtObservedAt);
  field('Draught observed at',draughtTime !== null ? new Date(draughtTime).toLocaleString() : null);
  field('Draught age at source',numeric(vessel.draughtAgeHours) !== null ? `${numeric(vessel.draughtAgeHours).toFixed(1)} h` : null);
  const time = parseAisTimestamp(vessel.timestamp);
  const received = parseAisTimestamp(vessel.receivedAt);
  if (time !== null) {
    field('Last AIS Position',new Date(time).toLocaleString());
    field('Position age',`${Math.max(0,Math.floor((Date.now()-time)/1000))} ${translate('seconds')}`);
  } else if (received !== null) field('Received at',new Date(received).toLocaleString());
  field('Latitude',numeric(vessel.lat)?.toFixed(5));
  field('Longitude',numeric(vessel.lon)?.toFixed(5));
  if (grouped) {
    for (const group of groups) {
      if (!group.body.childElementCount) {
        const note = document.createElement('p'); note.textContent = translate('No open data'); group.body.append(note);
      }
      content.append(group.details);
    }
  } else content.append(grid);
  const details = document.createElement('details');
  details.style.cssText = 'margin-top:12px;font-size:12px';
  const summary = document.createElement('summary');
  summary.textContent = translate('All source attributes');
  const raw = document.createElement('pre');
  raw.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px;max-height:240px;overflow:auto';
  raw.textContent = JSON.stringify(vessel.sourceAttributes || vessel, null, 2);
  details.append(summary, raw);
  content.append(details);
  return content;
}
