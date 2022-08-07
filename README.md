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

  - `PGSSLMODE` : SSL connection mode for PostgreSQL. (Default:'no-verify', specify 'disable' for PosgreSQL docker container)


### Client bot

- CLI: 

  - `$ node bot`

- Environment values

  - `BOARD_SIZE` : Size of game board. (Default:4)

  - `BASE_URL` : Base URL of above server. (Default:http://localhost:8080)


<!--
### Analytics client

- CLI: 

  - `$ node analytics`

- Environment values

  - `DATABASE_URL` : URL of PostgreSQL

  - `BOARD_SIZE` : Size of game board. (Default:4)
-->


## Order

1. Create table:

  - `=> \i reversi.ddl`

2. Run app:

  - `$ DATABASE_URL=postgres://localhost:5432/db BOARD_SIZE=4 node app`

3. Run bot:

  - `$ BASE_URL=http://localhost:8080 BOARD_SIZE=4 node bot`

4. Backup DB:

  - `# pg_dump "postgres://postgres:passworrd@xxxx:5432/db" -f yyyymmdd_reversi.dump`

  - `# pg_dump "postgres://postgres:passworrd@xxxx:5432/db" -Fc -f yyyymmdd_reversi-Fc.dump`

7. If needed, you can restore DB with following command:

  - `# psql "postgres://postgres:passworrd@xxxx:5432/db" -f yyyymmdd_reversi.dump`


## Check

We should check if result of this SQL would be always **0**:

  `select count(*) from reversi where ( depth + 4 < player0_count + player1_count ) or ( depth + next_choices_num > ( board_size * board_size - 4 ) );`


## Containerize in docker

- network(optional)

  - create network

    - `$ docker network create reversi-network`

- app

  - build image

    - `$ docker build -t dotnsf/reversi-app -f Dockerfile.app .`

  - run as container

    - `$ docker run --name reversi-app --network reversi-network -d -p 8080:8080 -e BOARD_SIZE=4 -e DATABASE_URL=postgres://localhost:5432/db dotnsf/reversi-app`

- bot

  - build image

    - `$ docker build -t dotnsf/reversi-bot -f Dockerfile.bot .`

  - run as container

    - `$ docker run --network reversi-network -e BOARD_SIZE=4 -e BASE_URL=http://reversi-app:8080 dotnsf/reversi-bot`


## Containerize in k8s

- app

  - Edit `revesi-app.yaml` with your `DATABASE_URL` and `BOARD_SIZE`.

  - `$ kubectl apply -f reversi-app.yaml`

- bot

  - Edit `revesi-bot.yaml` with your `BASE_URL` and `BOARD_SIZE`.

  - `$ kubectl apply -f reversi-bot.yaml`

  - `$ kubectl scale --replicas=3 -f reversi-bot.yaml`


## Licensing

This code is licensed under MIT.


## Copyright

2020-2022  [K.Kimura @ Juge.Me](https://github.com/dotnsf) all rights reserved.
