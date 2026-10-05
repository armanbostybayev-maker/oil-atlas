// Original vector pumpjack, inspired by the supplied oil.png silhouette.
// White casing keeps the status colour legible on light and dark basemaps.
export function oilfieldIconSvg(color = '#000', selected = false) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><g stroke="${selected ? '#f8ce52' : '#fff'}" stroke-width="5" stroke-linejoin="round" paint-order="stroke" fill="${color}"><path d="M24 23h9l13 34H12zm4 9-5 13h10zm-9 20h20l-10-8z" fill-rule="evenodd"/><path d="M7 9q4-8 10-5l5 6-3 9 38 19-4 8L15 26l-5 4-7-5z"/><path d="M49 40h5v17h-5zM5 56h53v5H5zM6 28h4v28H6z"/></g></svg>`;
}

// Original platform silhouette: derrick, pumpjack, processing tanks and braced legs.
export function offshoreIconSvg(selected = false) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><g fill="#000" stroke="${selected ? '#f8ce52' : '#fff'}" stroke-width="3" stroke-linejoin="round" paint-order="stroke"><path fill-rule="evenodd" d="M23 5h6l5 34H18zm3 6-2 8h4zm-3 13-2 10h10l-3-10z"/><path d="M5 26l4-9 7-4 3 5-8 6 10 9-3 4-10-10v12H5zM37 21a4 4 0 0 1 8 0v18h-8zM48 21a4 4 0 0 1 8 0v18h-8zM3 39h58v9H3zM7 47h7v14H7zM50 47h7v14h-7zM15 48h5l12 8 12-8h5L32 61z"/></g></svg>`;
}
