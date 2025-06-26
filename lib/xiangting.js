/*
 *  Majiang.Util.xiangting
 */
"use strict";

/**
 * 计算向听数
 * 在麻将游戏中，向听数（シャンテン数，Shanten数）是指玩家手牌距离和牌（胡牌）所需的最少牌数。
 * 向听数越小，表示玩家离和牌越近。向听数为0时，表示玩家已经听牌（即只差一张牌就可以和牌）。
 * 向听数的计算
 * 向听数的计算是根据玩家手牌的组成来确定的。
 * 不同的和牌形式（如一般型、国士无双、七对子）有不同的向听数计算方法。
 * @param {number} m 面子数（完整的顺子或刻子）
 * @param {number} d 搭子数（两张可以组成顺子的牌）
 * @param {number} g 孤立牌数（无法组成面子的单张牌）
 * @param {boolean} j 是否有将牌（对子）
 * @returns {number} 向听数
 */
function _xiangting(m, d, g, j) {
    let n = j ? 4 : 5;
    if (m         > 4) { d += m     - 4; m = 4         }
    if (m + d     > 4) { g += m + d - 4; d = 4 - m     }
    if (m + d + g > n) {                 g = n - m - d }
    if (j) d++;
    return 13 - m * 3 - d * 2 - g;
}

/**
 * 计算搭子和孤立牌
 * @param {Array<number>} bingpai 饼牌数组，表示手牌中每种牌的数量
 * @returns {Object} 搭子和孤立牌的数量
 */
function dazi(bingpai) {
    let n_pai = 0, n_dazi = 0, n_guli = 0;

    for (let n = 1; n <= 9; n++) {
        n_pai += bingpai[n];
        if (n <= 7 && bingpai[n+1] == 0 && bingpai[n+2] == 0) {
            n_dazi += n_pai >> 1;
            n_guli += n_pai  % 2;
            n_pai = 0;
        }
    }
    n_dazi += n_pai >> 1;
    n_guli += n_pai  % 2;

    return { a: [ 0, n_dazi, n_guli ],
             b: [ 0, n_dazi, n_guli ] };
}

/**
 * 计算面子
 * @param {Array<number>} bingpai 饼牌数组
 * @param {number} [n=1] 当前牌的索引
 * @returns {Object} 面子的数量
 */
function mianzi(bingpai, n = 1) {
    if (n > 9) return dazi(bingpai);

    let max = mianzi(bingpai, n+1);

    if (n <= 7 && bingpai[n] > 0 && bingpai[n+1] > 0 && bingpai[n+2] > 0) {
        bingpai[n]--; bingpai[n+1]--; bingpai[n+2]--;
        let r = mianzi(bingpai, n);
        bingpai[n]++; bingpai[n+1]++; bingpai[n+2]++;
        r.a[0]++; r.b[0]++;
        if (r.a[2] < max.a[2]
            || r.a[2] == max.a[2] && r.a[1] < max.a[1]) max.a = r.a;
        if (r.b[0] > max.b[0]
            || r.b[0] == max.b[0] && r.b[1] > max.b[1]) max.b = r.b;
    }

    if (bingpai[n] >= 3) {
        bingpai[n] -= 3;
        let r = mianzi(bingpai, n);
        bingpai[n] += 3;
        r.a[0]++; r.b[0]++;
        if (r.a[2] < max.a[2]
            || r.a[2] == max.a[2] && r.a[1] < max.a[1]) max.a = r.a;
        if (r.b[0] > max.b[0]
            || r.b[0] == max.b[0] && r.b[1] > max.b[1]) max.b = r.b;
    }

    return max;
}

/**
 * 计算所有面子
 * @param {Object} shoupai 手牌对象
 * @param {boolean} jiangpai 是否有将牌
 * @returns {number} 向听数
 */
function mianzi_all(shoupai, jiangpai) {
    let r = {
        m: mianzi(shoupai._bingpai.m),
        p: mianzi(shoupai._bingpai.p),
        s: mianzi(shoupai._bingpai.s),
    };

    let z = [0, 0, 0];
    for (let n = 1; n <= 7; n++) {
        if      (shoupai._bingpai.z[n] >= 3) z[0]++;
        else if (shoupai._bingpai.z[n] == 2) z[1]++;
        else if (shoupai._bingpai.z[n] == 1) z[2]++;
    }

    let n_fulou = shoupai._fulou.length;

    let min = 13;

    for (let m of [r.m.a, r.m.b]) {
        for (let p of [r.p.a, r.p.b]) {
            for (let s of [r.s.a, r.s.b]) {
                let x = [n_fulou, 0, 0];
                for (let i = 0; i < 3; i++) {
                    x[i] += m[i] + p[i] + s[i] + z[i];
                }
                let n_xiangting = _xiangting(x[0], x[1], x[2], jiangpai);
                if (n_xiangting < min) min = n_xiangting;
            }
        }
    }

    return min;
}

/**
 * 计算一般型向听数
 * @param {Object} shoupai 手牌对象
 * @returns {number} 向听数
 */
function xiangting_yiban(shoupai) {
    let min = mianzi_all(shoupai);

    for (let s of ['m','p','s','z']) {
        let bingpai = shoupai._bingpai[s];
        for (let n = 1; n < bingpai.length; n++) {
            if (bingpai[n] >= 2) {
                bingpai[n] -= 2;
                let n_xiangting = mianzi_all(shoupai, true);
                bingpai[n] += 2;
                if (n_xiangting < min) min = n_xiangting;
            }
        }
    }
    if (min == -1 && shoupai._zimo && shoupai._zimo.length > 2) return 0;

    return min;
}

/**
 * 计算国士无双向听数
 * @param {Object} shoupai 手牌对象
 * @returns {number} 向听数
 */
function xiangting_guoshi(shoupai) {
    if (shoupai._fulou.length) return Infinity;

    let n_yaojiu = 0;
    let n_duizi  = 0;

    for (let s of ['m','p','s','z']) {
        let bingpai = shoupai._bingpai[s];
        let nn = (s == 'z') ? [1,2,3,4,5,6,7] : [1,9];
        for (let n of nn) {
            if (bingpai[n] >= 1) n_yaojiu++;
            if (bingpai[n] >= 2) n_duizi++;
        }
    }

    return n_duizi ? 12 - n_yaojiu : 13 - n_yaojiu;
}

/**
 * 计算七对子向听数
 * @param {Object} shoupai 手牌对象
 * @returns {number} 向听数
 */
function xiangting_qidui(shoupai) {
    if (shoupai._fulou.length) return Infinity;

    let n_duizi = 0;
    let n_guli  = 0;

    for (let s of ['m','p','s','z']) {
        let bingpai = shoupai._bingpai[s];
        for (let n = 1; n < bingpai.length; n++) {
            if      (bingpai[n] >= 2) n_duizi++;
            else if (bingpai[n] == 1) n_guli++;
        }
    }

    if (n_duizi          > 7) n_duizi = 7;
    if (n_duizi + n_guli > 7) n_guli  = 7 - n_duizi;

    return 13 - n_duizi * 2 - n_guli;
}

/**
 * 计算最小向听数
 * @param {Object} shoupai 手牌对象
 * @returns {number} 最小向听数
 */
function xiangting(shoupai) {
    return Math.min(
        xiangting_yiban(shoupai),
        xiangting_guoshi(shoupai),
        xiangting_qidui(shoupai)
    );
}

/**
 * 计算听牌
 * @param {Object} shoupai 手牌对象
 * @param {Function} [f_xiangting=xiangting] 向听数计算函数
 * @returns {Array<string>} 听牌数组
 */
function tingpai(shoupai, f_xiangting = xiangting) {
    if (shoupai._zimo) return null;

    let pai = [];
    let n_xiangting = f_xiangting(shoupai);
    for (let s of ['m','p','s','z']) {
        let bingpai = shoupai._bingpai[s];
        for (let n = 1; n < bingpai.length; n++) {
            if (bingpai[n] >= 4) continue;
            bingpai[n]++;
            if (f_xiangting(shoupai) < n_xiangting) pai.push(s+n);
            bingpai[n]--;
        }
    }
    return pai;
}

module.exports = {
    xiangting_guoshi: xiangting_guoshi,
    xiangting_qidui:  xiangting_qidui,
    xiangting_yiban:  xiangting_yiban,
    xiangting:        xiangting,
    tingpai:          tingpai
}
