/*
 *  Majiang.Shan
 */
"use strict";

const Majiang = { Shoupai: require('./shoupai') };

/**
 * 表示麻将山牌的类。
 */
module.exports = class Shan {
    /**
     * 获取真正的宝牌。
     * @param {string} p - 宝牌。
     * @return {string} 真正的宝牌。
     * @throws {Error} 如果牌无效则抛出错误。
     */
    static zhenbaopai(p) {
        if (! Majiang.Shoupai.valid_pai(p)) throw new Error(p);
        let s = p[0], n = + p[1] || 5;
        return s == 'z' ? (n < 5  ? s + (n % 4 + 1) : s + ((n - 4) % 3 + 5)) : s + (n % 9 + 1);
    }

    /**
     * 创建一个山牌实例。
     * @param {Object} rule - 游戏规则。
     */
    constructor(rule) {
        console.log('Shan.constructor', rule);
        this._rule = rule; // 游戏规则对象，其中包含了赤牌的配置
        /**
         * 在日本麻将中，赤牌（赤ドラ，Aka Dora）是一种特殊的红色牌，它们被用作额外的宝牌（ドラ），可以增加玩家的得分
         * 赤牌通常是每种花色的5，具体来说是5万、5筒和5索。这些牌在牌面上会有红色的标记，以区别于普通的牌。
         */
        const sanma = rule['mode'] == 'sanma'; // 从规则中获取游戏模式
        const hongpai = rule['赤牌']; // 从规则中获取赤牌的配置
        const pai = sanma ? ['m1','m1','m1','m1','m9','m9','m9','m9'] : []; // 如果是三麻，则将万的1和9作为初始牌
        for (let s of sanma ? ['p','s','z'] : ['m', 'p','s','z']) { // 遍历所有的花色（万、筒、索、字）
            for (let n = 1; n <= (s == 'z' ? 7 : 9); n++) { // 遍历每种花色的所有牌（字牌有7种，其他有9种）
                for (let i = 0; i < 4; i++) { // 每种牌有4张
                    if (n == 5 && i < hongpai[s]) pai.push(s+0); // 如果是5，并且在赤牌配置范围内，则将其作为赤牌（用0表示）
                    else                          pai.push(s+n); // 否则，作为普通牌
                }
            }
        }

        this._pai = [];
        while (pai.length) {
            this._pai.push(pai.splice(Math.random()*pai.length, 1)[0]);
        }

        /**
         * 宝牌数组
         * @type {Array<string>}
         */
        this._baopai     = [this._pai[4]];

        /**
         * 副宝牌数组
         * @type {Array<string>|null}
         */
        this._fubaopai   = rule['裏ドラあり'] ? [this._pai[9]] : null;

        /**
         * 是否未开杠
         * @type {boolean}
         */
        this._weikaigang = false;

        /**
         * 是否已关闭
         * @type {boolean}
         */
        this._closed     = false;

        /**
         * @type {Array<string>}
         */
        this._nukidora = [];
    }

    /**
     * 自摸。
     * @return {string} 自摸的牌。
     * @throws {Error} 如果山牌已关闭或牌数为0或未开杠则抛出错误。
     */
    zimo() {
        if (this._closed)     throw new Error(this);
        if (this.paishu == 0) throw new Error(this);
        if (this._weikaigang) throw new Error(this);
        return this._pai.pop();
    }

    /**
     * 杠后自摸。
     * @return {string} 杠后自摸的牌。
     * @throws {Error} 如果山牌已关闭或牌数为0或未开杠或宝牌数为5则抛出错误。
     */
    gangzimo() {
        if (this._closed)             throw new Error(this);
        if (this.paishu == 0)         throw new Error(this);
        if (this._weikaigang)         throw new Error(this);
        if (this._baopai.length == 5) throw new Error(this);
        this._weikaigang = this._rule['カンドラあり'];
        if (! this._weikaigang) this._baopai.push('');
        return this._pai.shift();
    }

    /**
     * 开杠。
     * @return {Shan} 山牌实例。
     * @throws {Error} 如果山牌已关闭或未开杠则抛出错误。
     */
    kaigang() {
        if (this._closed)                 throw new Error(this);
        if (! this._weikaigang)           throw new Error(this);
        this._baopai.push(this._pai[4]);
        if (this._fubaopai && this._rule['カン裏あり'])
            this._fubaopai.push(this._pai[9]);
        this._weikaigang = false;
        return this;
    }

    /**
     * 关闭山牌。
     * @return {Shan} 山牌实例。
     */
    close() { this._closed = true; return this }

    /**
     * 获取剩余牌数。
     * @return {number} 剩余牌数。
     */
    get paishu() { return this._pai.length - 14 }

    /**
     * 获取宝牌数组。
     * @return {Array<string>} 宝牌数组。
     */
    get baopai() { return this._baopai.filter(x=>x) }

    /**
     * 获取副宝牌数组。
     * @return {Array<string>|null} 副宝牌数组。
     */
    get fubaopai() {
        return ! this._closed ? null
             : this._fubaopai ? this._fubaopai.concat()
             :                  null;
    }

    /**
     * 获取抜きドラ数组。
     * @return {Array<string>} 抜きドラ数组。
     */
    get nukidora() {
        return this._nukidora.concat();
    }

    /**
     * 添加抜きドラ。
     * @param {string} pai - 抜きドラ牌。
     * @return {Shan} 山牌实例。
     */
    addNukidora(pai) {
        if (this._rule['mode'] === 'sanma' && pai === 'z4') {
            this._nukidora.push(pai);
        }
        return this;
    }
}
