// Design-system colour tokens (tokens/colors.css), converted from oklch to sRGB hex for three.js.
export const C = {
  leaf100: 0xe1f7cd, leaf300: 0xa1d862, leaf500: 0x63af29, leaf600: 0x3d9028, leaf700: 0x1e6626,
  water300: 0x83d4d8, water500: 0x2ca0ac, water700: 0x005768,
  sky300: 0xa8e1fd, sky500: 0x5abdf2,
  parch50: 0xfbf7ec, parch100: 0xf7eed8, parch200: 0xeddcb9, parch300: 0xe0c394,
  wood300: 0xbf8d5b, wood500: 0x905a33, wood700: 0x60361e, wood800: 0x422617,
  coral400: 0xed7665, coral600: 0xc13d34,
  sun300: 0xf9d46b, sun500: 0xe9ab2b, sun700: 0xad721c,
  glow300: 0x6cfcd0, glow500: 0x1bd79e,
  ink900: 0x09281f, ink700: 0x274b3c,
  stone300: 0xcdcbbc, stone500: 0x8a8772,
};

export const STATUS_COLORS = [C.stone300, C.water300, C.sun300, C.leaf300];
export const STATUS_EDGE = [C.stone500, C.water500, C.sun700, C.leaf600];
export const hex = n => '#' + n.toString(16).padStart(6, '0');
