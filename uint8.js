//. uint8.js
/*
  x x x x x x x x     00 00 00 00 00 00 00 00     00 00
  x x x x x x x x     00 00 00 00 00 00 00 00     00 00
  x x x x x x x x     00 00 00 00 00 00 00 00     00 00
  x x x ○ ● x x x     00 00 00 11 01 00 00 00     03 40
  x x x ● ○ x x x  =  00 00 00 01 11 00 00 00  =  01 c0
  x x x x x x x x     00 00 00 00 00 00 00 00     00 00
  x x x x x x x x     00 00 00 00 00 00 00 00     00 00
  x x x x x x x x     00 00 00 00 00 00 00 00     00 00
 */

//. 16バイトで１画面を表現できる
var uint8array = new Uint8Array( [ 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x40, 0x01, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 ] );

console.log( uint8array );
console.log( uint8array[5] );
console.log( uint8array[6] );
console.log( uint8array[7] );
console.log( uint8array[8] );
console.log( uint8array[9] );
console.log( uint8array[10] );
