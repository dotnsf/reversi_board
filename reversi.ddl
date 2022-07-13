/* reversi.ddl */

/* reversi */
drop table reversi;
create table if not exists reversi ( id varchar(50) not null primary key, parent_id varchar(50), size int default -1, depth int default -1, choice_idx int default -1, choice_x int default -1, choice_y int default -1, board text default '', next_choices text default '', next_status text default '', next_choices_num int default -1, next_processed_num int default -1, player0_count int default -1, player1_count int default -1, next_player int default 0, created bigint default 0, updated bigint default 0 );
