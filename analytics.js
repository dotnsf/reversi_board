//. analytics.js

process.env.PGSSLMODE = 'no-verify';
var PG = require( 'pg' );
PG.defaults.ssl = true;
var database_url = 'DATABASE_URL' in process.env ? process.env.DATABASE_URL : ''; 
var pg = null;
if( database_url ){
  console.log( 'database_url = ' + database_url );
  pg = new PG.Pool({
    connectionString: database_url,
    //ssl: { require: true, rejectUnauthorized: false },
    idleTimeoutMillis: ( 3 * 86400 * 1000 )
  });
  pg.on( 'error', function( err ){
    console.log( 'error on working', err );
    if( err.code && err.code.startsWith( '5' ) ){
      try_reconnect( 1000 );
    }
  });
}

var BOARD_SIZE = 4;
var _BOARD_SIZE = 'BOARD_SIZE' in process.env ? process.env.BOARD_SIZE : ''; 
try{
  if( _BOARD_SIZE ){
    BOARD_SIZE = parseInt( _BOARD_SIZE );
  }
}catch( e ){
}

async function getAllRecords( board_size ){
  return new Promise( async ( resolve, reject ) => {
    if( pg ){
      conn = await pg.connect();
      if( conn ){
        try{
          var sql = "select id, parent_id, depth, choice_idx, player0_count, player1_count, next_player from reversi where board_size = $1 order by depth desc, parent_id, choice_idx";
          var query = { text: sql, values: [ board_size ] };
          conn.query( query, function( err, result ){
            if( err ){
              console.log( err );
              resolve( { status: false, error: err } );
            }else{
              /*
              console.log( result.rows[0] );  //. depth, choice_idx, player0_count が整数になっていることを確認する
              console.log( result.rows[result.rows.length-1] );  //. parent_id が null になっていることを確認する
              console.log( result.rows[result.rows.length-2] );  //. parent_id が↑の id になっていることを確認する
              console.log( '#' + result.rows.length + ', max(depth)=' + result.rows[0].depth );
              */

              resolve( { status: true, results: result.rows } );
            }
          });
        }catch( e ){
          console.log( e );
          resolve( { status: false, error: err } );
        }finally{
          if( conn ){
            conn.release();
          }
        }
      }else{
        resolve( { status: false, error: 'no connection.' } );
      }
    }else{
      resolve( { status: false, error: 'db not ready.' } );
    }
  });
}

async function updateValue( id, value ){
  return new Promise( async ( resolve, reject ) => {
    if( pg ){
      conn = await pg.connect();
      if( conn ){
        try{
          var sql = 'update reversi set value = $1, updated = $2 where id = $3';
          var t = ( new Date() ).getTime();
          var query = { text: sql, values: [ value, t, id ] };
          conn.query( query, function( err, result ){
            if( err ){
              console.log( err );
              resolve( { status: false, error: err } );
            }else{
              resolve( { status: true, result: result } );
            }
          });
        }catch( e ){
          console.log( e );
          resolve( { status: false, error: err } );
        }finally{
          if( conn ){
            conn.release();
          }
        }
      }else{
        resolve( { status: false, error: 'no connection.' } );
      }
    }else{
      resolve( { status: false, error: 'db not ready.' } );
    }
  });
};

const aryMax = function( a, b ){ return Math.max( a, b ); }
const aryMin = function( a, b ){ return Math.min( a, b ); }

getAllRecords( BOARD_SIZE ).then( async function( results ){
  if( results && results.length > 0 ){
    var player0_value = null;
    var max_depth = results[0].depth;
    if( max_depth % 2 == 0 ){
      var b = true;
      while( b ){
        var bb = -1;
        var player0_counts = {};
        var next_players = {};
        for( var i = 0; i < results.length && bb < 1; i ++ ){
          if( results[i].depth == max_depth ){
            bb = 0;
          }else if( results[i].depth < max_depth ){
            bb = 1;
          }

          //. 対象の depth データか？
          if( bb == 0 ){
            //. parent_id ごとに ( player0_count - player1_count ) の値を配列にまとめておく
            if( !player0_counts[results[i].parent_id] ){
              player0_counts[results[i].parent_id] = [];
            }
            player0_counts[results[i].parent_id].push( results[i].player0_count - results[i].player1_count );
            next_players[results[i].parent_id] = results[i].next_player;
          }
        }

        var player0_values = {};
        Object.keys( player0_counts ).forEach( function( parent_id ){
          if( next_players[parent_id] == -1 ){
            player0_values[parent_id] =  player0_counts[parent_id].reduce( aryMin );
          }else{
            player0_values[parent_id] =  player0_counts[parent_id].reduce( aryMax );
          }
        });

        Object.keys( player0_values ).forEach( function( id ){
          var bbb = true;
          for( var i = 0; i < results.length && bbb; i ++ ){
            if( results[i].id === id ){  //. null と null を比較する可能性がある
              results[i].player0_count = player0_values[id];
              if( results[i].depth == 0 ){
                player0_value = results[i].player0_count;
              }
              bbb = false;
            }
          }
        });

        console.log( 'Finished for depth = ' + max_depth );
        max_depth --;
        if( max_depth < 0 ){
          b = false;
        }
      }
    }

    console.log( '-> player0_value = ' + player0_value );
    if( BOARD_SIZE * BOARD_SIZE / 2 > player0_value ){
      console.log( 'player1(後手) would win for this game.' );
    }else if( BOARD_SIZE * BOARD_SIZE / 2 < player0_value ){
      console.log( 'player0(先手) would win for this game.' );
    }else{
      console.log( 'no winning patterns for both player0 nor player1.' );
    }
  }else{
    console.log( 'no enough records can be retrieved.' );
  }
  process.exit( 0 );
});
