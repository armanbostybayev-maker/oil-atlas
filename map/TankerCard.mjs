import { normalizeVesselType, vesselCompany } from './vessel-types.mjs';
import { parseAisTimestamp } from './ais-time.mjs';

export function createTankerCard(vessel, translate = value => value) {
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
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);border-top:1px solid #dce3e7;border-left:1px solid #dce3e7';
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
    cell.append(caption,result);grid.append(cell);
  };
  field('MMSI',vessel.mmsi);
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
  const time = parseAisTimestamp(vessel.timestamp);
  const received = parseAisTimestamp(vessel.receivedAt);
  if (time !== null) {
    field('Last AIS Position',new Date(time).toLocaleString());
    field('Position age',`${Math.max(0,Math.floor((Date.now()-time)/1000))} ${translate('seconds')}`);
  } else if (received !== null) field('Received at',new Date(received).toLocaleString());
  field('Latitude',numeric(vessel.lat)?.toFixed(5));
  field('Longitude',numeric(vessel.lon)?.toFixed(5));
  content.append(grid);
  return content;
}
