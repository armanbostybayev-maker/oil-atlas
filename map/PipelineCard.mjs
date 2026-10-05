import {safePipelineUrl} from '../analytics/pipelines.mjs';
const labels={oil:'Нефть',gas:'Газ',products:'Нефтепродукты',condensate:'Конденсат',other:'Прочее',operating:'Действует',construction:'Строится',proposed:'Проект',idle:'Простой',retired:'Закрыт',unknown:'Неизвестно'};
export function createPipelineCard(p){
 const card=document.createElement('div');card.className='pipeline-popup-card';
 const title=document.createElement('h3');title.textContent=p.name;card.append(title);
 const table=document.createElement('table');
 const row=(label,value)=>{const tr=document.createElement('tr'),th=document.createElement('th'),td=document.createElement('td');th.textContent=label;td.textContent=value==null||value===''?'Нет данных':typeof value==='object'?JSON.stringify(value):String(value);tr.append(th,td);table.append(tr);};
 for(const [label,value] of [['ID',p.source_id],['Продукт',labels[p.product]],['Статус',labels[p.status]],['Страны',p.countries.join('; ')],['Оператор',p.operator],['Владельцы',p.owners?.join('; ')],['Длина по источнику, км',p.length_km],['Год ввода',p.commissioning_year],['Мощность',p.capacity_value==null?null:`${p.capacity_value} ${p.capacity_unit||''}`],['Фактический поток',p.throughput_value==null?null:`${p.throughput_value} ${p.throughput_unit||''}`],['Источник',p.source],['Версия источника',p.source_release||'Неизвестна'],['Дата записи',p.source_date],['Точность маршрута',p.geometry_accuracy]])row(label,value);
 card.append(table);
 const url=safePipelineUrl(p.source_url);if(url){const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Открыть источник ↗';card.append(a);}
 const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Все исходные атрибуты';details.append(summary);
 const pre=document.createElement('pre');pre.textContent=JSON.stringify(p.original_properties??p.raw_properties??{},null,2);details.append(pre);card.append(details);
 return card;
}
