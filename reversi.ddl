/* reversi.ddl */

/* reversi */
drop table reversi;
create table if not exists reversi ( id bigserial not null primary key, parent_id bigint default -1, next_id bigint default -1, next_idx int default -1, board_size int default -1, depth int default -1, choice_idx int default -1, board text default '', boards text default '', next_choices text default '', next_choices_num int default -1, process_status int default 0, player0_count int default -1, player1_count int default -1, next_player int default 0, value int default 0, value_status int default 0, created bigint default 0, updated bigint default 0 );
create index on reversi ( board_size, next_choices_num, process_status, updated );
alter table reversi add unique( parent_id, board, next_player );
