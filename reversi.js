//. reversi.js
var reversi = class{
  constructor( id, parent_id, old_depth, choice_idx, choice, board, player ){
    this.id = ( id || new Date().getTime().toString(16) ) + Math.floor( 1000 * Math.random() ).toString(16);
    this.parent_id = parent_id;
    this.size = board.length;
    this.depth = old_depth + 1;
    this.choice_idx = choice_idx;  //. 同じ parent_id の中で、next_choices の何番目の選択肢を選んだ結果だったのか
    this.choice = choice;  //. [ x, y ]
    this.board = board;  //. [ [ 0, 0, 0, 0, 0, 0, 0, 0 ], .. ]
    this.next_choices = [];  //. [ [ 2, 3 ], .. ]
    this.next_status = [];
    this.player0_count = 0;
    this.player1_count = 0;

    //. choice = [ x, y ]
    if( choice[0] > -1 && choice[1] > -1 && this.board[choice[1]][choice[0]] == 0 ){
      var y = choice[0];
      var x = choice[1];
      console.log( 'player='+player+',x='+x+',y='+y );
      this.board[x][y] = player;

      //. ひっくり返す
      var other = -1 * player;

      if( y > 0 ){
        if( x > 0 && this.board[x-1][y-1] == other ){
          var c = 2;
          while( c > 1 && ( x - c ) >= 0 && ( y - c ) >= 0 ){
            if( this.board[x-c][y-c] == player ){
              for( var i = 1; i < c; i ++ ){
                this.board[x-i][y-i] = player;
              }

              c = 0;
            }
            c ++;
          }
        }

        if( board[x][y-1] == other ){
          var c = 2;
          while( c > 1 && ( y - c ) >= 0 ){
            if( board[x][y-c] == player ){
              for( var i = 1; i < c; i ++ ){
                this.board[x][y-i] = player;
              }

              c = 0;
            }
            c ++;
          }
        }
    
        if( x < this.size - 1 && board[x+1][y-1] == other ){
          var c = 2;
          while( c > 1 && ( x + c ) < this.size && ( y - c ) >= 0 ){
            if( board[x+c][y-c] == player ){
              for( var i = 1; i < c; i ++ ){
                this.board[x+i][y-i] = player;
              }

              c = 0;
            }
            c ++;
          }
        }
      }

      if( x > 0 && board[x-1][y] == other ){
        var c = 2;
        while( c > 1 && ( x - c ) >= 0 ){
          if( board[x-c][y] == player ){
            for( var i = 1; i < c; i ++ ){
              this.board[x-i][y] = player;
            }

            c = 0;
          }
          c ++;
        }
      }

      if( x < this.size - 1 && board[x+1][y] == other ){
        var c = 2;
        while( c > 1 && ( x + c ) < this.size ){
          if( board[x+c][y] == player ){
            for( var i = 1; i < c; i ++ ){
              this.board[x+i][y] = player;
            }

            c = 0;
          }
          c ++;
        }
      }

      if( y < this.size - 1 ){
        if( x > 0 && board[x-1][y+1] == other ){
          var c = 2;
          while( c > 1 && ( x - c ) >= 0 && ( y + c ) < this.size ){
            if( board[x-c][y+c] == player ){
              for( var i = 1; i < c; i ++ ){
                this.board[x-i][y+i] = player;
              }

              c = 0;
            }
            c ++;
          }
        }

        if( board[x][y+1] == other ){
          var c = 2;
          while( c > 1 && ( y + c ) < this.size ){
            if( board[x][y+c] == player ){
              for( var i = 1; i < c; i ++ ){
                this.board[x][y+i] = player;
              }

              c = 0;
            }
            c ++;
          }
        }
    
        if( x < this.size - 1 && board[x+1][y+1] == other ){
          var c = 2;
          while( c > 1 && ( x + c ) < this.size && ( y + c ) < this.size ){
            if( board[x+c][y+c] == player ){
              for( var i = 1; i < c; i ++ ){
                this.board[x+i][y+i] = player;
              }

              c = 0;
            }
            c ++;
          }
        }
      }
    }

    //. count
    for( var i = 0; i < this.size; i ++ ){
      for( var j = 0; j < this.size; j ++ ){
        if( this.board[i][j] == 1 ){
            this.player0_count ++;
        }else if ( this.board[i][j] == -1 ){
            this.player1_count ++;
        }
      }
    }

    var other_player = -1 * player;

    //. find nexts;
    for( var i = 0; i < this.size; i ++ ){
      for( var j = 0; j < this.size; j ++ ){
        if( this.board[i][j] == 0 && this.playerChoicable( j, i, other_player )){
          this.next_choices.push( [ j, i ] );
          this.next_status.push( 0 );
        }
      }
    }

    if( this.next_choices.length == 0 ){
      //. 次の手で相手はパスしかない
      for( var i = 0; i < this.size; i ++ ){
        for( var j = 0; j < this.size; j ++ ){
          if( this.board[i][j] == 0 && this.playerChoicable( j, i, player )){
            this.next_choices.push( [ j, i ] );
            this.next_status.push( 0 );
          }
        }
      }

      if( this.next_choices.length == 0 ){
        //. 次の手は自分もパスしかない
        this.showBoard( true );
      }else{
        this.player = player;
      }
    }else{
      this.player = other_player;
    }
  };

  changeStatus( idx, new_status ){
    //. new_status: 0=未処理, -1=処理中, 1=処理済み
    this.next_status[idx] = new_status;
  }

  showBoard( game_end ){
    console.log( '' );

    for( var i = 0; i < this.size; i ++ ){
      if( i == 0 ){
        var l = ' ';
        for( var j = 0; j < this.size; j ++ ){
          l += ( '  ' + j );
        }
        console.log( l );
        l = ' ';
        for( var j = 0; j < this.size; j ++ ){
          l += ' ＿';
        }
        console.log( l );
      }
      var line =  i + '|';
      for( var j = 0; j < this.size; j ++ ){
        var c = ( this.board[i][j] == 0 ? '　' :
          ( this.board[i][j] == 1 ? '●' : '○' )
        );
        line += ( c + ' ' );
      }
      console.log( line );
    }
    console.log( '' );
    console.log( '● Player 0: ' + this.player0_count );
    console.log( '○ Player 1: ' + this.player1_count );
    console.log( 'Next : Player ' + ( this.player == 1 ? '0 ●' : '1 ○' ) );

    console.log( '' );
    console.log( 'Choices:' );
    for( var i = 0; i < this.next_choices.length; i ++ ){
      console.log( ' ' + i + ' : ' + JSON.stringify( this.next_choices[i] ) + ' (' + this.next_status[i] + ')' );
    }

    if( game_end ){
      console.log( '' );

    }

    console.log( '' );
  }

  playerChoicable( x, y, p ){
    var b = false;
    var o = -1 * p;

    if( y > 0 ){
      if( x > 0 && this.board[x-1][y-1] == o ){
        var c = 2;
        while( ( x - c ) >= 0 && ( y - c ) >= 0 ){
          if( this.board[x-c][y-c] == p ){
            b = true;
          }
          c ++;
        }
      }

      if( this.board[x][y-1] == o ){
        var c = 2;
        while( ( y - c ) >= 0 ){
          if( this.board[x][y-c] == p ){
            b = true;
          }
          c ++;
        }
      }

      if( x < this.size - 1 && this.board[x+1][y-1] == o ){
        var c = 2;
        while( ( x + c ) < this.size - 1 && ( y - c ) >= 0 ){
          if( this.board[x+c][y-c] == p ){
            b = true;
          }
          c ++;
        }
      }
    }

    if( x > 0 && this.board[x-1][y] == o ){
      var c = 2;
      while( ( x - c ) >= 0 ){
        if( this.board[x-c][y] == p ){
          b = true;
        }
        c ++;
      }
    }

    if( x < this.size - 1 && this.board[x+1][y] == o ){
      var c = 2;
      while( ( x + c ) < this.size ){
        if( this.board[x+c][y] == p ){
          b = true;
        }
        c ++;
      }
    }

    if( y < this.size - 1 ){
      if( x > 0 && this.board[x-1][y+1] == o ){
        var c = 2;
        while( ( x - c ) >= 0 && ( y + c ) < this.size ){
          if( this.board[x-c][y+c] == p ){
            b = true;
          }
          c ++;
        }
      }

      if( this.board[x][y+1] == o ){
        var c = 2;
        while( ( y + c ) < this.size ){
          if( this.board[x][y+c] == p ){
            b = true;
          }
          c ++;
        }
      }
    
      if( x < this.size - 1 && this.board[x+1][y+1] == o ){
        var c = 2;
        while( ( x + c ) < this.size && ( y + c ) < this.size ){
          if( this.board[x+c][y+c] == p ){
            b = true;
          }
          c ++;
        }
      }
    }

    return b;
  }
};


if( typeof module === 'object' ){
  module.exports = reversi;
}
