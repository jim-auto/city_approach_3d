// Individual game characters use four authored bases; source licenses live in models/LICENSE.txt.
export const CAST = {
  player: { base: 'male', height: 2.24, clothes: '#303544', hair: '#49362e', prop: 'watch', chain: true },
  waiting: { base: 'yui', height: 2.10, prop: 'phone', smile: .12 },
  eye: { base: 'bob', height: 2.08, clothes: '#b5b3ec', hair: '#363044', prop: 'bag', smile: .22 },
  tourist: { base: 'bob', height: 2.16, clothes: '#e3b86f', hair: '#805739', prop: 'camera', smile: .08 },
  busy: { base: 'yui', height: 2.17, clothes: '#6486a9', hair: '#292936', prop: 'phone', smile: 0 },
  earphones: { base: 'ribbon', height: 2.12, clothes: '#88ab98', hair: '#403944', prop: 'headphones', smile: 0 },
  cafe: { base: 'bob', height: 2.13, clothes: '#e58b74', hair: '#704939', prop: 'coffee', smile: .16 },
  reader: { base: 'bob', height: 2.11, clothes: '#a998c2', hair: '#49373f', prop: 'book', glasses: true, smile: .03 },
  friend: { base: 'ribbon', height: 2.15, clothes: '#80b6c1', hair: '#77503b', prop: 'bag', smile: .12 },
  catch: { base: 'male', height: 2.19, clothes: '#704659', hair: '#29222b', prop: 'menu' },
  scout: { base: 'male', height: 2.26, clothes: '#313b52', hair: '#6a4834', prop: 'watch', glasses: true },
  toyoko_sora: { base: 'ribbon', height: 2.10, clothes: '#51435d', hair: '#b985a4', prop: 'headphones', smile: .1 },
  toyoko_ruka: { base: 'male', height: 2.16, clothes: '#a2b9b2', hair: '#4c3b51', prop: 'phone' },
  toyoko_neo: { base: 'ribbon', height: 2.13, clothes: '#8e82a7', hair: '#867098', prop: 'phone', smile: .06 },
  night_mai: { base: 'yui', height: 2.16, clothes: '#c8adad', hair: '#4f303e', prop: 'phone', smile: .08 },
  night_rei: { base: 'bob', height: 2.14, clothes: '#c49ab2', hair: '#a27545', prop: 'bag', smile: .1 },
  night_kaito: { base: 'male', height: 2.25, clothes: '#c2bbc9', hair: '#aa8055', prop: 'watch', chain: true },
};
export const MODEL_FILES = { yui: 'yui.vrm', bob: 'bob.vrm', ribbon: 'ribbon.vrm', male: 'male.vrm' };
