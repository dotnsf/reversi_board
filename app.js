//. app.js
var express = require( 'express' ),
    ejs = require( 'ejs' ),
    session = require( 'express-session' ),
    app = express();

var api = require( './api/db_postgres' );
app.use( '/api', api );

app.use( express.Router() );
app.use( express.static( __dirname + '/public' ) );

app.set( 'views', __dirname + '/views' );
app.set( 'view engine', 'ejs' );

var BOARD_SIZE = 4;
var _BOARD_SIZE = 'BOARD_SIZE' in process.env ? process.env.BOARD_SIZE : ''; 
try{
  if( _BOARD_SIZE ){
    BOARD_SIZE = parseInt( _BOARD_SIZE );
  }
}catch( e ){
}

//. Session
var sess = {
  secret: 'reversi_board',
  cookie: {
    path: '/',
    maxAge: (7 * 24 * 60 * 60 * 1000)
  },
  resave: false,
  saveUninitialized: false //true
};
app.use( session( sess ) );

app.get( '/', function( req, res ){
  //res.render( 'index', { board_size: BOARD_SIZE } );
  res.render( 'status', { board_size: BOARD_SIZE } );
});

/*
app.get( '/status', function( req, res ){
  res.render( 'status', { board_size: BOARD_SIZE } );
});
*/


var port = process.env.PORT || 8080;
app.listen( port );
console.log( "server starting on " + port + " ..." );

module.exports = app;
