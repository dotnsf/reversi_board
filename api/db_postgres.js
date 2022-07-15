//. db_postgres.js
var express = require( 'express' ),
    bodyParser = require( 'body-parser' ),
    fs = require( 'fs' ),
    { v4: uuidv4 } = require( 'uuid' ),

    api = express();

var Reversi = require( '../public/reversi' );

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

var settings_cors = 'CORS' in process.env ? process.env.CORS : '';
api.all( '/*', function( req, res, next ){
  if( settings_cors ){
    res.setHeader( 'Access-Control-Allow-Origin', settings_cors );
    res.setHeader( 'Vary', 'Origin' );
  }
  next();
});


api.use( bodyParser.urlencoded( { extended: true, limit: '10mb' } ) );
api.use( bodyParser.json( { limit: '10mb' }) );
api.use( express.Router() );

//. Create
//. 初期状態は全ての board_size であらかじめ格納済みにしておく必要あり
api.createReversi = async function( reversi ){
  return new Promise( async ( resolve, reject ) => {
    if( pg ){
      conn = await pg.connect();
      if( conn ){
        try{
          var sql = 'insert into reversi( id, parent_id, board_size, depth, choice_idx, choice_x, choice_y, board, next_choices, next_status, next_choices_num, next_processed_num, player0_count, player1_count, next_player, created, updated ) values ( $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17 )';
          if( !reversi.id ){
            reversi.id = uuidv4();
          }
          var t = ( new Date() ).getTime();
          reversi.created = t;
          reversi.updated = t;
          //console.log( reversi );
          var query = { text: sql, values: [ reversi.id, reversi.parent_id, reversi.board_size, reversi.depth, reversi.choice_idx, reversi.choice[0], reversi.choice[1], JSON.stringify( reversi.board ), JSON.stringify( reversi.next_choices ), JSON.stringify( reversi.next_status ), reversi.next_choices_num, reversi.next_processed_num, reversi.player0_count, reversi.player1_count, reversi.next_player, reversi.created, reversi.updated ] };
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

api.createReversis = function( reversis ){
  return new Promise( async ( resolve, reject ) => {
    if( pg ){
      conn = await pg.connect();
      if( conn ){
        try{
          var num = 0;
          var count = 0;

          var sql = 'insert into quizs( id, data, num, length, created, updated ) values ( $1, $2, $3, $4, $5, $6 )';
          for( var i = 0; i < quizs.length; i ++ ){
            var quiz = quizs[i];
            if( !quiz.id ){
              quiz.id = uuidv4();
            }
            var t = ( new Date() ).getTime();
            quiz.created = t;
            quiz.updated = t;
            //console.log( quiz );
            var query = { text: sql, values: [ quiz.id, quiz.data, quiz.num, quiz.length, quiz.created, quiz.updated ] };
            conn.query( query, function( err, result ){
              num ++;
              if( err ){
                console.log( err );
              }else{
                count ++;
              }

              if( num == quizs.length ){
                resolve( { status: true, count: count } );
              }
            });
          }
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

//. Read
api.readReversi = async function( reversi_id ){
  return new Promise( async ( resolve, reject ) => {
    if( pg ){
      conn = await pg.connect();
      if( conn ){
        try{
          var sql = "select * from reversi where id = $1";
          var query = { text: sql, values: [ reversi_id ] };
          conn.query( query, function( err, result ){
            if( err ){
              console.log( err );
              resolve( { status: false, error: err } );
            }else{
              if( result && result.rows && result.rows.length > 0 ){
                resolve( { status: true, result: result.rows[0] } );
              }else{
                resolve( { status: false, error: 'no data' } );
              }
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

//. Reads
api.readReversis = async function( limit, offset ){
  return new Promise( async ( resolve, reject ) => {
    if( pg ){
      conn = await pg.connect();
      if( conn ){
        try{
          var sql = "select * from reversi order by updated";
          if( limit ){
            sql += " limit " + limit;
          }
          if( offset ){
            sql += " start " + offset;
          }
          var query = { text: sql, values: [] };
          conn.query( query, function( err, result ){
            if( err ){
              console.log( err );
              resolve( { status: false, error: err } );
            }else{
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
};

api.startProcess = async function( board_size ){
  return new Promise( async ( resolve, reject ) => {
    if( pg ){
      if( board_size == 4 || board_size == 6 || board_size == 8 ){
        conn = await pg.connect();
        if( conn ){
          try{
            //. 指定サイズのデータが存在していないことを確認してから作成する
            var sql = "select * from reversi where board_size = " + board_size;
            var query = { text: sql, values: [] };
            conn.query( query, ( err, result ) => {
              if( err ){
                resolve( { status: false, error: err } );
              }else{
                if( result.rows.length == 0 ){
                  var reversi1 = initReversi( board_size );
                  //console.log( { reversi1 } );
                  this.createReversi( reversi1 ).then( async function( result ){
                    if( result && result.status ){
                      resolve( { status: true, result: reversi1 } );
                    }else{
                      resolve( { status: false, error: 'create reversi0 failed.' } );
                    }
                  });
                }else{
                  var reversi1 = result.rows[0];   //. board や next_choices, next_status などが文字列のまま
                  reversi1.board = JSON.parse( reversi1.board );
                  reversi1.next_choices = JSON.parse( reversi1.next_choices );
                  reversi1.next_status = JSON.parse( reversi1.next_status );
                  reversi1.next_choices_num = reversi1.next_choices.length;
                  resolve( { status: true, result: reversi1 } );
                }
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
          resolve( { status: false, error: 'db not ready.' } );
        }
      }else{
        resolve( { status: false, error: 'no proper board_size.' } );
      }
    }else{
      resolve( { status: false, error: 'no connection.' } );
    }
  });
};

api.nextProcess = async function( board_size ){
  //. startProcess はおそらく問題なし
  //. nextProcess を実行しても DB 内データに（next_status は "[0,0,0,0]" から "[-1,0,0,0]" に変化しているべきなのに）変化なし
  //. （DB 内データは next_choices = "[[2,0],[3,1],[0,2],[1,3]]", next_status="[-1,0,0,0]", next_choices_num=4 になっているべきなのに）UI 上では next_choices = [],  next_status = [-1], next_choices_num = 0 になっている
  return new Promise( async ( resolve, reject ) => {
    if( pg ){
      conn = await pg.connect();
      if( conn ){
        try{
          //. 特定の board_size 値を持っているレコードの中で、 ( next_choices_num > 0 && next_choices_num > next_processed_num ) を満たしているレコードが、、、
          //. 0 件の場合（新しい子レコードを「どこかのレコードの下に」作成する必要がある）、
          //.   ( next_choices_num > 0 && next_processed_num == 0 ) のレコードを depth, choice_idx の昇順に並べた最初のレコードで 0 番目の戦略を新規に子レコードとして作成する
          //. 1 件以上の場合（おそらく 1 件）、
          //.   その中から先頭の１件を取り出して、next_processed_num 番目の戦略を新規に子レコードとして作成する

          //. start_process 直後の初期 reversi が next_choices_num = null となってしまっていて、現在のアルゴリズムだと「解析終了」と判断されてしまう？？
          //. next_choices_num が初期値のまま作成されて計算されていない？
          var sql = "select * from reversi where board_size = $1 and next_choices_num > 0 and next_choices_num > next_processed_num order by depth, choice_idx";
          var query = { text: sql, values: [ board_size ] };
          conn.query( query, ( err, result ) => {
            if( err ){
              console.log( err );
              resolve( { status: false, error: err } );
            }else{
              if( result.rows.length == 0 ){
                sql = "select * from reversi where board_size = $1 and next_choices_num > 0 and next_processed_num = 0 order by depth, choice_idx";
                query = { text: sql, values: [ board_size ] };
                conn.query( query, ( err, result ) => {
                  if( err ){
                    console.log( err );
                    resolve( { status: false, error: err } );
                  }else{
                    if( result.rows.length == 0 ){
                      //. 解析終了？
                      resolve( { status: true, result: null } );
                    }else{
                      var r0 = result.rows[0];   
                      var reversi0 = new Reversi( r0.id, r0.parent_id, r0.depth, r0.choice_idx, [ -1, -1 ], JSON.parse( r0.board ), r0.next_player );
                      reversi0.changeStatus( 0, -1 );
                      this.updateReversi( reversi0.id, reversi0.next_status, reversi0.next_processed_num ).then( function( result ){
                        if( result && result.status ){
                          //. 0 番目の選択はクライアント側で処理してもらうので、この状態の reversi0 を返す
                          resolve( { status: true, result: reversi0 } );

                          //. 0 番目の戦略を選択する
                          //var reversi1 = new Reversi( null, r0.id, r0.depth + 1, 0, r0.next_choices[0], r0.board, r0.next_player * -1 );
                          //. save( reversi1 );
                          //reversi0.changeStatus( 0, 1 );
                          //. save( reversi0 );
                        }else{
                          resolve( { status: false, error: 'update reversi0 failed.' } );
                        }
                      });
                    }
                  }
                });
              }else{
                var r0 = result.rows[0];   
                var reversi0 = new Reversi( r0.id, r0.parent_id, r0.depth, r0.choice_idx, [ -1, -1 ]/*r0.next_choices[r0.next_processed_num]*/, JSON.parse( r0.board ), r0.next_player );
                reversi0.changeStatus( r0.next_processed_num, -1 );
                //this.updateReversi( reversi0.id, reversi0.next_status, reversi0.next_processed_num ).then( function( result ){
                api.updateReversi( reversi0.id, reversi0.next_status, reversi0.next_processed_num ).then( function( result ){
                  if( result && result.status ){
                    //. next_processed_num 番目の選択はクライアント側で処理してもらうので、この状態の reversi0 を返す
                    resolve( { status: true, result: reversi0 } );
                  }else{
                    resolve( { status: false, error: 'update reversi0 failed.' } );
                  }
                });
              }
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

api.updateProcess = async function( reversi1 ){
  return new Promise( async ( resolve, reject ) => {
    if( pg ){
      conn = await pg.connect();
      if( conn ){
        try{
          this.createReversi( reversi1 ).then( async ( result ) => {
            if( result && result.status ){
              //. 最後に親レコードのステータスを更新する
              var id = reversi1.parent_id;
              if( id ){
                var r0 = await this.readReversi( id );
                var reversi0 = new Reversi( r0.id, r0.parent_id, r0.depth, r0.choice_idx, [ -1, -1 ], r0.board, r0.next_player );
                reversi0.changeStatus( 0, 1 );
                this.updateReversi( reversi0.id, reversi0.next_status, reversi0.next_processed_num ).then( function( result ){
                  if( result && result.status ){
                    resolve( { status: true, result: reversi1 } );
                  }else{
                    resolve( { status: false, error: 'update reversi0 failed.' } );
                  }
                });
              }else{
                resolve( { status: false, error: 'no parent.' } );
              }
            }else{
              resolve( { status: false, error: 'create reversi1 failed.' } );
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

api.queryQuizs = async function( key, limit, offset ){
  return new Promise( async ( resolve, reject ) => {
    if( pg ){
      conn = await pg.connect();
      if( conn ){
        try{
          var sql = "select * from quizs where data like '%" + key + "%' order by updated";
          if( limit ){
            sql += " limit " + limit;
          }
          if( offset ){
            sql += " start " + offset;
          }
          var query = { text: sql, values: [] };
          conn.query( query, function( err, result ){
            if( err ){
              console.log( err );
              resolve( { status: false, error: err } );
            }else{
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
};

//. Update
api.updateReversi = async function( reversi_id, reversi_next_status, reversi_next_processed_num ){
  return new Promise( async ( resolve, reject ) => {
    if( pg ){
      conn = await pg.connect();
      if( conn ){
        if( !reversi_id ){
          resolve( { status: false, error: 'no id.' } );
        }else{
          try{
            var sql = 'update reversi set next_status = $1, next_processed_num = $2, updated = $3 where id = $4';
            var t = ( new Date() ).getTime();
            var query = { text: sql, values: [ JSON.stringify( reversi_next_status ), reversi_next_processed_num, t, reversi_id ] };
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
        }
      }else{
        resolve( { status: false, error: 'no connection.' } );
      }
    }else{
      resolve( { status: false, error: 'db not ready.' } );
    }
  });
};

//. Delete
api.deleteReversi = async function( reversi_id ){
  return new Promise( async ( resolve, reject ) => {
    if( pg ){
      conn = await pg.connect();
      if( conn ){
        try{
          var sql = "delete from reversi where id = $1";
          var query = { text: sql, values: [ reversi_id ] };
          conn.query( query, function( err, result ){
            if( err ){
              console.log( err );
              resolve( { status: false, error: err } );
            }else{
              resolve( { status: true/*, result: result*/ } );
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

api.deleteReversis = async function(){
  return new Promise( async ( resolve, reject ) => {
    if( pg ){
      conn = await pg.connect();
      if( conn ){
        try{
          var sql = "delete from reversi";
          var query = { text: sql, values: [] };
          conn.query( query, function( err, result ){
            if( err ){
              console.log( err );
              resolve( { status: false, error: err } );
            }else{
              resolve( { status: true/*, result: result*/ } );
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


api.post( '/reversi/start_process', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  var board_size = parseInt( req.body.board_size );
  api.startProcess( board_size ).then( function( result ){
    res.status( result.status ? 200 : 400 );
    res.write( JSON.stringify( result, null, 2 ) );
    res.end();
  });
});

api.post( '/reversi/next_process', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  var board_size = parseInt( req.body.board_size );
  api.nextProcess( board_size ).then( function( result ){
    res.status( result.status ? 200 : 400 );
    res.write( JSON.stringify( result, null, 2 ) );
    res.end();
  });
});

api.post( '/reversi/update_process', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  var reversi = req.body.reversi;
  api.updateProcess( reversi ).then( function( result ){
    res.status( result.status ? 200 : 400 );
    res.write( JSON.stringify( result, null, 2 ) );
    res.end();
  });
});


api.post( '/reversi', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  var reversi = req.body;
  api.createReversi( reversi ).then( function( result ){
    res.status( result.status ? 200 : 400 );
    res.write( JSON.stringify( result, null, 2 ) );
    res.end();
  });
});

api.post( '/reversis', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  var reversis = req.body;
  reversis.forEach( function( reversi ){
    if( !reversi.id ){
      reversi.id = uuidv4();
    }
  });

  api.createReversis( reversis ).then( function( result ){
    res.status( result.status ? 200 : 400 );
    res.write( JSON.stringify( result, null, 2 ) );
    res.end();
  });
});

api.get( '/reversi/:id', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  var reversi_id = req.params.id;
  api.readReversi( reversi_id ).then( function( result ){
    res.status( result.status ? 200 : 400 );
    res.write( JSON.stringify( result, null, 2 ) );
    res.end();
  });
});

api.get( '/reversis', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  var limit = req.query.limit ? parseInt( limit ) : 0;
  var offset = req.query.offset ? parseInt( offset ) : 0;
  api.readReversis( limit, offset ).then( function( results ){
    res.status( results.status ? 200 : 400 );
    res.write( JSON.stringify( results, null, 2 ) );
    res.end();
  });
});

api.get( '/reversis/:key', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  var key = req.params.key;
  api.queryReversis( key ).then( function( result ){
    res.status( result.status ? 200 : 400 );
    res.write( JSON.stringify( result, null, 2 ) );
    res.end();
  });
});


api.put( '/reversi/:id', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  var reversi_id = req.params.id;
  var reversi = req.body;
  api.updateReversi( reversi_id, reversi.next_status, reversi.next_processed_num ).then( function( result ){
    res.status( result.status ? 200 : 400 );
    res.write( JSON.stringify( result, null, 2 ) );
    res.end();
  });
});

api.delete( '/reversi/:id', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  var reversi_id = req.params.id;
  api.deleteReversi( reversi_id ).then( function( result ){
    res.status( result.status ? 200 : 400 );
    res.write( JSON.stringify( result, null, 2 ) );
    res.end();
  });
});

api.delete( '/reversis', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  api.deleteReversis().then( function( result ){
    res.status( result.status ? 200 : 400 );
    res.write( JSON.stringify( result, null, 2 ) );
    res.end();
  });
});


function getInitBoard( board_size ){
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

function initReversi( board_size ){
  var init_board = getInitBoard( board_size );
  var reversi0 = new Reversi( null, null, 0, -1, [ -1, -1 ], init_board, 1 );

  return reversi0;
};

//. api をエクスポート
module.exports = api;
