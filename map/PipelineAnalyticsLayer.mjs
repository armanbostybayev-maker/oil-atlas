import {pipelineGeoJSON,geometryLines,pipelineGroupKey} from '../analytics/pipelines.mjs';
export class PipelineAnalyticsLayer {
 constructor(map,onSelect){
  this.map=map;this.onSelect=onSelect;this.records=[];this.enabled=false;
  map.addSource('pipeline-analytics',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
  map.addLayer({id:'pipeline-analytics-lines',type:'line',source:'pipeline-analytics',layout:{visibility:'none'},paint:{'line-color':'#888','line-width':3,'line-opacity':.85}});
  map.addLayer({id:'pipeline-analytics-highlight',type:'line',source:'pipeline-analytics',layout:{visibility:'none'},paint:{'line-color':'#ffe060','line-width':7,'line-opacity':.9},filter:['==',['get','id'],'']});
  this.click=e=>{const hit=this.hit(e.point);if(hit)this.onSelect(hit.properties.id);};
  this.hover=e=>{const hit=this.hit(e.point);this.hovered=hit?.properties.id;this.highlight();if(hit)map.getCanvas().style.cursor='pointer';};
  this.leave=()=>{this.hovered=null;this.highlight();};
  map.on('click',this.click);map.on('mousemove',this.hover);map.on('mouseout',this.leave);
 }
 setData(records){if(this.records===records)return;this.records=records;this.map.getSource('pipeline-analytics')?.setData(pipelineGeoJSON(records));}
 hit(point){return this.enabled?this.map.queryRenderedFeatures(point,{layers:['pipeline-analytics-lines']})[0]:null;}
 update({enabled,filtered,selected,color,unit,group}){
  this.enabled=enabled;this.selected=selected;
  for(const id of ['pipeline-analytics-lines','pipeline-analytics-highlight'])this.map.setLayoutProperty(id,'visibility',enabled?'visible':'none');
  const ids=filtered.map(p=>p.id);this.visibleIds=new Set(ids);this.map.setFilter('pipeline-analytics-lines',['in',['get','id'],['literal',ids]]);
  const comparable=filtered.filter(p=>p.capacity_normalized!==null&&p.capacity_normalized_unit===unit&&group&&pipelineGroupKey(p)===group);
  const max=Math.max(1,...comparable.map(p=>p.capacity_normalized)),compatible=['in',['get','id'],['literal',comparable.map(p=>p.id)]];
  let expression;
  if(color==='product')expression=['match',['get','product'],'oil','#ed963b','gas','#398fda','condensate','#956bd1','products','#339963','#999'];
  else if(color==='status')expression=['match',['get','status'],'operating','#328b65','construction','#dc9232','proposed','#398fda','idle','#9c79b0','retired','#444','#999'];
  else if(color==='capacity')expression=['case',compatible,['interpolate',['linear'],['coalesce',['get','capacity'],0],0,'#c6e6ed',max,'#105267'],'#999'];
  else expression=['case',['==',['get','utilization'],null],'#999',['step',['get','utilization'],'#398fda',25.000001,'#319ca5',50.000001,'#328b65',75.000001,'#dc9232',100.000001,'#d03c3c']];
  const missing=color==='capacity'?['!',compatible]:color==='utilization'?['==',['get','utilization'],null]:['==',['get',color],'unknown'];
  this.map.setPaintProperty('pipeline-analytics-lines','line-color',expression);
  this.map.setPaintProperty('pipeline-analytics-lines','line-dasharray',['case',missing,['literal',[2,2]],['literal',[1,0]]]);
  this.map.setPaintProperty('pipeline-analytics-lines','line-width',['case',compatible,['interpolate',['linear'],['coalesce',['get','capacity'],0],0,2,max,8],3]);
  this.highlight();
 }
 highlight(){const ids=[this.selected,this.hovered].filter(id=>id&&this.visibleIds?.has(id));this.map.setFilter('pipeline-analytics-highlight',['in',['get','id'],['literal',ids]]);}
 focus(id){const p=this.records.find(p=>p.id===id);if(!p)return;const points=geometryLines(p.geometry).flat();if(!points.length)return;let west=180,east=-180,south=90,north=-90;for(const [x,y] of points){west=Math.min(west,x);east=Math.max(east,x);south=Math.min(south,y);north=Math.max(north,y);}this.map.fitBounds([[west,south],[east,north]],{padding:window.innerWidth>900?{left:410,right:340,top:130,bottom:100}:60,maxZoom:8,duration:450});}
 destroy(){this.map.off('click',this.click);this.map.off('mousemove',this.hover);this.map.off('mouseout',this.leave);for(const id of ['pipeline-analytics-highlight','pipeline-analytics-lines'])if(this.map.getLayer(id))this.map.removeLayer(id);if(this.map.getSource('pipeline-analytics'))this.map.removeSource('pipeline-analytics');}
}
