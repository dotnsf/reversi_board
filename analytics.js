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

async function getAllRecords( board_size, depth ){
  return new Promise( async ( resolve, reject ) => {
    if( pg ){
      conn = await pg.connect();
      if( conn ){
        try{
          var sql = "select id, parent_id, depth, choice_idx, player0_count, player1_count, value0, value1, value_status, next_player from reversi where board_size = $1";
          var values = [ board_size ];
          if( depth > -1 ){
            sql += " and depth = $2";
            values.push( depth );
          }
          sql += " order by depth desc, parent_id, choice_idx";
          var query = { text: sql, values: values };
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

async function getTargetRecords( board_size ){
  return new Promise( async ( resolve, reject ) => {
    if( pg ){
      conn = await pg.connect();
      if( conn ){
        try{
          var t = ( new Date() ).getTime();
          var sql = "select id, parent_id, depth, choice_idx, player0_count, player1_count, value0, value1, value_status, next_player from reversi where board_size = $1 and depth = ( select max(depth) from reversi where ( value_status = 0 or ( value_status = -1 and updated + 60000 < $2 ) ) ) and ( value_status = 0 or ( value_status = -1 and updated + 60000 < $3 ) ) order by parent_id, choice_idx limit 1";
          var query = { text: sql, values: [ board_size, t, t ] };
          conn.query( query, function( err, result0 ){
            if( err ){
              console.log( err );
              resolve( { status: false, error: err } );
            }else{
              sql = "update reversi set value_status = -1, updated = $1 where id = $2";
              var t = ( new Date() ).getTime();
              query = { text: sql, values: [ t, result0.rows[0].id ] };

              conn.query( query, function( err, result ){
                if( err ){
                  console.log( err );
                  resolve( { status: false, error: err } );
                }else{
                  sql = "select id, parent_id, depth, choice_idx, player0_count, player1_count, value0, value1, value_status, next_player from reversi where parent_id = $1 order by choice_idx";
                  query = { text: sql, values: [ result0.rows[0].id ] };
                  conn.query( query, function( err1, result1 ){
                    if( err1 ){
                      console.log( err1 );

                      sql = "update reversi set value_status = 1, updated = $1 where id = $2";
                      t = ( new Date() ).getTime();
                      query = { text: sql, values: [ t, result0.rows[0].id ] };
                      conn.query( query, function( err2, result2 ){
                        if( err2 ){
                          console.log( err2 );
                          resolve( { status: false, error: err2 } );
                        }else{
                          resolve( { status: false, error: err1 } );
                        }
                      });
                    }else{
                      resolve( { status: true, parent: result0.rows[0], children: result1.rows } );
                    }
                  });
                }
              });
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

async function updateValue( id, value0, value1 ){
  return new Promise( async ( resolve, reject ) => {
    if( pg ){
      conn = await pg.connect();
      if( conn ){
        try{
          var sql = 'update reversi set value0 = $1, value1 = $2, value_status = 1, updated = $3 where id = $4';
          var t = ( new Date() ).getTime();
          var query = { text: sql, values: [ value0, value1, t, id ] };
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
}

const aryMax = function( a, b ){ return Math.max( a, b ); }
const aryMin = function( a, b ){ return Math.min( a, b ); }

async function processOneRecord( board_size ){
  return new Promise( async ( resolve, reject ) => {
    var r = await getTargetRecords( board_size );
    if( r && r.status ){
      var parent = r.parent;
      var children = r.children;
      var values0 = [];
      var values1 = [];
      for( var i = 0; i < children.length; i ++ ){
        values0.push( children[i].value0 );
        values1.push( children[i].value1 );
      }

      //. #18 ここを逆にして再度解析する
      if( parent.next_player == -1 ){
        parent.value0 = values1.reduce( aryMin );
        parent.value1 = values0.reduce( aryMax );
      }else{
        parent.value0 = values1.reduce( aryMax );
        parent.value1 = values0.reduce( aryMin );
      }

      r = await updateValue( parent.id, parent.value0, parent.value1 );
      r.reversi = parent;
      r.finished = ( parent.depth == 0 );
      
      console.log( { r } );
      resolve( r );
    }else{
      resolve( { status: false, error: r.error } );
    }
  });
}

setTimeout( async function(){
  var r = await processOneRecord( BOARD_SIZE );
  while( r.status && !r.fisnished ){
    r = await processOneRecord( BOARD_SIZE );
  }

  if( r.status ){
    console.log( JSON.stringify( r.reversi, null, 2 ) );
    if( r.reversi.value0 > 0 ){
      console.log( 'player0(先手) would win for this game.' );
    }else if( r.reversi.value1 < 0 ){
      console.log( 'player1(後手) would win for this game.' );
    }else{
      console.log( 'no winning patterns for both player0 nor player1.' );
    }
  }else{
    console.log( 'no enough records can be retrieved.' );
  }
  process.exit( 0 );
}, 1000 );

