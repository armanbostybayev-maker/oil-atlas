import { FIELD_STATUSES, statusStyle, oilfieldGeoJSON, fieldStatus } from '../analytics/oilfields.mjs';
import { oilfieldIconSvg, offshoreIconSvg } from './oilfield-icon.mjs';

export const OILFIELD_LAYERS = ['oilfield-clusters','oilfield-cluster-count','oilfield-points','oilfield-selection'];
const empty = () => ({ type: 'FeatureCollection', features: [] });

export class OilfieldLayer {
  constructor(map, { onSelect, Popup, translate = value => value, onError = () => {} }) {
    this.map = map;
    this.onSelect = onSelect;
    this.translate = translate;
    this.fields = new Map();
    this.enabled = true;
    this.clustered = true;
    this.images = new Set();
    this.destroyed = false;
    this.popup = new Popup({ closeButton: false, closeOnClick: false, maxWidth: '290px' });
    this.data = empty();
    this.missingImage = event => {
      if (!event.id.startsWith('oilfield-count-')) return;
      const count = Number(event.id.slice('oilfield-count-'.length));
      if (!Number.isFinite(count)) return;
      const canvas = document.createElement('canvas');
      canvas.width = 104; canvas.height = 64;
      const context = canvas.getContext('2d');
      context.font = '600 25px Segoe UI, Arial';
      context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillStyle = '#fff';
      context.fillText(count.toLocaleString(), 52, 32);
      map.addImage(event.id, context.getImageData(0,0,104,64), { pixelRatio: 2 });
      this.images.add(event.id);
    };
    map.on('styleimagemissing', this.missingImage);
    this.click = async event => {
      const feature = this.hit(event.point);
      if (!feature) return;
      this.popup.remove();
      if (feature.properties.cluster) {
        try {
          const zoom = await map.getSource('oilfields').getClusterExpansionZoom(feature.properties.cluster_id);
          if (!this.destroyed) map.easeTo({ center: feature.geometry.coordinates, zoom: Math.min(zoom + .25,17), duration: 450 });
        } catch { /* Source may have been rebuilt after a filter change. */ }
      } else {
        const field = this.fields.get(feature.properties.id);
        if (field) this.onSelect(field);
      }
    };
    this.hover = event => {
      const feature = this.hit(event.point);
      if (!feature) { this.popup.remove(); return; }
      map.getCanvas().style.cursor = 'pointer';
      if (feature.properties.cluster) { this.popup.remove(); return; }
      const field = this.fields.get(feature.properties.id);
      if (!field) return;
      const content = document.createElement('div');
      for (const [i, text] of [field.name, field.country, this.translate(FIELD_STATUSES[fieldStatus(field)]?.label || field.status || 'Unknown status'), this.translate(field.objectType || '')].entries()) {
        const line = document.createElement(i === 0 ? 'strong' : 'div');
        line.textContent = text || ''; content.append(line);
      }
      this.popup.setLngLat(feature.geometry.coordinates).setDOMContent(content).addTo(map);
    };
    this.leave = () => this.popup.remove();
    map.on('click', this.click); map.on('mousemove', this.hover); map.on('mouseout', this.leave);
    this.ready = Promise.all(['onshore','offshore'].flatMap(kind => [false,true].map(selected => new Promise((resolve,reject) => {
      const image = new Image();
      image.onload = () => {
        if (!this.destroyed) {
          const id = `oilfield-${kind}${selected ? '-selected' : ''}`;
          map.addImage(id,image,{ pixelRatio: 2 }); this.images.add(id);
        }
        resolve();
      };
      image.onerror = reject;
      image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(kind === 'offshore' ? offshoreIconSvg(selected) : oilfieldIconSvg('#000',selected));
    })))).then(() => { if (!this.destroyed) this.build(); }).catch(onError);
  }
  hit(point) {
    if (!this.enabled) return null;
    // Tankers retain priority when symbols overlap.
    if (this.map.getLayer('tankers') && this.map.queryRenderedFeatures(point,{layers:['tankers']}).length) return null;
    const layers = OILFIELD_LAYERS.filter(id => this.map.getLayer(id));
    return layers.length ? this.map.queryRenderedFeatures(point,{ layers })[0] : null;
  }
  build() {
    const map = this.map;
    for (const id of [...OILFIELD_LAYERS].reverse()) if (map.getLayer(id)) map.removeLayer(id);
    for (const id of ['oilfields','oilfield-selected']) if (map.getSource(id)) map.removeSource(id);
    map.addSource('oilfields',{ type:'geojson',data:this.data,cluster:this.clustered,clusterRadius:45,clusterMaxZoom:13 });
    map.addSource('oilfield-selected',{ type:'geojson',data:empty() });
    const before = map.getLayer('tankers') ? 'tankers' : undefined;
    map.addLayer({ id:'oilfield-clusters',type:'circle',source:'oilfields',filter:['has','point_count'],paint:{'circle-color':'#000','circle-radius':['step',['get','point_count'],17,50,22,500,27],'circle-stroke-width':2,'circle-stroke-color':'#fff'} },before);
    map.addLayer({ id:'oilfield-cluster-count',type:'symbol',source:'oilfields',filter:['has','point_count'],layout:{'icon-image':['concat','oilfield-count-',['to-string',['get','point_count']]],'icon-allow-overlap':true} },before);
    const status = ['match',['get','locationKind'],'offshore','offshore','onshore'];
    map.addLayer({ id:'oilfield-points',type:'symbol',source:'oilfields',filter:['!', ['has','point_count']],layout:{'icon-image':['concat','oilfield-',status],'icon-size':['interpolate',['linear'],['zoom'],0,.7,7,.9,13,1.1],'icon-allow-overlap':true} },before);
    map.addLayer({ id:'oilfield-selection',type:'symbol',source:'oilfield-selected',layout:{'icon-image':['concat','oilfield-',status,'-selected'],'icon-size':1.35,'icon-allow-overlap':true} },before);
    this.setVisible(this.enabled);
    this.select(this.selected);
  }
  setData(fields) {
    this.fields = new Map(fields.map(field => [field.id,field]));
    this.data = oilfieldGeoJSON(fields);
    this.map.getSource('oilfields')?.setData(this.data);
    this.popup.remove();
    this.select(this.selected);
  }
  select(field) {
    this.selected = field;
    this.map.getSource('oilfield-selected')?.setData(oilfieldGeoJSON(field && this.fields.has(field.id) ? [field] : []));
  }
  setVisible(enabled) {
    this.enabled = enabled;
    for (const id of OILFIELD_LAYERS) if (this.map.getLayer(id)) this.map.setLayoutProperty(id,'visibility',enabled ? 'visible' : 'none');
    if (!enabled) this.popup.remove();
  }
  setClustering(clustered) {
    if (this.clustered === clustered) return;
    this.clustered = clustered;
    if (this.map.getSource('oilfields')) this.build();
  }
  destroy() {
    this.destroyed = true;
    this.popup.remove();
    for (const [event, handler] of [['styleimagemissing',this.missingImage],['click',this.click],['mousemove',this.hover],['mouseout',this.leave]]) this.map.off(event,handler);
    for (const id of [...OILFIELD_LAYERS].reverse()) if (this.map.getLayer(id)) this.map.removeLayer(id);
    for (const id of ['oilfields','oilfield-selected']) if (this.map.getSource(id)) this.map.removeSource(id);
    for (const id of this.images) if (this.map.hasImage(id)) this.map.removeImage(id);
  }
}
