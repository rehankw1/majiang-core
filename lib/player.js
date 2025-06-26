/*
 *  Majiang.Player
 */
"use strict";

const Majiang = {
    Shoupai: require('./shoupai'),
    He:      require('./he'),
    Game:    require('./game'),
    Board:   require('./board'),
    Util:    Object.assign(require('./xiangting'), require('./hule'))
};

/**
 * 表示麻将玩家的类。
 */
module.exports = class Player {
    /**
     * 创建一个玩家实例。
     */
    constructor() {
        this._model = new Majiang.Board();
    }

    /**
     * 处理玩家的动作消息。
     * @param {Object} msg - 动作消息。
     * @param {Function} callback - 回调函数。
     */
    action(msg, callback) {
        this._callback = callback;

        if      (msg.kaiju)    this.kaiju  (msg.kaiju);
        else if (msg.qipai)    this.qipai  (msg.qipai);
        else if (msg.zimo)     this.zimo   (msg.zimo);
        else if (msg.dapai)    this.dapai  (msg.dapai);
        else if (msg.fulou)    this.fulou  (msg.fulou);
        else if (msg.gang)     this.gang   (msg.gang);
        else if (msg.gangzimo) this.zimo   (msg.gangzimo, true)
        else if (msg.kaigang)  this.kaigang(msg.kaigang);
        else if (msg.hule)     this.hule   (msg.hule);
        else if (msg.pingju)   this.pingju (msg.pingju);
        else if (msg.jieju)    this.jieju  (msg.jieju);
    }

    /**
     * 获取玩家的手牌。
     * @return {Object} 玩家手牌。
     */
    get shoupai() { return this._model.shoupai[this._menfeng] }

    /**
     * 获取玩家的河牌。
     * @return {Object} 玩家河牌。
     */
    get he()      { return this._model.he[this._menfeng]      }

    /**
     * 获取山牌。
     * @return {Object} 山牌。
     */
    get shan()    { return this._model.shan                   }

    /**
     * 获取和牌的牌。
     * @return {Array} 和牌的牌。
     */
    get hulepai() {
        return Majiang.Util.xiangting(this.shoupai) == 0 && Majiang.Util.tingpai(this.shoupai) || [];
    }

    /**
     * 获取游戏模型。
     * @return {Object} 游戏模型。
     */
    get model()    { return this._model  }

    /**
     * 设置游戏视图。
     * @param {Object} view - 游戏视图。
     */
    set view(view) { this._view = view   }

    /**
     * 处理开局消息。
     * @param {Object} kaiju - 开局消息。
     */
    kaiju(kaiju) {
        console.log('Player.kaiju', kaiju);
        this._id   = kaiju.id;
        this._rule = kaiju.rule;
        this._model.kaiju(kaiju);
        if (this._view) this._view.kaiju(kaiju.id);

        if (this._callback) this.action_kaiju(kaiju);
    }

    /**
     * 处理起牌消息。
     * @param {Object} qipai - 起牌消息。
     */
    qipai(qipai) {
        console.log('Player.qipai', qipai);
        this._model.qipai(qipai);
        this._menfeng   = this._model.menfeng(this._id);
        this._diyizimo  = true;
        this._n_gang    = 0;
        this._neng_rong = true;
        if (this._view) this._view.redraw();

        if (this._callback) this.action_qipai(qipai);
    }

    /**
     * 处理自摸消息。
     * @param {Object} zimo - 自摸消息。
     * @param {boolean} gangzimo - 是否为杠后自摸。
     */
    zimo(zimo, gangzimo) {
        console.log('Player.zimo', zimo, gangzimo);
        this._model.zimo(zimo);
        if (gangzimo) this._n_gang++;
        if (this._view) {
            if (gangzimo) this._view.update({ gangzimo: zimo });
            else          this._view.update({ zimo: zimo });
        }

        if (this._callback) this.action_zimo(zimo, gangzimo);
    }

    /**
     * 处理打牌消息。
     * @param {Object} dapai - 打牌消息。
     */
    dapai(dapai) {
        console.log('Player.dapai', dapai);
        if (dapai.l == this._menfeng) {
            if (! this.shoupai.lizhi) this._neng_rong = true;
        }

        this._model.dapai(dapai);
        if (this._view) this._view.update({ dapai: dapai });

        if (this._callback) this.action_dapai(dapai);

        if (dapai.l == this._menfeng) {
            this._diyizimo = false;
            if (this.hulepai.find(p=> this.he.find(p))) this._neng_rong = false;
        }
        else {
            let s = dapai.p[0], n = +dapai.p[1]||5;
            if (this.hulepai.find(p=> p == s+n)) this._neng_rong = false;
        }
    }

    /**
     * 处理副露消息。
     * @param {Object} fulou - 副露消息。
     */
    fulou(fulou) {
        console.log('Player.fulou', fulou);
        this._model.fulou(fulou);
        if (this._view) this._view.update({ fulou: fulou });

        if (this._callback) this.action_fulou(fulou);

        this._diyizimo = false;
    }

    /**
     * 处理杠牌消息。
     * @param {Object} gang - 杠牌消息。
     */
    gang(gang) {
        console.log('Player.gang', gang);
        this._model.gang(gang);
        if (this._view) this._view.update({ gang: gang });

        if (this._callback) this.action_gang(gang);

        this._diyizimo = false;
        if (gang.l != this._menfeng && ! gang.m.match(/^[mpsz]\d{4}$/)) {
            let s = gang.m[0], n = +gang.m.slice(-1)||5;
            if (this.hulepai.find(p=> p == s+n)) this._neng_rong = false;
        }
    }

    /**
     * 处理开杠消息。
     * @param {Object} kaigang - 开杠消息。
     */
    kaigang(kaigang) {
        console.log('Player.kaigang', kaigang);
        this._model.kaigang(kaigang);
        if (this._view) this._view.update({ kaigang: kaigang });
    }

    /**
     * 处理和牌消息。
     * @param {Object} hule - 和牌消息。
     */
    hule(hule) {
        console.log('Player.hule', hule);
        this._model.hule(hule);
        if (this._view) this._view.update({ hule: hule });
        if (this._callback) this.action_hule(hule);
    }

    /**
     * 处理平局消息。
     * @param {Object} pingju - 平局消息。
     */
    pingju(pingju) {
        console.log('Player.pingju', pingju);
        this._model.pingju(pingju);
        if (this._view) this._view.update({ pingju: pingju });
        if (this._callback) this.action_pingju(pingju);
    }

    /**
     * 处理结束消息。
     * @param {Object} paipu - 牌谱。
     */
    jieju(paipu) {
        console.log('Player.jieju', paipu);
        this._model.jieju(paipu);
        this._paipu = paipu;
        if (this._view) this._view.summary(paipu);
        if (this._callback) this.action_jieju(paipu);
    }

    /**
     * 获取可能的打牌。
     * @param {Object} shoupai - 手牌。
     * @return {Array} 可能的打牌。
     */
    get_dapai(shoupai) {
        return Majiang.Game.get_dapai(this._rule, shoupai);
    }

    /**
     * 获取可能的吃牌面子。
     * @param {Object} shoupai - 手牌。
     * @param {string} p - 吃的牌。
     * @return {Array} 可能的吃牌面子。
     */
    get_chi_mianzi(shoupai, p) {
        return Majiang.Game.get_chi_mianzi(this._rule, shoupai, p, this.shan.paishu);
    }

    /**
     * 获取可能的碰牌面子。
     * @param {Object} shoupai - 手牌。
     * @param {string} p - 碰的牌。
     * @return {Array} 可能的碰牌面子。
     */
    get_peng_mianzi(shoupai, p) {
        return Majiang.Game.get_peng_mianzi(this._rule, shoupai, p, this.shan.paishu);
    }

    /**
     * 获取可能的杠牌面子。
     * @param {Object} shoupai - 手牌。
     * @param {string} p - 杠的牌。
     * @return {Array} 可能的杠牌面子。
     */
    get_gang_mianzi(shoupai, p) {
        return Majiang.Game.get_gang_mianzi(this._rule, shoupai, p, this.shan.paishu, this._n_gang);
    }

    /**
     * 检查玩家是否可以立直。
     * @param {Object} shoupai - 手牌。
     * @param {string} p - 打出的牌。
     * @return {boolean} 如果玩家可以立直则返回true，否则返回false。
     */
    allow_lizhi(shoupai, p) {
        return Majiang.Game.allow_lizhi(this._rule, shoupai, p, this.shan.paishu, this._model.defen[this._id]);
    }

    /**
     * 检查玩家是否可以和牌。
     * @param {Object} shoupai - 手牌。
     * @param {string} p - 和的牌。
     * @param {boolean} hupai - 是否已经立直。
     * @return {boolean} 如果玩家可以和牌则返回true，否则返回false。
     */
    allow_hule(shoupai, p, hupai) {
        hupai = hupai || shoupai.lizhi || this.shan.paishu == 0;
        return Majiang.Game.allow_hule(this._rule, shoupai, p, this._model.zhuangfeng, this._menfeng,
                                       hupai, this._neng_rong);
    }

    /**
     * 检查玩家是否可以平局。
     * @param {Object} shoupai - 手牌。
     * @return {boolean} 如果玩家可以平局则返回true，否则返回false。
     */
    allow_pingju(shoupai) {
        return Majiang.Game.allow_pingju(this._rule, shoupai, this._diyizimo);
    }

    /**
     * 检查玩家是否可以宣告无听。
     * @param {Object} shoupai - 手牌。
     * @return {boolean} 如果玩家可以宣告无听则返回true，否则返回false。
     */
    allow_no_daopai(shoupai) {
        return Majiang.Game.allow_no_daopai(this._rule, shoupai, this.shan.paishu);
    }
}
