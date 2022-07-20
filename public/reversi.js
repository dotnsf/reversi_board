//. reversi.js
var reversi = class{
  constructor( id, parent_id, depth, choice_idx, choice, board, player ){
    this.id = ( id ? id : ( new Date().getTime().toString(16) ) + Math.floor( 1000 * Math.random() ).toString(16) );
    this.parent_id = parent_id;
    this.board_size = board.length;  //. "Cannot read property 'length' of undefined"
    this.depth = depth;
    this.choice_idx = choice_idx;  //. 同じ parent_id の中で、next_choices の何番目の選択肢を選んだ結果だったのか
    this.choice = choice;  //. [ y, x ]
    this.board = board;  //. [ [ 0, 0, 0, 0, 0, 0, 0, 0 ], .. ]
    this.next_choices = [];  //. [ [ 2, 3 ], .. ]
    this.next_status = [];
    this.next_choices_num = 0;
    this.next_processed_num = 0;
    this.player0_count = 0;
    this.player1_count = 0;
    this.next_player = player;

    //. choice = [ y, x ]
    if( choice[0] > -1 && choice[1] > -1 && this.board[choice[0]][choice[1]] == 0 ){
      var y = choice[0];
      var x = choice[1];
      //console.log( 'player='+player+',x='+x+',y='+y );
      this.board[y][x] = player;

      //. ひっくり返す
      var other = -1 * player;

      if( y > 0 ){
        if( x > 0 && this.board[y-1][x-1] == other ){
          var c = 2;
          var z = false;
          while( c > 1 && ( x - c ) >= 0 && ( y - c ) >= 0 && !z ){
            if( this.board[y-c][x-c] == 0 ){
              z = true;
            }else if( this.board[y-c][x-c] == player ){
              for( var i = 1; i < c; i ++ ){
                this.board[y-i][x-i] = player;
              }

              c = 0;
            }
            c ++;
          }
        }

        if( board[y-1][x] == other ){
          var c = 2;
          var z = false;
          while( c > 1 && ( y - c ) >= 0 && !z ){
            if( board[y-c][x] == 0 ){
              z = true;
            }else if( board[y-c][x] == player ){
              for( var i = 1; i < c; i ++ ){
                this.board[y-i][x] = player;
              }

              c = 0;
            }
            c ++;
          }
        }
    
        if( x < this.board_size - 1 && board[y-1][x+1] == other ){
          var c = 2;
          var z = false;
          while( c > 1 && ( x + c ) < this.board_size && ( y - c ) >= 0 && !z ){
            if( board[y-c][x+c] == 0 ){
              z = true;
            }else if( board[y-c][x+c] == player ){
              for( var i = 1; i < c; i ++ ){
                this.board[y-i][x+i] = player;
              }

              c = 0;
            }
            c ++;
          }
        }
      }

      if( x > 0 && board[y][x-1] == other ){
        var c = 2;
        var z = false;
        while( c > 1 && ( x - c ) >= 0  && !z){
          /* K.Kimura ここのロジックがおかしい
          ( board[y][x-d] == player ) となる d > 2 が存在していて、
          かつ全ての 1 < c < d に対して ( board[y][x-c] == other ) が存在する時に for ループを実行するべき
          */
          if( board[y][x-c] == 0 ){
            z = true;
          }else if( board[y][x-c] == player ){
            for( var i = 1; i < c; i ++ ){
              this.board[y][x-i] = player;
            }

            c = 0;
          }
          c ++;
        }
      }

      if( x < this.board_size - 1 && board[y][x+1] == other ){
        var c = 2;
        var z = false;
        while( c > 1 && ( x + c ) < this.board_size && !z ){
          if( board[y][x+c] == 0 ){
            z = true;
          }else if( board[y][x+c] == player ){
            for( var i = 1; i < c; i ++ ){
              this.board[y][x+i] = player;
            }

            c = 0;
          }
          c ++;
        }
      }

      if( y < this.board_size - 1 ){
        if( x > 0 && board[y+1][x-1] == other ){
          var c = 2;
          var z = false;
          while( c > 1 && ( x - c ) >= 0 && ( y + c ) < this.board_size && !z ){
            if( board[y+c][x-c] == 0 ){
              z = true;
            }else if( board[y+c][x-c] == player ){
              for( var i = 1; i < c; i ++ ){
                this.board[y+i][x-i] = player;
              }

              c = 0;
            }
            c ++;
          }
        }

        if( board[y+1][x] == other ){
          var c = 2;
          var z = false;
          while( c > 1 && ( y + c ) < this.board_size && !z ){
            if( board[y+c][x] == 0 ){
              z = true;
            }else if( board[y+c][x] == player ){
              for( var i = 1; i < c; i ++ ){
                this.board[y+i][x] = player;
              }

              c = 0;
            }
            c ++;
          }
        }
    
        if( x < this.board_size - 1 && board[y+1][x+1] == other ){
          var c = 2;
          var z = false;
          while( c > 1 && ( x + c ) < this.board_size && ( y + c ) < this.board_size && !z ){
            if( board[y+c][x+c] == 0 ){
              z = true;
            }else if( board[y+c][x+c] == player ){
              for( var i = 1; i < c; i ++ ){
                this.board[y+i][x+i] = player;
              }

              c = 0;
            }
            c ++;
          }
        }
      }

      this.next_player *= -1;
    }

    //. count
    for( var i = 0; i < this.board_size; i ++ ){
      for( var j = 0; j < this.board_size; j ++ ){
        if( this.board[i][j] == 1 ){
            this.player0_count ++;
        }else if ( this.board[i][j] == -1 ){
            this.player1_count ++;
        }
      }
    }

    //. find nexts;
    for( var i = 0; i < this.board_size; i ++ ){    //. i = y
      for( var j = 0; j < this.board_size; j ++ ){  //. j = x
        if( this.board[i][j] == 0 && this.playerChoicable( j, i, this.next_player )){
          //this.next_choices.push( [ j, i ] );
          this.next_choices.push( [ i, j ] );
          this.next_status.push( 0 );
        }
      }
    }

    this.next_choices_num = this.next_choices.length;
    this.next_processed_num = 0;

    if( this.next_choices_num == 0 ){
      //. 次の手で相手はパスしかない
      this.next_player *= -1;
      this.next_choices = [];
      this.next_status = [];
      for( var i = 0; i < this.board_size; i ++ ){
        for( var j = 0; j < this.board_size; j ++ ){
          if( this.board[i][j] == 0 && this.playerChoicable( j, i, this.next_player )){
            //this.next_choices.push( [ j, i ] );
            this.next_choices.push( [ i, j ] );
            this.next_status.push( 0 );
          }
        }
      }

      this.next_choices_num = this.next_choices.length;
      this.next_processed_num = 0;

      if( this.next_choices_num == 0 ){
        //. 次の手は自分もパスしかない = ゲーム終了
        this.next_player = 0;
        this.showBoard( true );
      }
    }else{
      //this.next_player = other_player;
    }
  };

  changeStatus( idx, new_status ){
    //. new_status: 0=未処理, -1=処理中, 1=処理済み
    this.next_status[idx] = new_status;

    if( new_status == 1 ){
      this.next_processed_num ++;
    }
  }

  showBoard( game_end ){
    console.log( '' );
    console.log( 'parent_id = ' + this.parent_id );
    console.log( 'board_size = ' + this.board_size );
    console.log( 'depth = ' + this.depth );
    console.log( 'choice_idx = ' + this.choice_idx );
    console.log( 'choices_num = ' + this.next_choices_num );
    console.log( 'processed_num = ' + this.next_processed_num );
    console.log( '' );

    for( var i = 0; i < this.board_size; i ++ ){
      if( i == 0 ){
        var l = ' ';
        for( var j = 0; j < this.board_size; j ++ ){
          l += ( '  ' + j );
        }
        console.log( l );
        l = ' ';
        for( var j = 0; j < this.board_size; j ++ ){
          l += ' ＿';
        }
        console.log( l );
      }
      var line =  i + '|';
      for( var j = 0; j < this.board_size; j ++ ){
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
    console.log( 'Next : Player ' + ( this.next_player == 1 ? '0 ●' : '1 ○' ) );

    console.log( '' );
    console.log( 'Choices:' );
    for( var i = 0; i < this.next_choices.length; i ++ ){
      console.log( ' ' + i + ' : [ ' + this.next_choices[i][1] + ', ' + this.next_choices[i][0] + ' ] (' + this.next_status[i] + ')' );
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
      if( x > 0 && this.board[y-1][x-1] == o ){
        var c = 2;
        var z = false;
        while( ( x - c ) >= 0 && ( y - c ) >= 0 && !z && !b ){
          if( this.board[y-c][x-c] == 0 ){
            z = true;
          }else if( this.board[y-c][x-c] == p ){
            b = true;
          }
          c ++;
        }
      }

      if( this.board[y-1][x] == o ){
        var c = 2;
        var z = false;
        while( ( y - c ) >= 0 && !z && !b ){
          if( this.board[y-c][x] == 0 ){
            z = true;
          }else if( this.board[y-c][x] == p ){
            b = true;
          }
          c ++;
        }
      }

      if( x < this.board_size - 1 && this.board[y-1][x+1] == o ){
        var c = 2;
        var z = false;
        while( ( x + c ) < this.board_size && ( y - c ) >= 0 && !z && !b ){
          if( this.board[y-c][x+c] == 0 ){
            z = true;
          }else if( this.board[y-c][x+c] == p ){
            b = true;
          }
          c ++;
        }
      }
    }

    if( x > 0 && this.board[y][x-1] == o ){
      var c = 2;
      var z = false;
      while( ( x - c ) >= 0 && !z && !b ){
        if( this.board[y][x-c] == 0 ){
          z = true;
        }else if( this.board[y][x-c] == p ){
          b = true;
        }
        c ++;
      }
    }

    if( x < this.board_size - 1 && this.board[y][x+1] == o ){
      var c = 2;
      var z = false;
      while( ( x + c ) < this.board_size && !z && !b ){
        if( this.board[y][x+c] == 0 ){
          z = true;
        }else if( this.board[y][x+c] == p ){
          b = true;
        }
        c ++;
      }
    }

    if( y < this.board_size - 1 ){
      if( x > 0 && this.board[y+1][x-1] == o ){
        var c = 2;
        var z = false;
        while( ( x - c ) >= 0 && ( y + c ) < this.board_size && !z && !b ){
          if( this.board[y+c][x-c] == 0 ){
            z = true;
          }else if( this.board[y+c][x-c] == p ){
            b = true;
          }
          c ++;
        }
      }

      if( this.board[y+1][x] == o ){
        var c = 2;
        var z = false;
        while( ( y + c ) < this.board_size && !z && !b ){
          if( this.board[y+c][x] == 0 ){
            z = true;
          }else if( this.board[y+c][x] == p ){
            b = true;
          }
          c ++;
        }
      }
    
      if( x < this.board_size - 1 && this.board[y+1][x+1] == o ){
        var c = 2;
        var z = false;
        while( ( x + c ) < this.board_size && ( y + c ) < this.board_size && !z && !b ){
          if( this.board[y+c][x+c] == 0 ){
            z = true;
          }else if( this.board[y+c][x+c] == p ){
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
