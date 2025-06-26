/*
 *  Majiang.Board
 */
"use strict";

const Majiang = {
    Shoupai: require('./shoupai'),
    He: require('./he')
};

/**
 * 牌山
 * @param {Array} baopai 宝牌
 */
class Shan {
    get paishu() {
        console.log('board.Shan.paishu', this._paishu);
        return this._paishu;
    }
    constructor(baopai, fang = 4) {
        console.log('board.Shan.constructor', baopai);
        /**
         * 开局剩余牌数
         */
        this._paishu = (fang == 3 ? 108 : 136)  - 13 * fang - 14;
        /**
         * 宝牌
         */
        this.baopai = [].concat(baopai || []);
        /**
         * 副宝牌
         */
        this.fubaopai;
    }

    /**
     * 摸牌
     * @param {*} p 
     * @returns 摸到的牌
     */
    zimo(p) {
        console.log('board.Shan.zimo', p, this._paishu);
        this._paishu--;
        return p || '_';
    }

    /**
     * 开杠
     * @param {*} baopai 
     */
    kaigang(baopai) {
        console.log('board.Shan.kaigang', baopai);
        this.baopai.push(baopai);
    }
}

/**
 * 牌局
 * @param {*} kaiju
 */
module.exports = class Board {
    constructor(kaiju) {
        console.log('Board.constructor', kaiju);
        if (kaiju) this.kaiju(kaiju);
    }

    /**
     * 开局
     * @param {*} kaiju 
     */
    kaiju(kaiju) {
        console.log('Board.kaiju', kaiju);
        /**
         * 标题
         */
        this.title = kaiju.title;
        /**
         * 玩家
         */
        this.player = kaiju.player;
        /**
         * 起家
         */
        this.qijia = kaiju.qijia;
        /**
         * 模式
         */
        this.mode = kaiju.rule['mode'];
        /**
         * 规则
         */
        this.rule = kaiju.rule;
        /**
         * 方位
         */
        this.fang = this.mode == 'sanma' ? 3 : 4;

        /**
         * 庄家
         */
        this.zhuangfeng = 0;
        /**
         * 局数
         */
        this.jushu = 0;
        /**
         * 本场数
         */
        this.changbang = 0;
        /**
         * 本局立直棒数
         */
        this.lizhibang = 0;
        /**
         * 玩家得分
         */
        this.defen = [];

        /**
         * 牌山
         */
        this.shan = null;
        /**
         * 手牌
         */
        this.shoupai = [];
        /**
         * 河牌
         */
        this.he = [];
        /**
         * 玩家ID
         */
        this.player_id = (this.mode == 'sanma' ? [0, 1, 2] : [0, 1, 2, 3]);
        /**
         * 轮番
         */
        this.lunban = -1;

        /**
         * 立直状态
         */
        this._lizhi;
        /**
         * 分配
         */
        this._fenpei;
        /**
         * 连庄
         */
        this._lianzhuang;
        /**
         * 本场数
         */
        this._changbang;
        /**
         * 本局立直棒数
         */
        this._lizhibang;
    }

    /**
     * 玩家ID转换为门风
     * @param {*} id 玩家ID
     * @returns 门风
     */
    menfeng(id) {
        return (id + this.fang - this.qijia + this.fang - this.jushu) % this.fang;
    }

    /**
     * 开局
     * @param {*} qipai 起牌参数
     */
    qipai(qipai) {
        console.log('Board.qipai', qipai);
        this.zhuangfeng = qipai.zhuangfeng;
        this.jushu = qipai.jushu;
        this.changbang = qipai.changbang;
        this.lizhibang = qipai.lizhibang;
        this.shan = new Shan(qipai.baopai, this.fang);
        for (let l = 0; l < this.fang; l++) {
            let paistr = qipai.shoupai[l] || '_'.repeat(13);
            this.shoupai[l] = Majiang.Shoupai.fromString(paistr);
            this.he[l] = new Majiang.He();
            this.player_id[l] = (this.qijia + this.jushu + l) % this.fang;
            this.defen[this.player_id[l]] = qipai.defen[l];
        }
        this.lunban = -1;

        this._lizhi = false;
        this._fenpei = null;
        this._changbang = qipai.changbang;
        this._lizhibang = qipai.lizhibang;
    }

    /**
     * 开启立直，扣除1000点
     */
    lizhi() {
        if (this._lizhi) {
            this.defen[this.player_id[this.lunban]] -= 1000; // 扣除当前玩家的1000点
            this.lizhibang++; // 立直棒数加1
            this._lizhi = false; // 立直标志设为false
        }
    }

    /**
     * 摸牌
     * @param {*} zimo 
     */
    zimo(zimo) {
        this.lizhi();
        this.lunban = zimo.l;
        this.shoupai[zimo.l].zimo(this.shan.zimo(zimo.p), false);
    }

    /**
     * 打牌
     * @param {*} dapai 
     */
    dapai(dapai) {
        this.lunban = dapai.l;
        this.shoupai[dapai.l].dapai(dapai.p, false);
        this.he[dapai.l].dapai(dapai.p);
        this._lizhi = dapai.p.slice(-1) == '*';
    }

    /**
     * 吃牌、碰牌
     * @param {*} fulou 
     */
    fulou(fulou) {
        this.lizhi();
        this.he[this.lunban].fulou(fulou.m);
        this.lunban = fulou.l;
        this.shoupai[fulou.l].fulou(fulou.m, false);
    }

    /**
     * 杠牌，包括明杠、暗杠
     * @param {*} gang 
     */
    gang(gang) {
        this.lunban = gang.l;
        this.shoupai[gang.l].gang(gang.m, false);
    }

    /**
     * 补杠，补杠是指玩家在碰牌之后，再摸到一张相同的牌进行杠牌
     * @param {*} kaigang 
     */
    kaigang(kaigang) {
        // 调用牌山的 kaigang 方法，增加宝牌。
        this.shan.kaigang(kaigang.baopai);
    }

    /**
     * 和牌
     * @param {*} hule 
     */
    hule(hule) {
        let shoupai = this.shoupai[hule.l];
        shoupai.fromString(hule.shoupai);
        if (hule.baojia != null) shoupai.dapai(shoupai.get_dapai().pop());
        if (this._fenpei) {
            this.changbang = 0;
            this.lizhibang = 0;
            for (let l = 0; l < this.fang; l++) {
                this.defen[this.player_id[l]] += this._fenpei[l];
            }
        }
        this.shan.fubaopai = hule.fubaopai;
        this._fenpei = hule.fenpei;
        this._lizhibang = 0;
        if (hule.l == 0) this._lianzhuang = true;
    }

    /**
     * 流局
     * @param {*} pingju 
     */
    pingju(pingju) {
        if (!pingju.name.match(/^三家和/)) this.lizhi();
        for (let l = 0; l < this.fang; l++) {
            if (pingju.shoupai[l])
                this.shoupai[l].fromString(pingju.shoupai[l]);
        }
        this._fenpei = pingju.fenpei;
        this._lizhibang = this.lizhibang;
        this._lianzhuang = true;
    }

    /**
     * 处理最后一局的结算，计算得分，清空立直状态，清空分配
     * @returns 
     */
    last() {
        if (!this._fenpei) return;
        this.changbang = this._lianzhuang ? this._changbang + 1 : 0;
        this.lizhibang = this._lizhibang;
        for (let l = 0; l < this.fang; l++) {
            this.defen[this.player_id[l]] += this._fenpei[l];
        }
    }

    /**
     * 游戏结束
     * @param {*} paipu 
     */
    jieju(paipu) {
        for (let id = 0; id < this.fang; id++) {
            this.defen[id] = paipu.defen[id];
        }
        this.lunban = -1;
    }
}
