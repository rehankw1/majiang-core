/*
 *  Majiang.Game
 */
"use strict";

const Majiang = {
    Game:    require('./game'),
    rule:    require('./rule'),
    Shoupai: require('./shoupai'),
    Shan:    require('./shan'),
    He:      require('./he'),
    Util:    Object.assign(require('./xiangting'), require('./hule'))
};

/**
 * 三麻のゲーム進行を管理するクラス。
 */
class SanmaGame extends Majiang.Game {
    constructor(players, callback, rule, title) {
        super(players, callback, rule, title);
        this.sanma = true;
        this._model.fang = 3;
        this._model.player = ['私', '下家', '上家'];
        this._model.defen = [0, 0, 0].map(x => this._rule['配給原点']);
        this._model.player_id = [0, 1, 2];
    }

    // Override methods if necessary to handle three-player logic
}

module.exports = SanmaGame;
