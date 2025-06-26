/*
 *  Majiang.He
 */
"use strict";

const Majiang = { Shoupai: require('./shoupai') };

/**
 * 表示麻将河牌的类。
 * 河牌是指已经打出的牌。
 */
module.exports = class He {
    /**
     * 创建一个河牌实例。
     */
    constructor() {
        /**
         * 一个数组，用于存储打出的牌。
         */
        this._pai  = [];
        /**
         * 一个对象，用于快速查找特定的牌是否已经被打出。
         */
        this._find = {};
    }

    /**
     * 打牌。
     * @param {string} p - 打出的牌。
     * @return {He} 河牌实例。
     * @throws {Error} 如果牌无效则抛出错误。
     */
    dapai(p) {
        // 检查牌的有效性，如果无效则抛出错误
        if (!Majiang.Shoupai.valid_pai(p)) throw new Error(p);
        // 将牌添加到 _pai 数组中，并更新 _find 对象以记录这张牌
        this._pai.push(p.replace(/[\+\=\-]$/,''));
        this._find[p[0]+(+p[1]||5)] = true;
        return this;
    }

    /**
     * 副露。
     * 在麻将游戏中，副露（ふうろ，Fūro）是指玩家通过吃、碰、杠等操作将其他玩家打出的牌或自己摸到的牌公开，并将其加入自己的手牌中。副露的面子（面子，Mianzi）是指通过这些操作形成的牌组。
     * 副露的类型
     * 吃（Chi）：只能吃上家的牌，组成顺子。例如，手中有 3万 和 4万，上家打出 2万，可以吃牌组成 2万-3万-4万。
     * 碰（Pon）：可以碰任何玩家的牌，组成刻子（三张相同的牌）。例如，手中有两个 5筒，任何玩家打出 5筒，可以碰牌组成 5筒-5筒-5筒。
     * 杠（Kan）：可以杠任何玩家的牌，组成杠子（四张相同的牌）。杠牌有三种形式：
     * 明杠：手中有三个相同的牌，其他玩家打出第四张时进行杠牌。
     * 暗杠：手中有四个相同的牌，自己摸到第四张时进行杠牌。
     * 加杠：碰牌后，自己摸到第四张相同的牌时进行杠牌。
     * @param {string} m - 副露的面子（吃、碰、杠）
     * @return {He} 河牌实例。
     * @throws {Error} 如果面子无效则抛出错误。
     */
    fulou(m) {
        // 检查面子的有效性，如果无效则抛出错误
        if (!Majiang.Shoupai.valid_mianzi(m)) throw new Error(m);
        // 更新 _pai 数组中的最后一张牌，添加副露标记
        let p = m[0] + m.match(/\d(?=[\+\=\-])/), d = m.match(/[\+\=\-]/); // 提取面子中的牌和副露标记
        if (!d) throw new Error(m); // 如果没有找到副露标记，则抛出错误
        if (this._pai[this._pai.length - 1].slice(0,2) != p) throw new Error(m); // 检查最后一张牌是否与面子匹配，如果不匹配则抛出错误
        this._pai[this._pai.length - 1] += d; // 更新 _pai 数组中的最后一张牌，添加副露标记
        return this;
    }

    /**
     * 查找牌。
     * @param {string} p - 要查找的牌。
     * @return {boolean} 如果找到则返回true，否则返回false。
     */
    find(p) {
        return this._find[p[0]+(+p[1]||5)];
    }
}