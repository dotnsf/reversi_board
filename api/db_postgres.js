//. db_postgres.js
var express = require( 'express' ),
    bodyParser = require( 'body-parser' ),
    format = require( 'pg-format' ),
    fs = require( 'fs' ),
    { v4: uuidv4 } = require( 'uuid' ),

    api = express();

var Reversi = require( '../public/reversi' );

process.env.PGSSLMODE = 'no-verify';
var PG = require( 'pg' );
const reversi = require('../public/reversi');
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
          var sql = 'insert into reversi( id, parent_id, board_size, depth, choice_idx, choice_x, choice_y, board, next_choices, next_choices_num, next_processed_num, player0_count, player1_count, next_player, value0, value1, value_status, created, updated ) values ( $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19 )';
          if( !reversi.id ){
            reversi.id = generateUUID(); //uuidv4();
          }
          var t = ( new Date() ).getTime();
          reversi.created = t;
          reversi.updated = t;
          if( reversi.next_choices_num == 0 ){
            reversi.value0 = reversi.player0_count - reversi.player1_count;
            reversi.value1 = reversi.player0_count - reversi.player1_count;
            reversi.value_status = 1;
          }else{
            reversi.value0 = null;
            reversi.value1 = null;
            reversi.value_status = 0;
          }
          //console.log( reversi );
          var query = { text: sql, values: [ reversi.id, reversi.parent_id, reversi.board_size, reversi.depth, reversi.choice_idx, reversi.choice[0], reversi.choice[1], JSON.stringify( reversi.board ), JSON.stringify( reversi.next_choices ), reversi.next_choices_num, reversi.next_processed_num, reversi.player0_count, reversi.player1_count, reversi.next_player, reversi.value0, reversi.value1, reversi.value_status, reversi.created, reversi.updated ] };
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
          var params = [];
          for( var i = 0; i < reversis.length; i ++ ){
            if( !reversis[i].id ){
              reversis[i].id = generateUUID(); //uuidv4();
            }
            var t = ( new Date() ).getTime();
            reversis[i].created = t;
            reversis[i].updated = t;
            if( reversis[i].next_choices_num == 0 ){
              reversis[i].value0 = reversis[i].player0_count - reversis[i].player1_count;
              reversis[i].value1 = reversis[i].player0_count - reversis[i].player1_count;
              reversis[i].value_status = 1;
            }else{
              reversis[i].value0 = null;
              reversis[i].value1 = null;
              reversis[i].value_status = 0;
            }

            params.push( [ reversis[i].id, reversis[i].parent_id, reversis[i].board_size, reversis[i].depth, reversis[i].choice_idx, reversis[i].choice[0], reversis[i].choice[1], JSON.stringify( reversis[i].board ), JSON.stringify( reversis[i].next_choices ), reversis[i].next_choices_num, reversis[i].next_processed_num, reversis[i].player0_count, reversis[i].player1_count, reversis[i].next_player, reversis[i].value0, reversis[i].value1, reversis[i].value_status, reversis[i].created, reversis[i].updated ] );
          }

          var sql = format( 'insert into reversi( id, parent_id, board_size, depth, choice_idx, choice_x, choice_y, board, next_choices, next_choices_num, next_processed_num, player0_count, player1_count, next_player, value0, value1, value_status, created, updated ) values %L', params );
          conn.query( sql, [], function( err, result ){
            if( err ){
              //. "error: duplicate key value violates unique constraint "reversi_pkey""" ??
              //. ↑これが発生しても１分後に再処理するので気にしなくていい？
              console.log( 'bulk insert', err );
              resolve( { status: true, results: null } );
            }else{
              resolve( { status: true, results: result } );
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
                var reversi = result.rows[0];
                if( typeof reversi.board == 'string' ){
                  reversi.board = JSON.parse( reversi.board );
                }
                if( typeof reversi.next_choices == 'string' ){
                  reversi.next_choices = JSON.parse( reversi.next_choices );
                }
                reversi.next_choices_num = reversi.next_choices.length;
                resolve( { status: true, result: reversi } );
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
              for( var i = 0; i < result.rows.length; i ++ ){
                result.rows[i].created = parseInt( result.rows[i].created );
                result.rows[i].updated = parseInt( result.rows[i].updated );
              }
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
            var sql = "select * from reversi where board_size = " + board_size + " order by depth";
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
                      resolve( { status: true, created: true } );
                    }else{
                      resolve( { status: false, error: 'create reversi0 failed.' } );
                    }
                  });
                }else{
                  resolve( { status: true, created: false } );
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
  return new Promise( async ( resolve, reject ) => {
    if( pg ){
      conn = await pg.connect();
      if( conn ){
        try{
          //. #14
          var sql = "select * from reversi where board_size = $1 and next_processed_num < 1 limit 1";
          var query = { text: sql, values: [ board_size ] };
          conn.query( query, ( err, result ) => {
            if( err ){
              console.log( err );
              resolve( { status: false, error: err } );
            }else{
              if( result.rows.length == 0 ){
                //. analytics.js
                resolve( { status: false, error: 'no data prepared yet.' } );
              }else{
                //. bot.js
                //. 特定の board_size 値を持っているレコードの中で、 ( next_processed_num = 0 || ( next_processed_num = -1 && updated + 60000 < t ) を満たしているレコードを探す
                //. order by depth, updated で最初の１件が欲しい
                var t = ( new Date() ).getTime();
                var sql = "select * from reversi where board_size = $1 and next_choices_num > 0 and ( next_processed_num = 0 or ( next_processed_num = -1 and updated + 60000 < $2 ) ) order by depth, updated limit 1";
                var query = { text: sql, values: [ board_size, t ] };
                conn.query( query, ( err, result ) => {
                  if( err ){
                    console.log( err );
                    resolve( { status: false, error: err } );
                  }else{
                    if( result.rows.length == 0 ){
                      //. 最初の１件ができていない？　または処理終了？
                      sql = "select * from reversi where board_size = $1 limit 1";
                      query = { text: sql, values: [ board_size ] };
                      conn.query( query, async ( err, result ) => {
                        if( err ){
                          console.log( err );
                          resolve( { status: false, error: err } );
                        }else{
                          if( result.rows.length == 0 ){
                            //. 最初の１件ができていない
                            var r = await this.startProcess( board_size );
                            resolve( r );
                          }else{
                            //. 解析終了、だと思うが、next_processed_num = -1 のままのケースが考えられる。１分後に再処理すべき？
                            sql = "select * from reversi where board_size = $1 and next_choices_num > 0 and next_processed_num = -1 order by depth, updated limit 1";
                            query = { text: sql, values: [ board_size ] };
                            conn.query( query, async ( err, result ) => {
                              if( err ){
                                console.log( err );
                                resolve( { status: false, error: err } );
                              }else{
                                if( result.rows.length == 0 ){
                                  //. 解析終了
                                  resolve( { status: true, result: null } );
                                }else{
                                  //. 見つかった
                                  var r0 = result.rows[0];   
                                  var reversi0 = new Reversi( r0.id, r0.parent_id, r0.depth, r0.choice_idx, [ -1, -1 ], JSON.parse( r0.board ), r0.next_player );
                                  reversi0.next_processed_num = r0.next_processed_num;
                                  reversi0.changeStatus( -1 );

                                  //. 見つかった状態の reversi0 を返す
                                  resolve( { status: true, result: reversi0 } );
                                }
                              }
                            });
                          }
                        }
                      });
                    }else{
                      var r0 = result.rows[0];   
                      var reversi0 = new Reversi( r0.id, r0.parent_id, r0.depth, r0.choice_idx, [ -1, -1 ], JSON.parse( r0.board ), r0.next_player );
                      reversi0.next_processed_num = r0.next_processed_num;
                      reversi0.changeStatus( -1 );
                      this.updateReversi( reversi0.id, reversi0.next_processed_num ).then( function( result ){
                        if( result && result.status ){
                          //. この状態の reversi0 を返す
                          resolve( { status: true, result: reversi0 } );
                        }else{
                          resolve( { status: false, error: 'update reversi0 failed.' } );
                        }
                      });
                    }
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

api.updateProcess = async function( reversis ){
  return new Promise( async ( resolve, reject ) => {
    if( pg ){
      conn = await pg.connect();
      if( conn ){
        try{
          this.createReversis( reversis ).then( async ( result ) => {
            if( result && result.status ){
              if( result.results ){
                //. 最後に親レコードのステータスを更新する
                var id = reversis[0].parent_id;
                if( id ){
                  var r = await this.readReversi( id );
                  if( r && r.status ){
                    var r0 = r.result;
                    if( typeof r0.board == 'string' ){
                      r0.board = JSON.parse( r0.board );
                    }
                    var reversi0 = new Reversi( r0.id, r0.parent_id, r0.depth, r0.choice_idx, [ -1, -1 ], JSON.parse( JSON.stringify( r0.board ) ), r0.next_player );
                    reversi0.next_processed_num = r0.next_processed_num;
                    reversi0.changeStatus( 1 );
                    this.updateReversi( reversi0.id, reversi0.next_processed_num ).then( function( result ){
                      if( result && result.status ){
                        resolve( { status: true, result: reversi0 } );
                      }else{
                        resolve( { status: false, error: 'update reversi0 failed.' } );
                      }
                    });
                  }else{
                    resolve( { status: false, error: r.error } );
                  }
                }else{
                  resolve( { status: false, error: 'no parent.' } );
                }
              }else{
                //. バルクインサートに失敗しているので、無視して（親レコードは処理中のまま）続行できるようにする
                resolve( { status: true, result: null } );
              }
            }else{
              resolve( { status: false, error: 'create reversis failed.' } );
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
api.updateReversi = async function( reversi_id, reversi_next_processed_num ){
  return new Promise( async ( resolve, reject ) => {
    if( pg ){
      conn = await pg.connect();
      if( conn ){
        if( !reversi_id ){
          resolve( { status: false, error: 'no id.' } );
        }else{
          try{
            var sql = 'update reversi set next_processed_num = $1, updated = $2 where id = $3';
            var t = ( new Date() ).getTime();
            var query = { text: sql, values: [ reversi_next_processed_num, t, reversi_id ] };
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

api.deleteReversis = async function( board_size ){
  return new Promise( async ( resolve, reject ) => {
    if( pg ){
      conn = await pg.connect();
      if( conn ){
        try{
          var sql = "delete from reversi";
          if( board_size ){
            sql += " where board_size = " + board_size;
          }
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

api.readRoot = async function( board_size ){
  return new Promise( async ( resolve, reject ) => {
    if( pg ){
      if( board_size == 4 || board_size == 6 || board_size == 8 ){
        conn = await pg.connect();
        if( conn ){
          try{
            //. 指定サイズのデータが存在していないことを確認してから作成する
            var sql = "select * from reversi where board_size = " + board_size + " and depth = 0";
            var query = { text: sql, values: [] };
            conn.query( query, ( err, result ) => {
              if( err ){
                console.log( err );
                resolve( { status: false, error: err } );
              }else{
                if( err ){
                  console.log( err );
                  resolve( { status: false, error: err } );
                }else{
                  if( result.rows.length == 0 ){
                    resolve( { status: false, error: 'no root info found for board_size = ' + board_size + '.' } );
                  }else{
                    var reversi0 = result.rows[0];   //. board や next_choices などが文字列のまま
                    if( typeof reversi0.board == 'string' ){
                      reversi0.board = JSON.parse( reversi0.board );
                    }
                    if( typeof reversi0.next_choices == 'string' ){
                      reversi0.next_choices = JSON.parse( reversi0.next_choices );
                    }
                    reversi0.next_choices_num = reversi0.next_choices.length;
                    resolve( { status: true, result: reversi0 } );
                  }
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

api.readInfo = async function( parent_id, choice_idx ){
  return new Promise( async ( resolve, reject ) => {
    if( pg ){
      if( parent_id != null && choice_idx > -1 ){
        conn = await pg.connect();
        if( conn ){
          try{
            //. 指定サイズのデータが存在していないことを確認してから作成する
            var sql = "select * from reversi where parent_id = $1 and choice_idx = $2";
            var query = { text: sql, values: [ parent_id, choice_idx ] };
            conn.query( query, ( err, result ) => {
              if( err ){
                resolve( { status: false, error: err } );
              }else{
                if( err ){
                  console.log( err );
                  resolve( { status: false, error: err } );
                }else{
                  if( result.rows.length == 0 ){
                    resolve( { status: false, error: 'no info found for parent_id = ' + parent_id + ' and choice_idx = ' + choice_idx + '.' } );
                  }else{
                    var reversi0 = result.rows[0];   //. board や next_choices などが文字列のまま
                    if( typeof reversi0.board == 'string' ){
                      reversi0.board = JSON.parse( reversi0.board );
                    }
                    if( typeof reversi0.next_choices == 'string' ){
                      reversi0.next_choices = JSON.parse( reversi0.next_choices );
                    }
                    reversi0.next_choices_num = reversi0.next_choices.length;
                    resolve( { status: true, result: reversi0 } );
                  }
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
        resolve( { status: false, error: 'no proper parent_id and/or choice_idx.' } );
      }
    }else{
      resolve( { status: false, error: 'no connection.' } );
    }
  });
};

//. #12
api.readInfoById = async function( id ){
  return new Promise( async ( resolve, reject ) => {
    if( pg ){
      if( id != null ){
        conn = await pg.connect();
        if( conn ){
          try{
            //. 指定サイズのデータが存在していないことを確認してから作成する
            var sql = "select * from reversi where id = $1";
            var query = { text: sql, values: [ id ] };
            conn.query( query, ( err, result ) => {
              if( err ){
                resolve( { status: false, error: err } );
              }else{
                if( err ){
                  console.log( err );
                  resolve( { status: false, error: err } );
                }else{
                  if( result.rows.length == 0 ){
                    resolve( { status: false, error: 'no info found for id = ' + id + '.' } );
                  }else{
                    var reversi0 = result.rows[0];   //. board や next_choices などが文字列のまま
                    if( typeof reversi0.board == 'string' ){
                      reversi0.board = JSON.parse( reversi0.board );
                    }
                    if( typeof reversi0.next_choices == 'string' ){
                      reversi0.next_choices = JSON.parse( reversi0.next_choices );
                    }
                    reversi0.next_choices_num = reversi0.next_choices.length;
                    resolve( { status: true, result: reversi0 } );
                  }
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
        resolve( { status: false, error: 'no proper id.' } );
      }
    }else{
      resolve( { status: false, error: 'no connection.' } );
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

  var reversis = req.body;
  for( var i = 0; i < reversis.length; i ++ ){
    reversis[i].board_size = parseInt( reversis[i].board_size );
    reversis[i].depth = parseInt( reversis[i].depth );
    reversis[i].choice_idx = parseInt( reversis[i].choice_idx );
    reversis[i].choice[0] = parseInt( reversis[i].choice[0] );
    reversis[i].choice[1] = parseInt( reversis[i].choice[1] );
    reversis[i].board = JSON.parse( JSON.stringify( reversis[i].board ).split( '"' ).join( '' ) );
    reversis[i].next_choices = JSON.parse( JSON.stringify( reversis[i].next_choices ).split( '"' ).join( '' ) );
    reversis[i].next_choices_num = parseInt( reversis[i].next_choices_num );
    reversis[i].next_processed_num = parseInt( reversis[i].next_processed_num );
    reversis[i].player0_count = parseInt( reversis[i].player0_count );
    reversis[i].player1_count = parseInt( reversis[i].player1_count );
    reversis[i].next_player = parseInt( reversis[i].next_player );
  };

  api.updateProcess( reversis ).then( function( result ){
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
      reversi.id = generateUUID(); //uuidv4();
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
  api.updateReversi( reversi_id, reversi.next_processed_num ).then( function( result ){
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

  var board_size = 0;
  if( req.body.board_size ){
    var _board_size = req.body.board_size;
    try{
      board_size = parseInt( _board_size );
    }catch( e ){
    }
  }
  api.deleteReversis( board_size ).then( function( result ){
    res.status( result.status ? 200 : 400 );
    res.write( JSON.stringify( result, null, 2 ) );
    res.end();
  });
});

api.get( '/rootinfo', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  var bsize = req.query.board_size ? parseInt( req.query.board_size ) : board_size;
  api.readRoot( bsize ).then( function( result ){
    res.status( result.status ? 200 : 400 );
    res.write( JSON.stringify( result, null, 2 ) );
    res.end();
  });
});

api.get( '/infobyparentandchoice', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  var parent_id = req.query.parent_id ? req.query.parent_id : '';
  var choice_idx = req.query.choice_idx ? parseInt( req.query.choice_idx ) : -1;
  if( parent_id && choice_idx > -1 ){
    api.readInfo( parent_id, choice_idx ).then( function( result ){
      res.status( result.status ? 200 : 400 );
      res.write( JSON.stringify( result, null, 2 ) );
      res.end();
    });
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, error: 'parameter both parent_id and choice_idx are mandatory.' }, null, 2 ) );
    res.end();
  }
});

//. #12
api.get( '/infobyid', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  var id = req.query.id ? req.query.id : '';
  if( id ){
    api.readInfoById( id ).then( function( result ){
      res.status( result.status ? 200 : 400 );
      res.write( JSON.stringify( result, null, 2 ) );
      res.end();
    });
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, error: 'parameter both id is mandatory.' }, null, 2 ) );
    res.end();
  }
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

function generateUUID(){
  did = ( new Date().getTime().toString(16) ) + Math.floor( 10000000 * Math.random() ).toString(16);

  return did;
}

//. api をエクスポート
module.exports = api;
