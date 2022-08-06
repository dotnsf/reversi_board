# Reversi Board


## Overview

「リバーシ」の全件探索を分散コンピューティングで実現することを目的としたパッケージ


## Usage

### Server

- CLI: 

  - `$ node app`

- Environment values

  - `DATABASE_URL` : URL of PostgreSQL

  - `CORS` : URL which is allowed to access to REST API via CORS. (Default:'');

  - `BOARD_SIZE` : Size of game board. (Default:4)


### Client bot

- CLI: 

  - `$ node bot`

- Environment values

  - `BOARD_SIZE` : Size of game board. (Default:4)

  - `BASE_URL` : Base URL of above server. (Default:http://localhost:8080)


### Analytics client

- CLI: 

  - `$ node analytics`

- Environment values

  - `DATABASE_URL` : URL of PostgreSQL

  - `BOARD_SIZE` : Size of game board. (Default:4)


## Order

1. Create table:

  - `=> \i reversi.ddl`

2. Run bot:

  - `$ node bot`

3. Run SQL which set values:

  - `update reversi set value = ( player0_count - player1_count ) where next_choices_num = 0`

4. Backup DB as `before analytics`:

  - `# pg_dump "postgres://postgres:passworrd@xxxx:5432/db" -f yyyymmdd_reversi_before_analytics.dump`

  - `# pg_dump "postgres://postgres:passworrd@xxxx:5432/db" -Fc -f yyyymmdd_reversi_before_analytics-Fc.dump`

5. Run analytics:

  - `$ node analytics`

6. Backup DB as `after analytics`:

  - `# pg_dump "postgres://postgres:passworrd@xxxx:5432/db" -f yyyymmdd_reversi_after_analytics.dump`

7. If needed, you can restore DB with following command:

  - `# psql "postgres://postgres:passworrd@xxxx:5432/db" -f yyyymmdd_reversi.dump`


## Check

We should check if result of this SQL would be always **0**:

  `select count(*) from reversi where ( depth + 4 < player0_count + player1_count ) or ( depth + next_choices_num > ( board_size * board_size - 4 ) );`


## Dockerize

- app

  - build image

    - `$ docker build -t dotnsf/reversi-app -f Dockerfile.app`

  - run as container

    - `$ docker run --name reversi-app -d -p 8080:8080 dotnsf/reversi-app`

- bot

  - build image

    - `$ docker build -t dotnsf/reversi-bot -f Dockerfile.bot`

  - run as container

    - `$ docker run -it -e BOARD_SIZE=6 -e BASE_URL=http://localhost:8080 dotnsf/reversi-bot`


## Licensing

This code is licensed under MIT.


## Copyright

2020-2022  [K.Kimura @ Juge.Me](https://github.com/dotnsf) all rights reserved.
