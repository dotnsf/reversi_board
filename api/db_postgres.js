//. db_postgres.js
var express = require( 'express' ),
    bodyParser = require( 'body-parser' ),
    format = require( 'pg-format' ),
    fs = require( 'fs' ),
    { v4: uuidv4 } = require( 'uuid' ),

    api = express();

var Reversi = require( '../public/reversi' );

if( !process.env.PGSSLMODE ){
  process.env.PGSSLMODE = 'no-verify';
}
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
//. この返り値の id が問題になっている(2022/08/21)
api.createReversi = async function( reversi ){
  return new Promise( async ( resolve, reject ) => {
    if( pg ){
      var conn = await pg.connect();
      if( conn ){
        try{
          var sql = 'insert into reversi( id, parent_id, next_ids, board_size, depth, board, next_choices, next_choices_num, process_status, player0_count, player1_count, next_player, value, value_status, created, updated ) values ( $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16 )';
          var t = ( new Date() ).getTime();
          reversi.created = t;
          reversi.updated = t;
          if( reversi.next_choices_num == 0 ){
            reversi.value = reversi.player0_count - reversi.player1_count;
            reversi.value_status = 1;
          }else{
            reversi.value = 0;
            reversi.value_status = 0;
          }
          //console.log( reversi );
          if( typeof reversi.next_ids == 'object' ){ reversi.next_ids = JSON.stringify( reversi.next_ids ); }
          if( typeof reversi.board == 'object' ){ reversi.board = JSON.stringify( reversi.board ); }
          if( typeof reversi.next_choices == 'object' ){ reversi.next_choices = JSON.stringify( reversi.next_choices ); }

          //. INSERT したレコードの ID が欲しい
          var id = uuidv4();
          reversi.id = id;
          var query = { text: sql, values: [ reversi.id, reversi.parent_id, reversi.next_ids, reversi.board_size, reversi.depth, reversi.board, reversi.next_choices, reversi.next_choices_num, reversi.process_status, reversi.player0_count, reversi.player1_count, reversi.next_player, reversi.value, reversi.value_status, reversi.created, reversi.updated ] };
          conn.query( query, function( err, result ){
            if( err ){
              console.log( 'createReversi: err', err );
              resolve( { status: false, error: err } );
            }else{
              //console.log( 'createReversi:' + JSON.stringify( result ) );
              resolve( { status: true, id: reversi.id, result: result } );
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
      var conn = await pg.connect();
      if( conn ){
        try{
          //. 各 reversis[i] に分けて、それぞれが過去に記録されていないことを確認してから挿入する、という処理が必要
          //. 仮に１つも挿入されることがなくても、既存データとのコンフリクトが原因だった場合は { status: true } を返すようにする
          var next_ids = [];
          for( var i = 0; i < reversis.length; i ++ ){
            var reversi = new Reversi( reversis[i].id, reversis[i].parent_id, reversis[i].next_ids, reversis[i].board_size, reversis[i].depth, reversis[i].board, reversis[i].boards, reversis[i].next_player );
            var result = await this.insertReversiIfNotExisted( reversi );
            if( result && result.status ){
              next_ids.push( result.id );  //. 作成してもしなくても id を next_ids に入れる
            }else{
              next_ids.push( null ); //. これが next_ids に null が含まれる原因？
            }
          }
          resolve( { status: true, next_ids: next_ids } );
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

api.insertReversiIfNotExisted = async function( reversi ){
  //. 同一の board を持つ既存レコードを探す
  //. 既存レコードがなければ新規に作成し、その作成したレコードの id を返す
  //. ここで返す id として存在していないレコードがある？？
  return new Promise( async ( resolve, reject ) => {
    if( pg ){
      var where = [];
      for( var j = 0; j < reversi.boards.length; j ++ ){
        where.push( " board = '" + JSON.stringify( reversi.boards[j] ) + "' " );
      }

      if( where.length > 0 ){
        var conn = await pg.connect();
        if( conn ){
          try{
            var sql = 'select id from reversi where ( ' + where.join( 'or' ) + ') and next_player = ' + reversi.next_player;
            conn.query( sql, [], async function( err, result ){
              if( err ){
                console.log( { err } );
                resolve( { status: false, error: err } );
              }else{
                if( result && result.rows && result.rows.length > 0 ){
                  //. 既存レコードが存在していたら作成せずにそのレコードの id を返す
                  var id = result.rows[0].id;
                  resolve( { status: true, id: id, new: false } );
                }else{
                  //. 既存レコードが存在していない時は作成して、そのレコードの id を返す
                  var r = await api.createReversi( reversi );
                  //console.log( 'insertReversiIf..', r );
                  if( r && r.status && r.result ){
                    resolve( { status: true, id: r.id, new: true } );
                  }else{
                    //. 既存レコードがないのに作成できなかった場合？？
                    console.log( { r } );
                    resolve( { status: false, error: r.error } );
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
          resolve( { status: false, error: 'no connection.' } );
        }
      }else{
        resolve( { status: false, error: 'no boards information' } );
      }
    }else{
      resolve( { status: false, error: 'db not ready.' } );
    }
  });
}

//. Read
api.readReversi = async function( reversi_id ){
  return new Promise( async ( resolve, reject ) => {
    if( pg ){
      var conn = await pg.connect();
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
      var conn = await pg.connect();
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
                if( typeof result.rows[i].board == 'string' ){
                  result.rows[i].board = JSON.parse( result.rows[i].board );
                }
                if( typeof result.rows[i].next_choices == 'string' ){
                  result.rows[i].next_choices = JSON.parse( result.rows[i].next_choices );
                }
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
        var conn = await pg.connect();
        if( conn ){
          try{
            //. 指定サイズのデータが存在していないことを確認してから作成する
            var sql = "select * from reversi where board_size = " + board_size + " order by depth limit 1";
            var query = { text: sql, values: [] };
            conn.query( query, ( err, result ) => {
              if( err ){
                resolve( { status: false, error: err } );
              }else{
                if( result.rows.length == 0 ){
                  var reversi0 = new Reversi( null, null, null, board_size );
                  reversi0.initBoard();
                  //console.log( { reversi0 } );
                  this.createReversi( reversi0 ).then( async function( result ){
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
  return new Promise( async ( resolve, reject ) => {
    if( pg ){
      var conn = await pg.connect();
      if( conn ){
        try{
          //. #14
          var sql = "select * from reversi where board_size = $1 and process_status < 1 limit 1";
          var query = { text: sql, values: [ board_size ] };
          conn.query( query, async ( err, result ) => {
            if( err ){
              resolve( { status: false, error: err } );
            }else{
              if( !result.rows || result.rows.length == 0 ){
                //. ここで analytics 判定する前に next_ids の null チェックが必要
                sql = "select * from reversi where board_size = $1 and next_ids like '%null%' and process_status = 1 order by depth, updated limit 1";
                query = { text: sql, values: [ board_size ] };
                conn.query( query, async ( err, result ) => {
                  if( err ){
                    console.log( err );
                    resolve( { status: false, client: 'bot', error: err } );
                  }else{
                    if( result.rows.length == 0 ){
                      //. analytics.js
                      var r0 = await this.getTarget( board_size );   // { status: true, parent: result0.rows[0], children: result1.rows }
                      r0.client = 'analytics';
                      resolve( r0 );
                    }else{
                      //. 見つかった
                      var r0 = result.rows[0];   
                      var reversi0 = new Reversi( r0.id, r0.parent_id, r0.next_ids, r0.board_size, r0.depth, r0.board, r0.boards, r0.next_player );
                      reversi0.changeStatus( -1 );
                      resolve( { status: true, client: 'bot', result: reversi0 } );
                    }
                  }
                });
              }else{
                //. bot.js
                //. 特定の board_size 値を持っているレコードの中で、 ( process_status = 0 || ( process_status = -1 && updated + 60000 < t ) を満たしているレコードを探す
                //. order by depth, updated で最初の１件が欲しい
                var t = ( new Date() ).getTime();
                var sql = "select * from reversi where board_size = $1 and next_choices_num > 0 and ( process_status = 0 or ( process_status = -1 and updated + 60000 < $2 ) ) order by depth, updated limit 1";
                var query = { text: sql, values: [ board_size, t ] };
                conn.query( query, ( err, result ) => {
                  if( err ){
                    console.log( err );
                    resolve( { status: false, client: 'bot', error: err } );
                  }else{
                    if( result.rows.length == 0 ){
                      //. 最初の１件ができていない？　または処理終了？
                      sql = "select * from reversi where board_size = $1 limit 1";
                      query = { text: sql, values: [ board_size ] };
                      conn.query( query, async ( err, result ) => {
                        if( err ){
                          console.log( err );
                          resolve( { status: false, client: 'bot', error: err } );
                        }else{
                          if( result.rows.length == 0 ){
                            //. 最初の１件ができていない
                            var r = await this.startProcess( board_size );
                            r.client = 'bot';
                            resolve( r );
                          }else{
                            //. 解析終了、だと思うが、process_status = -1 のままのケースが考えられる。１分後に再処理すべき？
                            sql = "select * from reversi where board_size = $1 and next_choices_num > 0 and process_status = -1 order by depth, updated limit 1";
                            query = { text: sql, values: [ board_size ] };
                            conn.query( query, async ( err, result ) => {
                              if( err ){
                                console.log( err );
                                resolve( { status: false, client: 'bot', error: err } );
                              }else{
                                if( result.rows.length == 0 ){
                                  //. 解析終了
                                  resolve( { status: true, client: 'bot', result: null } );
                                }else{
                                  //. 見つかった
                                  var r0 = result.rows[0];   
                                  var reversi0 = new Reversi( r0.id, r0.parent_id, r0.next_ids, r0.board_size, r0.depth, r0.board, r0.boards, r0.next_player );
                                  //reversi0.process_status = r0.process_status;
                                  reversi0.changeStatus( -1 );

                                  //. 見つかった状態の reversi0 を返す
                                  resolve( { status: true, client: 'bot', result: reversi0 } );
                                }
                              }
                            });
                          }
                        }
                      });
                    }else{
                      var r0 = result.rows[0];   
                      var reversi0 = new Reversi( r0.id, r0.parent_id, r0.next_ids, r0.board_size, r0.depth, r0.board, r0.boards, r0.next_player );
                      //reversi0.next_processed_num = r0.next_processed_num;
                      reversi0.changeStatus( -1 );
                      this.updateReversiStatus( reversi0.id, reversi0.process_status ).then( function( result ){
                        if( result && result.status ){
                          //. この状態の reversi0 を返す
                          resolve( { status: true, client: 'bot', result: reversi0 } );
                        }else{
                          resolve( { status: false, client: 'bot', error: 'update reversi0 failed.' } );
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
      var conn = await pg.connect();
      if( conn ){
        try{
          this.createReversis( reversis ).then( async ( result ) => {
            if( result && result.status && result.next_ids ){
              //. console.log( 'result.count = #' + result.count );
              //. 最後に親レコードのステータスを更新する
              var id = reversis[0].parent_id;
              if( id ){
                var r = await this.readReversi( id );
                if( r && r.status ){
                  var r0 = r.result;
                  var reversi0 = new Reversi( r0.id, r0.parent_id, result.next_ids, r0.board_size, r0.depth, r0.board, r0.boards, r0.next_player );
                  reversi0.changeStatus( 1 );
                  this.updateReversiStatus( reversi0.id, reversi0.process_status, result.next_ids ).then( function( result ){
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
api.updateReversiStatus = async function( reversi_id, reversi_process_status, reversi_next_ids ){
  return new Promise( async ( resolve, reject ) => {
    if( pg ){
      var conn = await pg.connect();
      if( conn ){
        try{
          if( !reversi_id ){
            resolve( { status: false, error: 'no id.' } );
          }else{
            var t = ( new Date() ).getTime();
            var params = [ reversi_process_status, t ];
            var sql = 'update reversi set process_status = $1, updated = $2';
            if( reversi_next_ids ){
              if( typeof reversi_next_ids == 'object' ){ reversi_next_ids = JSON.stringify( reversi_next_ids ); }
              sql += ", next_ids = '" + reversi_next_ids + "'"
            }
            sql += ' where id = $3'
            params.push( reversi_id );

            var query = { text: sql, values: params };
            conn.query( query, function( err, result ){
              if( err ){
                console.log( err );
                resolve( { status: false, error: err } );
              }else{
                resolve( { status: true, result: result } );
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

api.updateReversiNextId = async function( reversi_id, reversi_next_ids ){
  return new Promise( async ( resolve, reject ) => {
    if( pg ){
      var conn = await pg.connect();
      if( conn ){
        try{
          if( !reversi_id ){
            resolve( { status: false, error: 'no id.' } );
          }else{
            var sql = 'update reversi set next_ids = $1, process_status = 1, updated = $2 where id = $3';
            var t = ( new Date() ).getTime();
            if( typeof reversi_next_ids == 'object' ){ reversi_next_ids = JSON.stringify( reversi_next_ids ); }
            var query = { text: sql, values: [ reversi_next_ids, t, reversi_id ] };
            conn.query( query, function( err, result ){
              if( err ){
                console.log( err );
                resolve( { status: false, error: err } );
              }else{
                resolve( { status: true, result: result } );
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

//. Delete
api.deleteReversi = async function( reversi_id ){
  return new Promise( async ( resolve, reject ) => {
    if( pg ){
      var conn = await pg.connect();
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
      var conn = await pg.connect();
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
        var conn = await pg.connect();
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
                    if( typeof reversi0.created == 'string' ){
                      reversi0.created = parseInt( reversi0.created );
                    }
                    if( typeof reversi0.updated == 'string' ){
                      reversi0.updated = parseInt( reversi0.updated );
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

//. v0.3.0 では使わない？
api.readInfo = async function( parent_id, choice_idx ){
  return new Promise( async ( resolve, reject ) => {
    if( pg ){
      if( parent_id != null && choice_idx > -1 ){
        var conn = await pg.connect();
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
        var conn = await pg.connect();
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
                    if( typeof reversi0.created == 'string' ){
                      reversi0.created = parseInt( reversi0.created );
                    }
                    if( typeof reversi0.updated == 'string' ){
                      reversi0.updated = parseInt( reversi0.updated );
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
        resolve( { status: false, error: 'readInfoById: no proper id.' } );
      }
    }else{
      resolve( { status: false, error: 'no connection.' } );
    }
  });
};

//. #14
api.getTarget = async function( board_size ){
  return new Promise( async ( resolve, reject ) => {
    if( pg ){
      if( typeof board_size == 'string' ){ board_size = parseIint( board_size ); }
      if( board_size == 4 || board_size == 6 || board_size == 8 ){
        var conn = await pg.connect();
        if( conn ){
          try{
            var t = ( new Date() ).getTime();
            var sql = "select id, parent_id, next_ids, board_size, depth, board, next_choices, next_choices_num, process_status, player0_count, player1_count, next_player, value, value_status, next_player, created, updated from reversi where board_size = $1 and depth = ( select max(depth) from reversi where ( value_status = 0 or ( value_status = -2 and updated + 60000 < $2 ) ) ) and ( value_status = 0 or ( value_status = -2 and updated + 60000 < $3 ) ) order by depth desc, created limit 1";
            var query = { text: sql, values: [ board_size, t, t ] };
            conn.query( query, function( err, result0 ){
              if( err ){
                console.log( err );
                resolve( { status: false, error: err } );
              }else{
                if( result0 && result0.rows && result0.rows.length > 0 ){
                  var next_ids = result0.rows[0].next_ids;
                  //. next_ids = [null]; の場合は？
                  if( typeof next_ids == 'string' ){ next_ids = JSON.parse( next_ids ); }
                  if( next_ids && next_ids.length > 0 && nonNullExist( next_ids ) ){
                    sql = "update reversi set value_status = -2, updated = $1 where id = $2";
                    var t = ( new Date() ).getTime();
                    query = { text: sql, values: [ t, result0.rows[0].id ] };

                    conn.query( query, function( err, result ){
                      if( err ){
                        console.log( err );
                        resolve( { status: false, error: err } );
                      }else{
                        var where = next_ids.join( "','" );
                        if( where ){
                          sql = "select id, parent_id, depth, player0_count, player1_count, value, value_status, next_player from reversi where id in ('" + where + "') order by created";
                          query = { text: sql, values: [] };
                          conn.query( query, function( err1, result1 ){
                            if( err1 ){
                              sql = "update reversi set value_status = 0, updated = $1 where id = $2";
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
                        }else{
                          sql = "update reversi set value_status = 0, updated = $1 where id = $2";
                          t = ( new Date() ).getTime();
                          query = { text: sql, values: [ t, result0.rows[0].id ] };
                          conn.query( query, function( err2, result2 ){
                            if( err2 ){
                              console.log( err2 );
                              resolve( { status: false, error: err2 } );
                            }else{
                              resolve( { status: false, error: 'no next_ids specified.' } );
                            }
                          });
                        }
                      }
                    });
                  }else{
                    console.log( JSON.stringify( result0.rows[0] ) );
                    sql = "update reversi set value_status = 0, updated = $1 where id = $2";
                    t = ( new Date() ).getTime();
                    query = { text: sql, values: [ t, result0.rows[0].id ] };
                    conn.query( query, function( err2, result2 ){
                      if( err2 ){
                        resolve( { status: false, error: err2 } );
                      }else{
                        //. result0.rows[0].next_ids = [null]
                        //. これが返った場合は処理を続行してほしい
                        resolve( { status: true, error: 'no next_ids.' } );
                      }
                    });
                  }
                }else{
                  resolve( { status: true, parent: null, children: null } );
                }
              }
            });
          }catch( e ){
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

api.updateTarget = async function( id, value ){
  return new Promise( async ( resolve, reject ) => {
    if( pg ){
      if( id != null && value != null ){
        var conn = await pg.connect();
        if( conn ){
          try{
            var sql = 'update reversi set value = $1, value_status = 2, updated = $2 where id = $3';
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
          resolve( { status: false, error: 'db not ready.' } );
        }
      }else{
        resolve( { status: false, error: 'updateTarget: no proper id.' } );
      }
    }else{
      resolve( { status: false, error: 'no connection.' } );
    }
  });
};

//. #17
//. v0.3.0 では使わない？
api.getBestChoice = async function( board, next_player ){
  return new Promise( async ( resolve, reject ) => {
    if( pg ){
      if( board != null && board.length >= 4 && next_player != 0 ){
        var conn = await pg.connect();
        if( conn ){
          try{
            var sql = "select * from reversi where parent_id = ( select id from reversi where board = $1 and next_player = $2 and value_status > 0 limit 1 ) order by parent_id desc";
            var query = { text: sql, values: [ board, next_player ] };
            conn.query( query, function( err, result0 ){
              if( err ){
                console.log( err );
                resolve( { status: false, error: err } );
              }else{
                if( result0.rows.length > 0 ){
                  var idx = 0;
                  var v = result0.rows[0].value;
                  if( typeof v == 'string' ){ v = parseInt( v ); }
                  for( var i = 1; i < result0.rows.length; i ++ ){
                    if( next_player == 1 ){
                      if( result0.rows[i].value > v ){
                        v = result0.rows[i].value;
                        idx = i;
                      }
                    }else{
                      if( result0.rows[i].value < v ){
                        v = result0.rows[i].value;
                        idx = i;
                      }
                    }
                  }

                  resolve( { status: true, best_choice_idx: idx, choice_x: result0.rows[idx].choice_x, choice_y: result0.rows[idx].choice_y, board: result0.rows[idx].board, value: v } );
                }else{
                  resolve( { status: false, error: 'no analysed records found.' } );
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
        resolve( { status: false, error: 'no proper board and/or next_player.' } );
      }
    }else{
      resolve( { status: false, error: 'no connection.' } );
    }
  });
};

//. v0.3.0 では使わない？
api.getValuesByChoice = async function( board, next_player ){
  return new Promise( async ( resolve, reject ) => {
    if( pg ){
      if( board != null && board.length >= 4 && next_player != 0 ){
        var conn = await pg.connect();
        if( conn ){
          try{
            //. "error: more than one row returned by a subquery used as an expression."
            var sql = "select id, choice_idx, choice_x, choice_y, board, value, next_player from reversi where parent_id in ( select id from reversi where board = $1 and next_player = $2 and value_status > 0 ) order by parent_id desc";
            var query = { text: sql, values: [ board, next_player ] };
            conn.query( query, function( err, result0 ){
              if( err ){
                console.log( err );
                resolve( { status: false, error: err } );
              }else{
                if( result0.rows.length > 0 ){
                  resolve( { status: true, records: result0.rows } );
                }else{
                  resolve( { status: false, error: 'no analysed records found.' } );
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
        resolve( { status: false, error: 'no proper board and/or next_player.' } );
      }
    }else{
      resolve( { status: false, error: 'no connection.' } );
    }
  });
};

//. #28
api.getStatusValues = async function(){
  return new Promise( async ( resolve, reject ) => {
    if( pg ){
      var conn = await pg.connect();
      if( conn ){
        try{
          var sql = "select depth, value_status, count(*) as count from reversi group by depth, value_status order by depth, value_status";
          var query = { text: sql, values: [] };
          conn.query( query, function( err, result ){
            if( err ){
              console.log( err );
              resolve( { status: false, error: err } );
            }else{
              if( result.rows.length > 0 ){
                resolve( { status: true, results: result.rows } );
              }else{
                resolve( { status: false, error: 'no records found.' } );
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
    if( typeof reversis[i].next_ids == 'string' ){ reversis[i].next_ids = JSON.parse( reversis[i].next_ids ); }
    if( typeof reversis[i].board_size == 'string' ){ reversis[i].board_size = parseInt( reversis[i].board_size ); }
    if( typeof reversis[i].depth == 'string' ){ reversis[i].depth = parseInt( reversis[i].depth ); }
    if( typeof reversis[i].board == 'string' ){ reversis[i].board = JSON.parse( JSON.stringify( reversis[i].board ).split( '"' ).join( '' ) ); }
    if( typeof reversis[i].next_choices == 'string' ){ reversis[i].next_choices = JSON.parse( JSON.stringify( reversis[i].next_choices ).split( '"' ).join( '' ) ); }
    if( typeof reversis[i].next_choices_num == 'string' ){ reversis[i].next_choices_num = parseInt( reversis[i].next_choices_num ); }
    if( typeof reversis[i].process_status == 'string' ){ reversis[i].process_status = parseInt( reversis[i].process_status ); }
    if( typeof reversis[i].player0_count == 'string' ){ reversis[i].player0_count = parseInt( reversis[i].player0_count ); }
    if( typeof reversis[i].player1_count == 'string' ){ reversis[i].player1_count = parseInt( reversis[i].player1_count ); }
    if( typeof reversis[i].next_player == 'string' ){ reversis[i].next_player = parseInt( reversis[i].next_player ); }
  };

  api.updateProcess( reversis ).then( function( result ){
    res.status( result.status ? 200 : 400 );
    res.write( JSON.stringify( result, null, 2 ) );
    res.end();
  });
});

//. #14
api.post( '/reversi/target', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  var board_size = 0;
  if( req.body.board_size ){
    var _board_size = req.body.board_size;
    try{
      board_size = parseInt( _board_size );
    }catch( e ){
    }
  }
  api.getTarget( board_size ).then( function( result ){
    res.status( result.status ? 200 : 400 );
    res.write( JSON.stringify( result, null, 2 ) );  //. { status: true, parent: result0.rows[0], children: result1.rows }
    res.end();
  });
});

api.put( '/reversi/target', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  var id = '';
  var value = null;
  if( req.body.id ){
    id = req.body.id;
  }
  if( 'value' in req.body ){
    value = req.body.value;
    /*
    try{
      value = parseInt( value );
    }catch( e ){
      console.log( { e } );
    }
    */
  }

  api.updateTarget( id, value ).then( function( result ){
    res.status( result.status ? 200 : 400 );
    res.write( JSON.stringify( result, null, 2 ) );  //. { status: true, result: {...} }
    res.end();
  });
});

//. #17
api.post( '/reversi/best_choice', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  var board = req.body.board;  //. (string)
  var next_player = parseInt( req.body.board );
  api.getBestChoice( board, next_player ).then( function( result ){
    res.status( result.status ? 200 : 400 );
    res.write( JSON.stringify( result, null, 2 ) );  //. { status: true, best_choice_idx: 2 }
    res.end();
  });
});

api.post( '/reversi/values_by_choice', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  var board = req.body.board;  //. (string)
  var next_player = parseInt( req.body.next_player );
  api.getValuesByChoice( board, next_player ).then( function( result ){
    res.status( result.status ? 200 : 400 );
    res.write( JSON.stringify( result, null, 2 ) );  //. { status: true, records: records }
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
  api.updateReversiStatus( reversi_id, reversi.next_processed_num ).then( function( result ){
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

//. #28
api.get( '/dbstatus', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  api.getStatusValues().then( function( result ){
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
  //var init_board = getInitBoard( board_size );
  var reversi0 = new Reversi( null, null, null, board_size, 0, null, null, 1 );
  reversi0.initBoard();

  return reversi0;
};

function generateUUID(){
  did = ( new Date().getTime().toString(16) ) + Math.floor( 10000000 * Math.random() ).toString(16);

  return did;
}

function convertBoards( boards ){
  var s = [];
  if( typeof boards == 'string' ){ boards = boards.split( ':' ); }
  for( var i = 0; i < boards.length; i ++ ){
    s.push( ( typeof boards[i] == 'string' ? boards[i] : JSON.stringify( boards[i] ) ) );
  }

  return s.join( ':' );
}

function nonNullExist( arr ){
  var b = false;
  if( arr && arr.length > 0 ){
    for( var i = 0; i < arr.length && !b; i ++ ){
      b = ( arr[i] ? true : false );
    }
  }

  return b;
}

//. api をエクスポート
module.exports = api;
