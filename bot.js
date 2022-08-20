//. bot.js
var request = require( 'request' );
const reversi = require('./public/reversi');
var Reversi = require( './public/reversi' );

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
        console.log({err0}); 
        resolve( { status: false, error: err0 } );
      }else{
        if( body0 && body0.status ){
          resolve( { status: true, result: body0.result } );
        }else{
          resolve( { status: false, error: body0.error } );
        }
      }
    });
  });
}

const aryMax = function( a, b ){ return Math.max( a, b ); }
const aryMin = function( a, b ){ return Math.min( a, b ); }

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
        if( body0 && body0.status && body0.client ){
          if( body0.client == 'bot' ){
            console.log( 'bot' );
            var r0 = body0.result;
            if( r0 && r0.process_status == -1 ){
              var reversis = [];
              for( var i = 0; i < r0.next_choices.length; i ++ ){
                var reversi0 = new Reversi( r0.id, r0.parent_id, r0.next_ids, BOARD_SIZE, r0.depth, r0.board, null, r0.next_player );
                var choice = r0.next_choices[i];
                var reversi1 = reversi0.putChoice( choice.x, choice.y, reversi0.next_player );
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
          }else if( body0.client == 'analytics' ){
            console.log( 'analytics' );
            var r = JSON.parse( JSON.stringify( body0 ) ); //. { status: true, error: 'no next_ids.', client: 'analytics' }
            if( r && r.status ){
              if( r.parent && r.children ){
                var parent = body0.parent;
                var children = body0.children;
                if( parent && children && children.length > 0 ){
                  var values = [];
                  for( var i = 0; i < children.length; i ++ ){
                    values.push( children[i].value );
                  }

                  //. #18 ここを逆にして再度解析する
                  if( parent.next_player == -1 ){
                    parent.value = values.reduce( aryMin );
                  }else{
                    parent.value = values.reduce( aryMax );
                  }
    
                  var url1 = BASE_URL + '/api/reversi/target';
                  var options1 = { 
                    url: url1, 
                    method: 'PUT',
                    headers: { accept: 'application/json' },
                    json: { id: parent.id, value: parent.value }
                  };
                  request( options1, function( err1, res1, body1 ){
                    if( err1 ){
                      resolve( { status: false, error: err1 } );
                    }else{
                      //resolve( { status: true, result: body1 } );
                      body1.reversi = parent;
                      body1.finished = ( parent.depth == 0 );
      
                      console.log( { body1 } );
                      resolve( body1 );
                    }
                  });
                }else{
                  resolve( { status: false, error: 'failed to get children.' } );
                }
              }else{
                //resolve( { status: false, error: 'failed to get parent and/or children.' } );
                resolve( { status: true, error: 'failed to get parent and/or children.' } );
              }
            }else{
              resolve( { status: false, error: 'failed to get analytics board.' } );
            }
          }else{
            resolve( { status: false, error: r0 } );
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
