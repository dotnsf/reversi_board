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



## 現時点での問題点



## Licensing

This code is licensed under MIT.


## Copyright

2020-2022  [K.Kimura @ Juge.Me](https://github.com/dotnsf) all rights reserved.
