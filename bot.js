//. bot.js
var request = require( 'request' );
var reversi = require( './public/reversi' );

var BOARD_SIZE = 4;
var _BOARD_SIZE = 'BOARD_SIZE' in process.env ? process.env.BOARD_SIZE : ''; 
try{
  if( _BOARD_SIZE ){
    BOARD_SIZE = parseInt( _BOARD_SIZE );
  }
}catch( e ){
}

var BASE_URL = 'http://localhost:8080';
var _BASE_URL = 'BASE_URL' in process.env ? process.env.BASE_URL : ''; 
try{
  if( _BASE_URL ){
    while( _BASE_URL.endsWith( '/' ) ){
      _BASE_URL = _BASE_URL.substring( 0, _BASE_URL.length );
    }
    if( _BASE_URL ){
      BASE_URL = _BASE_URL;
    }
  }
}catch( e ){
}

/*
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

function try_reconnect( ts ){
  setTimeout( function(){
    console.log( 'reconnecting...' );
    pg = new PG.Pool({
      connectionString: database_url,
      //ssl: { require: true, rejectUnauthorized: false },
      idleTimeoutMillis: ( 3 * 86400 * 1000 )
    });
    pg.on( 'error', function( err ){
      console.log( 'error on retry(' + ts + ')', err );
      if( err.code && err.code.startsWith( '5' ) ){
        ts = ( ts < 10000 ? ( ts + 1000 ) : ts );
        try_reconnect( ts );
      }
    });
  }, ts );
}
*/

async function startProcess(){
  return new Promise( async ( resolve, reject ) => {
    var url = BASE_URL + '/api/reversi/start_process';
    var options = { 
      url: url, 
      method: 'POST',
      headers: { accept: 'application/json' },
      json: { board_size: BOARD_SIZE }
    };
    request( options, function( err0, res0, body0 ){
      if( err0 ){
        resolve( { status: false, error: err0 } );
      }else{
        //console.log( { body0 } );
        if( body0 && body0.status ){
          resolve( { status: true, result: body0.result } );
        }else{
          resolve( { status: false, error: body0.error } );
        }
      }
    });
  });
}

async function nextProcess(){
  return new Promise( async ( resolve, reject ) => {
    var url0 = BASE_URL + '/api/reversi/next_process';
    var options0 = { 
      url: url0, 
      method: 'POST',
      headers: { accept: 'application/json' },
      json: { board_size: BOARD_SIZE }
    };
    request( options0, function( err0, res0, body0 ){
      if( err0 ){
        resolve( { status: false, error: err0 } );
      }else{
        if( body0 && body0.status ){
          var r0 = body0.result;
          if( r0 && r0.next_processed_num == -1 ){
            var reversis = [];
            for( var i = 0; i < r0.next_choices.length; i ++ ){
              var choice = r0.next_choices[i];
              var reversi1 = new reversi( null, r0.id, r0.depth + 1, i, choice, JSON.parse( JSON.stringify( r0.board ) ), r0.next_player );
              reversis.push( reversi1 );
            }

            var url1 = BASE_URL + '/api/reversi/update_process';
            var options1 = { 
              url: url1, 
              method: 'POST',
              headers: { accept: 'application/json' },
              json: reversis
            };
            request( options1, function( err1, res1, body1 ){
              if( err1 ){
                resolve( { status: false, error: err1 } );
              }else{
                resolve( { status: true, result: body1 } );
              }
            });
          }else{
            resolve( { status: false, error: 'no target found.' } );
          }
        }else{
          resolve( { status: false, error: body0.error } );
        }
      }
    });
  });
}


startProcess().then( async function( result ){
  //console.log( result );
  var b = true;
  while( b ){
    var r = await nextProcess();
    if( r ){
      b = r.status;
      if( b ){
        console.log( r.result );
        b = ( r.result );
      }else{
        console.log( { r } );
      }
    }
  }
  process.exit( 0 );
});
