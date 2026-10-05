// JODI monthly KBD -> day-weighted annual bbl/day; no partial-year extrapolation.
export const JODI_METRICS = {
  crudeExports: ['primary','CRUDEOIL','TOTEXPSB','Crude oil exports'],
  productExports: ['secondary','TOTPRODS','TOTEXPSB','Petroleum product exports'],
  crudeImports: ['primary','CRUDEOIL','TOTIMPSB','Crude oil imports'],
  productImports: ['secondary','TOTPRODS','TOTIMPSB','Petroleum product imports'],
  crudeIntake: ['primary','CRUDEOIL','REFINOBS','Crude oil refinery intake'],
  productDemand: ['secondary','TOTPRODS','TOTDEMO','Petroleum product demand'],
  gasolineDemand: ['secondary','GASOLINE','TOTDEMO','Gasoline demand'],
  dieselDemand: ['secondary','GASDIES','TOTDEMO','Diesel / gasoil demand'],
  lpgDemand: ['secondary','LPG','TOTDEMO','LPG demand'],
  jetDemand: ['secondary','JETKERO','TOTDEMO','Jet fuel demand'],
  residualDemand: ['secondary','RESFUEL','TOTDEMO','Fuel oil demand'],
  naphthaDemand: ['secondary','NAPHTHA','TOTDEMO','Naphtha demand'],
};
export function annualObservation(records) {
  const months=new Map();
  for (const r of records) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(r.period)) throw Error('Invalid JODI month');
    if (months.has(r.period)) throw Error('Duplicate JODI month');
    months.set(r.period,r);
  }
  const rows=[...months.values()];
  if (rows.length!==12 || new Set(rows.map(r=>r.period.slice(0,4))).size!==1 || rows.some(r=>typeof r.value!=='number' || !Number.isFinite(r.value) || r.value<0 || r.assessment==='4')) return null;
  let total=0,days=0;
  for (const r of rows) {
    const [y,m]=r.period.split('-').map(Number), n=new Date(Date.UTC(y,m,0)).getUTCDate();
    total+=r.value*1000*n; days+=n;
  }
  return {value:total/days,year:Number(rows[0].period.slice(0,4)),months:12,assessment:[...new Set(rows.map(r=>r.assessment))].sort()};
}
