//. main.js
var reversi = require( './reversi' );

getInitBoard = function( board_size ){
  var init_board = null;

  if( board_size == 4 || board_size == 6 || board_size == 8 ){
    var padding = ( board_size / 2 ) - 1;
    var padding_line = [];
    for( var i = 0; i < board_size; i ++ ){
      padding_line.push( 0 );
    }
    var line1 = [ 1, -1 ];
    var line2 = [ -1, 1 ];
    for( var i = 0; i < padding; i ++ ){
      line1.unshift( 0 );
      line1.push( 0 );
      line2.unshift( 0 );
      line2.push( 0 );
    }

    init_board = [ line1, line2 ];
    for( var i = 0; i < padding; i ++ ){
      init_board.unshift( padding_line );
      init_board.push( padding_line );
    }
  }

  return init_board;
};

initReversi = function( board_size ){
  var init_board = getInitBoard( board_size );
  var reversi0 = new reversi( null, null, 0, -1, [ -1, -1 ], init_board, -1 );

  return reversi0;
};

var N = 8;
if( process.argv.length > 2 ){
  try{
    var n = parseInt( process.argv[2] );
    if( n == 4 || n == 6 || n == 8 ){
      N = n;
    }
  }catch( e ){
  }
}

//. 初期状態
var r0 = initReversi( N );
r0.showBoard();

//. 先手が１手選択
var idx1 = -1;
var choice1 = null;
while( !choice1 ){
  idx1 ++;
  if( r0.next_status[idx1] == 0 ){
    choice1 = r0.next_choices[idx1];
    r0.changeStatus( idx1, -1 );
  }
}

//. 選択した手を打つ
var r1 = new reversi( null, r0.id, r0.depth + 1, idx1, choice1, r0.board, 1 );
r0.changeStatus( idx1, 1 );

r0.showBoard();
r1.showBoard();   
