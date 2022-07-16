# Reversi Board


## Overview

「リバーシ」の全件探索を分散コンピューティングで実現することを目的としたパッケージ


## 現時点での問題点

- [x] 初手を後手(-1)が、後手には指せない場所に指している。２手目を先手(1)が指すことになっていて、**矛盾が起きている**。

  - つまりコンストラクターに渡す player 値が逆になっている？

- [ ] updateProcess 後にレコードの created や updated が文字列になる

  - ↑実質的な問題ではないので優先度は低いが、`( new Date() ).getTime()` で取得した値で更新しているはずなのに・・・

  - 最初の startProcess 直後の時点でも既に文字列になっている？

  - よくよく考えると DB は型指定されているのだから、取り出した後の問題だと思う

- [ ] 親レコードを一度 updateProcess すると next_status = [ 1, 0, 0, 0 ] になる（ここまではよい）が、更にもう一度 updateProcess すると next_status = [ 0, 1, 0, 0 ] になってしまう（ [ 1, 1, 0, 0 ] になるべき）。


## Licensing

This code is licensed under MIT.


## Copyright

2020-2022  [K.Kimura @ Juge.Me](https://github.com/dotnsf) all rights reserved.
