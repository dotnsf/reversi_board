//. reversi.js
var reversi = class{
  constructor( id, parent_id, next_id, next_idx, board_size, depth, board, boards, next_player ){
    this.id = id;
    this.parent_id = parent_id;
    this.next_id = next_id;
    this.next_idx = next_idx;
    this.board_size = board_size;
    this.depth = depth;
    this.board = ( typeof board == 'string' ? JSON.parse( board ) : board );
    this.boards = ( typeof boards == 'string' ? JSON.parse( boards.split( ":" ) ) : boards );
    this.next_player = next_player;

    this.next_choices = [];  //. [ [ 2, 3 ], .. ]
    this.next_choices_num = 0;
    this.process_status = 0;
    this.player0_count = 0;
    this.player1_count = 0;
    this.value = 0;
    this.value_status = 0;


    if( this.board ){
      //. count
      this.countBoard();

      //. find nexts( next_player, next_choices, next_choices_num )
      this.findNext();
      
      //. boards
      if( !this.boards && this.board ){
        this.calcBoards();
      }

      //. 次がパスでないことを確認
      this.checkNext();
    }
  };

  initBoard(){
    this.parent_id = null;
    this.next_id = null;
    this.next_idx = null;
    this.depth = 0;
    this.player0_count = 2;
    this.player1_count = 2;
    this.next_player = 1;
    this.process_status = 0;
    this.value = 0;
    this.value_status = 0;

    this.board = [];
    var h = this.board_size / 2;
    for( var i = 0; i < this.board_size; i ++ ){
      for( var j = 0; j < this.board_size; j ++ ){
        if( ( i == h - 1 || i == h ) && ( j == h - 1 || j == h ) ){
          if( i == j ){
            this.board.push( 1 );
          }else{
            this.board.push( -1 );
          }
        }else{
          this.board.push( 0 );
        }
      }
    }

    //. count
    this.countBoard();

    //. count
    this.calcBoards();

    //. find nexts
    this.findNext();
  }

  countBoard(){
    //. count
    this.player0_count = 0;
    this.player1_count = 0;
    for( var i = 0; i < this.board_size; i ++ ){
      for( var j = 0; j < this.board_size; j ++ ){
        if( this.board[this.board_size*i+j] == 1 ){
          this.player0_count ++;
        }else if( this.board[this.board_size*i+j] == -1 ){
          this.player1_count ++;
        }
      }
    }
  }

  changeStatus( new_status ){
    //. new_status: 0=未処理, -1=処理中, 1=処理済み
    this.process_status = new_status;
  }

  showBoard( game_end ){
    console.log( '' );
    console.log( 'parent_id = ' + this.parent_id );
    console.log( 'next_id = ' + this.next_id );
    console.log( 'next_idx = ' + this.next_idx );
    console.log( 'board_size = ' + this.board_size );
    console.log( 'depth = ' + this.depth );
    console.log( 'next_choices_num = ' + this.next_choices_num );
    console.log( 'process_status = ' + this.process_status );
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
        var c = ( this.board[this.board_size*i+j] == 0 ? '　' :
          ( this.board[this.board_size*i+j] == 1 ? '●' : '○' )
        );
        line += ( c + ' ' );
      }
      console.log( line );
    }

    /*
    for( var idx = 0; idx < this.boards.length; idx ++ ){
      console.log( '' );
      console.log( 'idx:' + idx );
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
          var c = ( this.boards[idx][this.board_size*i+j] == 0 ? '　' :
            ( this.boards[idx][this.board_size*i+j] == 1 ? '●' : '○' )
          );
          line += ( c + ' ' );
        }
        console.log( line );
      }
    }
    */
  
    console.log( '' );
    console.log( '● Player 1: ' + this.player0_count );
    console.log( '○ Player -1: ' + this.player1_count );
    console.log( 'Next : Player ' + ( this.next_player == 1 ? '1 ●' : '-1 ○' ) );

    console.log( '' );
    console.log( 'Choices:' );
    for( var i = 0; i < this.next_choices.length; i ++ ){
      console.log( ' ' + i + ' : ( ' + this.next_choices[i].x + ', ' + this.next_choices[i].y + ' )' );
    }

    if( game_end ){
      console.log( '' );

    }

    console.log( '' );
  }

  playerChoicable( x, y, p ){
    var b = false;
    var o = -1 * p;

    if( x >= 0 && x < this.board_size && y >= 0 && y < this.board_size && this.board[this.board_size*y+x] == 0 ){
      if( x > 0 ){
        if( y > 0 && this.board[this.board_size*(y-1)+(x-1)] == o ){
          var c = 2;
          var z = false;
          while( ( y - c ) >= 0 && ( x - c ) >= 0 && !z && !b ){
            if( this.board[this.board_size*(y-c)+(x-c)] == 0 ){
              z = true;
            }else if( this.board[this.board_size*(y-c)+(x-c)] == p ){
              b = true;
            }
            c ++;
          }
        }

        if( this.board[this.board_size*y+(x-1)] == o ){
          var c = 2;
          var z = false;
          while( ( x - c ) >= 0 && !z && !b ){
            if( this.board[this.board_size*y+(x-c)] == 0 ){
              z = true;
            }else if( this.board[this.board_size*y+(x-c)] == p ){
              b = true;
            }
            c ++;
          }
        }

        if( y < this.board_size - 1 && this.board[this.board_size*(y+1)+(x-1)] == o ){
          var c = 2;
          var z = false;
          while( ( y + c ) < this.board_size && ( x - c ) >= 0 && !z && !b ){
            if( this.board[this.board_size*(y+c)+(x-c)] == 0 ){
              z = true;
            }else if( this.board[this.board_size*(y+c)*(x-c)] == p ){
              b = true;
            }
            c ++;
          }
        }
      }
  
      if( y > 0 && this.board[this.board_size*(y-1)+x] == o ){
        var c = 2;
        var z = false;
        while( ( y - c ) >= 0 && !z && !b ){
          if( this.board[this.board_size*(y-c)+x] == 0 ){
            z = true;
          }else if( this.board[this.board_size*(y-c)+x] == p ){
            b = true;
          }
          c ++;
        }
      }

      if( y < this.board_size - 1 && this.board[this.board_size*(y+1)+x] == o ){
        var c = 2;
        var z = false;
        while( ( y + c ) < this.board_size && !z && !b ){
          if( this.board[this.board_size*(y+c)+x] == 0 ){
            z = true;
          }else if( this.board[this.board_size*(y+c)+x] == p ){
            b = true;
          }
          c ++;
        }
      }

      if( x < this.board_size - 1 ){
        if( y > 0 && this.board[this.board_size*(y-1)+(x+1)] == o ){
          var c = 2;
          var z = false;
          while( ( y - c ) >= 0 && ( x + c ) < this.board_size && !z && !b ){
            if( this.board[this.board_size*(y-c)+(x+c)] == 0 ){
              z = true;
            }else if( this.board[this.board_size*(y-c)+(x+c)] == p ){
              b = true;
            }
            c ++;
          }
        }

        if( this.board[this.board_size*y+(x+1)] == o ){
          var c = 2;
          var z = false;
          while( ( x + c ) < this.board_size && !z && !b ){
            if( this.board[this.board_size*y+(x+c)] == 0 ){
              z = true;
            }else if( this.board[this.board_size*y+(x+c)] == p ){
              b = true;
            }
            c ++;
          }
        }
    
        if( y < this.board_size - 1 && this.board[this.board_size*(y+1)+(x+1)] == o ){
          var c = 2;
          var z = false;
          while( ( y + c ) < this.board_size && ( x + c ) < this.board_size && !z && !b ){
            if( this.board[this.board_size*(y+c)+(x+c)] == 0 ){
              z = true;
            }else if( this.board[this.board_size*(y+c)+(x+c)] == p ){
              b = true;
            }
            c ++;
          }
        }
      }
    }

    return b;
  }

  putChoice( x, y, p ){
    var b = false;
    var o = -1 * p;

    if( y > -1 && y < this.board_size && x > -1 && x < this.board_size && this.board[this.board_size*y+x] == 0 && this.playerChoicable( x, y, p ) ){
      this.board[this.board_size*y+x] = p;

      //. ひっくり返す
      if( x > 0 ){
        if( y > 0 && this.board[this.board_size*(y-1)+(x-1)] == o ){
          var c = 2;
          var z = false;
          while( c > 1 && ( y - c ) >= 0 && ( x - c ) >= 0 && !z ){
            if( this.board[this.board_size*(y-c)+(x-c)] == 0 ){
              z = true;
            }else if( this.board[this.board_size*(y-c)+(x-c)] == p ){
              for( var i = 1; i < c; i ++ ){
                this.board[this.board_size*(y-i)*(x-i)] = p;
              }

              c = 0;
            }
            c ++;
          }
        }

        if( this.board[this.board_size*y+(x-1)] == o ){
          var c = 2;
          var z = false;
          while( c > 1 && ( x - c ) >= 0 && !z ){
            if( this.board[this.board_size*y+(x-c)] == 0 ){
              z = true;
            }else if( this.board[this.board_size*y+(x-c)] == p ){
              for( var i = 1; i < c; i ++ ){
                this.board[this.board_size*y+(x-i)] = p;
              }

              c = 0;
            }
            c ++;
          }
        }
    
        if( y < this.board_size - 1 && this.board[this.board_size*(y+1)*(x-1)] == o ){
          var c = 2;
          var z = false;
          while( c > 1 && ( y + c ) < this.board_size && ( x - c ) >= 0 && !z ){
            if( this.board[this.board_size*(y+c)+(x-c)] == 0 ){
              z = true;
            }else if( board[this.board_size*(y+c)+(x-c)] == p ){
              for( var i = 1; i < c; i ++ ){
                this.board[this.board_size*(y+i)+(x-i)] = p;
              }

              c = 0;
            }
            c ++;
          }
        }
      }

      if( y > 0 && this.board[this.board_size*(y-1)+x] == o ){
        var c = 2;
        var z = false;
        while( c > 1 && ( y - c ) >= 0  && !z){
          if( this.board[this.board_size*(y-c)+x] == 0 ){
            z = true;
          }else if( this.board[this.board_size*(y-c)+x] == p ){
            for( var i = 1; i < c; i ++ ){
              this.board[this.board_size*(y-i)+x] = p;
            }

            c = 0;
          }
          c ++;
        }
      }

      if( y < this.board_size - 1 && this.board[this.board_size*(y+1)+x] == o ){
        var c = 2;
        var z = false;
        while( c > 1 && ( y + c ) < this.board_size && !z ){
          if( this.board[this.board_size+(y+c)+x] == 0 ){
            z = true;
          }else if( this.board[this.board_size*(y+c)+x] == p ){
            for( var i = 1; i < c; i ++ ){
              this.board[this.board_size*(y+i)+x] = p;
            }

            c = 0;
          }
          c ++;
        }
      }

      if( x < this.board_size - 1 ){
        if( y > 0 && this.board[this.board_size*(y-1)+(x+1)] == o ){
          var c = 2;
          var z = false;
          while( c > 1 && ( y - c ) >= 0 && ( x + c ) < this.board_size && !z ){
            if( this.board[this.board_size*(y-c)+(x+c)] == 0 ){
              z = true;
            }else if( this.board[this.board_size*(y-c)+(x+c)] == p ){
              for( var i = 1; i < c; i ++ ){
                this.board[this.board_size*(y-i)+(x+i)] = p;
              }

              c = 0;
            }
            c ++;
          }
        }

        if( this.board[this.board_size*y+(x+1)] == o ){
          var c = 2;
          var z = false;
          while( c > 1 && ( x + c ) < this.board_size && !z ){
            if( this.board[this.board_size*y+(x+c)] == 0 ){
              z = true;
            }else if( this.board[this.board_size*y+(x+c)] == p ){
              for( var i = 1; i < c; i ++ ){
                this.board[this.board_size*y+(x+i)] = p;
              }

              c = 0;
            }
            c ++;
          }
        }
    
        if( y < this.board_size - 1 && this.board[this.board_size*(y+1)+(x+1)] == o ){
          var c = 2;
          var z = false;
          while( c > 1 && ( y + c ) < this.board_size && ( x + c ) < this.board_size && !z ){
            if( this.board[this.board_size*(y+c)+(x+c)] == 0 ){
              z = true;
            }else if( this.board[this.board_size*(y+c)+(x+c)] == p ){
              for( var i = 1; i < c; i ++ ){
                this.board[this.board_size*(y+i)+(x+i)] = p;
              }

              c = 0;
            }
            c ++;
          }
        }
      }

      this.parent_id = this.id;
      this.id = 'xxx';

      this.depth ++;

      //. cound
      this.countBoard();
      
      //. boards
      this.calcBoards();
      
      //. find
      this.next_player *= -1;
      this.findNext();

      //. nexts
      this.checkNext();
    }

    if( b ){
      var r = new reversi( this.id + 'x', this.id, null, null, this.board_size, this.board, this.boards, this.next_player );
      return r;
    }else{
      return this;
    }
  }

  calcBoards(){
    var l = this.board_size * this.board_size;
    this.boards = [ this.board ];
    for( var idx = 1; idx < 12; idx ++ ){
      var b = new Array( l );

      //. 0: そのまま, 1: 右90度回転, 2: 180度回転, 3: 右270度回転, 4: 左右反転, 5: 4を右90度回転, 6: 4を180度回転, 7: 4を右270度回転, 8: 上下反転, 9: 8を右90度回転, 10: 8を180度回転, 11: 8を右270度回転
      switch( idx ){
      case 1:
      case 2:
      case 3:
      case 5:
      case 6:
      case 7:
      case 9:
      case 10:
      case 11:
        //. １つ前の状態を右90度回転
        var a = this.boards[idx-1];
        for( var i = 0; i < this.board_size; i ++ ){
          for( var j = 0; j < this.board_size; j ++ ){
            b[this.board_size*i+j] = a[this.board_size*(this.board_size-1-j)+i];
          }
        }
        this.boards.push( b );
        break;
      case 4:
        //. 左右反転
        var a = this.boards[0];
        for( var i = 0; i < this.board_size; i ++ ){
          for( var j = 0; j < this.board_size; j ++ ){
            b[this.board_size*i+j] = a[this.board_size*i+(this.board_size-1-j)];
          }
        }
        this.boards.push( b );
        break;
      case 8:
        //. 上下反転
        var a = this.boards[0];
        for( var i = 0; i < this.board_size; i ++ ){
          for( var j = 0; j < this.board_size; j ++ ){
            b[this.board_size*i+j] = a[this.board_size*(this.board_size-1-i)+j];
          }
        }
        this.boards.push( b );
        break;
      }
    }
  }

  findNext(){
    this.next_choices = [];
    for( var i = 0; i < this.board_size; i ++ ){    //. i = y
      for( var j = 0; j < this.board_size; j ++ ){  //. j = x
        if( this.board[this.board_size*i+j] == 0 && this.playerChoicable( j, i, this.next_player ) ){
          this.next_choices.push( { x:j, y:i } );
        }
      }
    }
    this.next_choices_num = this.next_choices.length;
  }

  checkNext(){
    if( this.next_choices_num == 0 ){
      //. 次の手で相手はパスしかない
      this.next_player *= -1;
      this.findNext();
      this.next_choices_num = this.next_choices.length;

      if( this.next_choices_num == 0 ){
        //. 次の手は自分もパスしかない = ゲーム終了
        this.next_player = 0;
        this.process_status = 1;
        this.showBoard( true );
      }
    }else{
      //this.next_player = other_player;
    }
  }
};


if( typeof module === 'object' ){
  module.exports = reversi;
}
