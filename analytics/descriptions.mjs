// Explanations describe the actual rules in atlas.mjs and config.mjs.
export const DESCRIPTIONS = {
  overview: {
    en: [
      "Explore the refinery inventory on a neutral world map. Circle sizes follow the square root of reported capacity, with minimum and maximum radii; grey dots have no numeric capacity.",
      "The summary counts visible records, active records, known capacity and matched countries. Owner and status filters update the points and summary.",
      "The inventory includes historical and closed sites. Recorded capacity is not actual throughput; missing capacity and possible shared-complex records limit totals.",
    ],
    ru: [
      "Обзор реестра НПЗ на нейтральной карте мира. Размер круга зависит от квадратного корня мощности и ограничен минимальным и максимальным радиусом. Серые точки — без числовой мощности.",
      "Плашки показывают видимые записи, действующие НПЗ, известную мощность и страны с привязанными объектами. Фильтры владельца и статуса меняют точки и итоги.",
      "В реестре есть исторические и закрытые объекты. Мощность не равна фактической переработке; пропуски и возможные записи общей мощности комплекса ограничивают достоверность сумм.",
    ],
  },
  balance: {
    en: [
      "Compare production, refining capacity and consumption. Switch between country typology and the two ratios.",
      "P/C = oil production / consumption. R/C = annual refinery tonnes × 7.33 / 365 / daily consumption. The barrels-per-tonne factor is approximate.",
      "Typology: exporter P/C ≥1.5 and R/C <1; hub R/C ≥1.25; import dependent both <0.5; large market consumption ≥P75; balanced both 0.8–1.2. Rules run in that order. Refining ratios require complete capacities without duplicate warnings. Years may differ; this is not a same-year trade balance.",
    ],
    ru: [
      "Сопоставление добычи, мощностей переработки и потребления. Можно выбрать типологию стран или одно из двух отношений.",
      "Добыча/потребление = добыча нефти / потребление. Переработка/потребление = т/год × 7,33 / 365 / барр./сут. Коэффициент баррелей на тонну приблизительный.",
      "Типология: экспортёр — Д/П ≥1,5 и Р/П <1; центр переработки — Р/П ≥1,25; импортозависимость — оба отношения <0,5; крупный рынок — потребление ≥75-го перцентиля; баланс — оба отношения 0,8–1,2. Правила применяются по порядку. Для отношений мощности нужны полные данные без предупреждений о дублях. Годы могут различаться: это не торговый баланс за один год.",
    ],
  },
  capacity: {
    en: [
      "Shade countries by recorded refining capacity, refinery count, average, median or largest refinery capacity. Refineries remain visible.",
      "Total = sum of known tonnes/year ÷ 1,000,000. Average = total capacity / refinery count. Quantitative colors use quintiles; the legend shows their limits.",
      "The sum can be partial and include closed or duplicate records. Average, median and maximum country estimates are withheld if capacity coverage is incomplete or duplicate candidates remain.",
    ],
    ru: [
      "Окраска стран по учтённой мощности, количеству НПЗ, средней, медианной или максимальной мощности. Точки НПЗ остаются на карте.",
      "Сумма = известные т/год ÷ 1 000 000. Средняя = суммарная мощность / количество НПЗ. Цветовые классы строятся по квинтилям; границы показаны в легенде.",
      "Сумма может быть неполной и включать закрытые объекты или дубли. Средняя, медиана и максимум для страны не рассчитываются при пропусках мощности или неподтверждённых дублях.",
    ],
  },
  production: {
    en: [
      "Compare total oil and liquids production, crude oil production or NGPL by country, in barrels/day.",
      "Values come from the corresponding country source fields. Colors use the 20th, 40th, 60th and 80th percentiles of known values.",
      "Each tooltip shows the source year. Missing values stay No data; refinery owner/status filters do not change national production figures.",
    ],
    ru: [
      "Сравнение общей добычи нефти и жидких углеводородов, сырой нефти или NGPL по странам, в баррелях в сутки.",
      "Используются соответствующие поля исходных данных стран. Цветовые границы — 20-й, 40-й, 60-й и 80-й перцентили известных значений.",
      "В подсказке указан год источника. Пропуски остаются «Нет данных»; фильтры владельца и статуса НПЗ не изменяют национальную добычу.",
    ],
  },
  consumption: {
    en: [
      "Map national oil/products consumption, consumption per refinery, or consumption relative to refining capacity.",
      "Consumption per refinery = daily consumption / matched refinery records. Consumption/refining = daily consumption / (annual tonnes × 7.33 / 365).",
      "A zero or missing denominator gives No data. Refining comparisons require complete capacity coverage without duplicate warnings; consumption year and capacity vintage may differ.",
    ],
    ru: [
      "Потребление нефти и нефтепродуктов по странам, потребление на один НПЗ или отношение потребления к мощности переработки.",
      "На НПЗ = суточное потребление / число привязанных записей НПЗ. Потребление/переработка = суточное потребление / (т/год × 7,33 / 365).",
      "Нулевой или неизвестный знаменатель даёт «Нет данных». Для сравнения с переработкой нужны полные мощности без предупреждений о дублях; годы потребления и мощности могут различаться.",
    ],
  },
  infrastructure: {
    en: [
      "Inspect the number and size of refineries, the largest refinery’s share and capacity concentration.",
      "Largest share = largest capacity / total capacity ×100%. HHI = sum of squared capacity shares ×10,000; larger values mean greater concentration.",
      "Counts are inventory records. Size and concentration measures need complete capacities and no unresolved duplicate candidates. A country with no matched refineries does not necessarily have zero national capacity.",
    ],
    ru: [
      "Количество и размеры НПЗ, доля крупнейшего объекта и концентрация перерабатывающих мощностей.",
      "Доля крупнейшего = максимальная мощность / суммарная ×100%. HHI = сумма квадратов долей мощности ×10 000; большее значение означает более высокую концентрацию.",
      "Количество относится к записям реестра. Размеры и концентрация требуют полных мощностей без неподтверждённых дублей. Отсутствие привязанных НПЗ не доказывает нулевую мощность страны.",
    ],
  },
  age: {
    en: [
      "Show the mean or median reported operating age, or counts older than 30, 50 or 70 years.",
      "Only explicit, reliable age values are used. Means and medians use known ages; the tooltip shows age coverage. Unknown ages are not zero.",
      "For closed sites, the source can describe years of operation until closure; for active sites, age is reported for 2026. Approximate ages and company-age descriptions are excluded.",
    ],
    ru: [
      "Средний или медианный известный срок эксплуатации, а также количество НПЗ старше 30, 50 или 70 лет.",
      "Используются только явно указанные и достоверно интерпретируемые значения возраста. Средняя и медиана считаются по известным значениям; покрытие показано в подсказке. Неизвестный возраст не равен нулю.",
      "Для закрытых объектов источник может указывать срок работы до закрытия, для действующих — возраст на 2026 год. Приблизительные значения и возраст юридического лица исключены.",
    ],
  },
  status: {
    en: [
      "Select a refinery status and map its count, share or known capacity by country. Points are filtered to that status.",
      "Status share = visible selected-status refinery records / all matched refinery records in the country ×100%. Owner filters can further narrow the visible set.",
      "The short source status field is used: Active, Closed, Modernization or Unknown. Detailed-status conflicts are listed in Data quality. Status is dated 2026; capacity years vary.",
    ],
    ru: [
      "Выберите статус НПЗ и отобразите его количество, долю или известную мощность по странам. На карте останутся точки выбранного статуса.",
      "Доля = видимые записи выбранного статуса / все привязанные записи НПЗ страны ×100%. Фильтр владельца может дополнительно сузить набор.",
      "Используется краткий статус источника: действующий, закрыт, модернизация или неизвестно. Расхождения с подробным статусом перечислены в качестве данных. Статус относится к 2026 году; годы мощности различаются.",
    ],
  },
  products: {
    en: [
      "Compare the share of diesel, gasoline, LPG, jet/kerosene or residual fuel oil in national consumption.",
      "Country colors show the selected product’s percentage directly from the source. Country cards use horizontal bars for all five products.",
      "Missing product shares are not filled or rescaled to make 100%. The consumption reference year is shown alongside the chart.",
    ],
    ru: [
      "Доли дизеля, бензина, СУГ, авиатоплива/керосина или мазута в потреблении страны.",
      "Цвет страны показывает процент выбранного продукта из источника. В карточке страны пять продуктов представлены горизонтальными полосами.",
      "Пропущенные доли не заполняются и не пересчитываются так, чтобы получить 100%. Рядом с диаграммой указан год потребления.",
    ],
  },
  economics: {
    en: [
      "Compare GDP, GDP growth, CPI inflation and refining/consumption/production intensity relative to GDP.",
      "Refining intensity = annual tonnes / GDP in billion USD. Consumption and production intensity = barrels/day / GDP in billion USD.",
      "Each metric retains its source year; ratios can combine different years. Growth and inflation use a diverging scale when both negative and positive values exist. Missing or zero GDP cannot be a denominator.",
    ],
    ru: [
      "ВВП, рост ВВП, инфляция ИПЦ и интенсивность переработки, потребления или добычи относительно ВВП.",
      "Интенсивность переработки = т/год / ВВП в млрд USD. Интенсивность потребления и добычи = барр./сут. / ВВП в млрд USD.",
      "Для каждого показателя сохраняется год источника; отношения могут объединять разные годы. При положительных и отрицательных значениях роста и инфляции применяется расходящаяся шкала. Неизвестный или нулевой ВВП не используется как знаменатель.",
    ],
  },
  prices: {
    en: [
      "Compare gasoline, diesel, jet/kerosene, LPG or residual fuel prices, within one selected source unit.",
      "A country needs a numeric price, a price date and a compatible unit. Different units are kept separate rather than compared directly.",
      "The supplied files currently contain no verified numeric prices, dates or price units, so this mode displays No data. No prices are generated or substituted.",
    ],
    ru: [
      "Сравнение цен бензина, дизеля, авиатоплива/керосина, СУГ или мазута в одной выбранной единице источника.",
      "Для страны нужны числовая цена, дата и совместимая единица измерения. Разные единицы разделяются, а не сравниваются напрямую.",
      "В предоставленных файлах пока нет подтверждённых числовых цен, дат и единиц цены, поэтому режим показывает «Нет данных». Цены не генерируются и не подставляются.",
    ],
  },
  owners: {
    en: [
      "Open All companies in the upper-right corner and select or search for an owner to inspect its geographic footprint. Hover highlights its points; click filters and fits the map.",
      "Owner totals aggregate known recorded capacity, record count, matched countries and the largest known refinery. Ranking is by known capacity descending.",
      "Joint ventures are not split into equity shares. Historical ownership, missing capacity and possible duplicate complex records affect the ranking. Clear the filter to restore all owners.",
    ],
    ru: [
      "Откройте «Все компании» справа вверху и выберите или найдите владельца, чтобы увидеть его предприятия. Наведение подсвечивает точки; клик фильтрует их и подбирает масштаб карты.",
      "Для владельца суммируются известные записанные мощности, число записей, страны привязки и определяется крупнейший известный НПЗ. Рейтинг сортируется по известной мощности по убыванию.",
      "Совместные предприятия не разделяются по долям участия. Исторические владельцы, пропуски и возможные дубли комплексов влияют на рейтинг. Сброс фильтра возвращает всех владельцев.",
    ],
  },
  anomalies: {
    en: [
      "Highlight countries matching a selected analytical signal; hide refinery points outside matching countries.",
      "High production/consumption uses the 75th percentile. Surplus means R/C >1.5, deficit R/C <0.5. Many small: count ≥P75 and average size <P25. Few large: 1–3 refineries and average size ≥P75.",
      "Closed capacity share >25% requires complete capacity. Old active fleet: mean age >50, at least 3 known ages and ≥70% active-age coverage. These are exploratory inventory signals, not measured trade flows; missing data cannot establish an anomaly.",
    ],
    ru: [
      "Подсветка стран по выбранному аналитическому признаку. Точки НПЗ вне подходящих стран скрываются.",
      "Высокая добыча/потребление — от 75-го перцентиля. Избыток — Р/П >1,5, дефицит — Р/П <0,5. Много небольших НПЗ: количество ≥P75, средняя мощность <P25. Несколько крупных: 1–3 НПЗ и средняя мощность ≥P75.",
      "Доля закрытых мощностей >25% требует полных данных. Старый действующий парк: средний возраст >50 лет, минимум 3 известных возраста и покрытие ≥70%. Это исследовательские признаки реестра, а не измеренные торговые потоки; пропуски не доказывают аномалию.",
    ],
  },
};
