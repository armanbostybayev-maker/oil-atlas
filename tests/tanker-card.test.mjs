import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeVessel } from '../api/tankers.mjs';
import { safePhotoUrl } from '../map/TankerCard.mjs';
import { tankerFeatures, TankerLayer } from '../map/TankerLayer.mjs';

test('Tanker API preserves source attributes and missing numeric values', () => {
  const source = { mmsi: 273129320, latitude: 27.5, longitude: 34.1, flag: 'Russia', deadweight: 105547, speed_knots: null, draught_meters: '', cargo_state_confidence: 0, extra: { value: false } };
  const vessel = normalizeVessel(source);
  assert.deepEqual(vessel.sourceAttributes, source);
  assert.equal(vessel.flag, 'Russia');
  assert.equal(vessel.deadweight, 105547);
  assert.equal(vessel.speed, null);
  assert.equal(vessel.draught, null);
  assert.equal(vessel.timestamp, null);
  assert.equal(vessel.cargoStateConfidence, 0);
  assert.equal(normalizeVessel({ latitude: null, longitude: 0 }), null);
});

test('Photo URLs accept HTTPS and reject executable URLs and embedded credentials', () => {
  assert.equal(safePhotoUrl('https://example.com/ship.jpg'), 'https://example.com/ship.jpg');
  for (const value of [null, '', 'javascript:alert(1)', 'data:image/svg+xml,test', 'http://example.com/a', 'https://user:pass@example.com/a']) {
    assert.equal(safePhotoUrl(value), null);
  }
});

test('Full source attributes stay outside map worker data and survive selection', () => {
  const vessel = { mmsi: '273129320', lat: 27.5, lon: 34.1, sourceAttributes: { extra: 'retained' } };
  const layer = Object.create(TankerLayer.prototype);
  layer.map = { getSource: () => ({ setData() {} }) };
  layer.setData([vessel]);
  assert.equal(layer.vessels.get(vessel.mmsi), vessel);
  assert.equal(tankerFeatures([vessel]).points.features[0].properties.sourceAttributes, undefined);
});
