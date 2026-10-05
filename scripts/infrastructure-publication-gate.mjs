/**
 * A prepared dataset is not a publication authorization.
 * Keep this check separate from geometric/provenance validation.
 */
export function publicationIssues(manifest, datasets) {
  const issues = [];
  const records = Array.isArray(manifest?.datasets) ? manifest.datasets : [];
  for (const { type, features, sha256 } of datasets) {
    if (!features) continue;
    const record = records.find(item => item.type === type);
    if (manifest?.status !== "approved_for_publication") issues.push(`${type}: manifest status is not approved_for_publication`);
    // An explicit user-approved unknown release applies only to these exact published bytes.
    const approvedUnknown = record?.release_status === 'unknown_user_confirmed' &&
      record?.unknown_release_approval === 'User authorized publication and confirmed release unknown on 2026-09-25' &&
      /^[a-f0-9]{64}$/.test(record?.published_sha256 || '') && record.published_sha256 === sha256;
    if ((!record?.source_release || !String(record.source_release).trim()) && !approvedUnknown) issues.push(`${type}: missing dataset release`);
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
