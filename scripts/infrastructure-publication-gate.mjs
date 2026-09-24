/**
 * A prepared dataset is not a publication authorization.
 * Keep this check separate from geometric/provenance validation.
 */
export function publicationIssues(manifest, datasets) {
  const issues = [];
  const records = Array.isArray(manifest?.datasets) ? manifest.datasets : [];
  for (const { type, features } of datasets) {
    if (!features) continue;
    const record = records.find(item => item.type === type);
    if (manifest?.status !== "approved_for_publication") issues.push(`${type}: manifest status is not approved_for_publication`);
    if (!record?.source_release || !String(record.source_release).trim()) issues.push(`${type}: missing dataset release`);
    if (!record?.redistribution_permission || !String(record.redistribution_permission).trim()) issues.push(`${type}: missing redistribution permission evidence`);
    if (!record?.attribution || !String(record.attribution).trim()) issues.push(`${type}: missing required attribution`);
    if (!record?.permission_url || !/^https:\/\//i.test(record.permission_url)) issues.push(`${type}: missing HTTPS permission reference`);
    if (record?.features !== features) issues.push(`${type}: manifest feature count does not match published data`);
  }
  return issues;
}

export function tilePublicationIssues(manifest, env = {}) {
  const issues = [];
  for (const [type, key] of [["oil", "VITE_OIL_PIPELINE_TILES"], ["gas", "VITE_GAS_PIPELINE_TILES"]]) {
    if (!env[key]) continue;
    const record = manifest?.datasets?.find(item => item.type === type);
    if (manifest?.status !== "approved_for_publication") issues.push(`${type}: tile URL configured without approved manifest`);
    if (!record?.source_release || !String(record.source_release).trim()) issues.push(`${type}: tile source release missing`);
    if (!record?.redistribution_permission || !String(record.redistribution_permission).trim()) issues.push(`${type}: tile redistribution evidence missing`);
    if (!record?.attribution || !String(record.attribution).trim()) issues.push(`${type}: tile attribution missing`);
    if (!record?.permission_url || !/^https:\/\//i.test(record.permission_url)) issues.push(`${type}: tile permission reference missing`);
  }
  return issues;
}
