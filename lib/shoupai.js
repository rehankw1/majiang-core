/*
 *  Majiang.Shoupai
 */
"use strict";

/**
 * Shoupai类
 * 在麻将游戏中，手牌（手牌，Shoupai）是指玩家手中持有的牌。
 * 手牌是玩家在游戏过程中用来进行各种操作（如摸牌、打牌、吃牌、碰牌、杠牌等）的基础。
 * 每位玩家在游戏开始时会有一定数量的手牌，并在游戏过程中通过摸牌和打牌来调整手牌的组成，以达到和牌（胡牌）的目的。
 * @class
 * @classdesc 手牌，手中的牌
 * @param {string[]} qipai 起牌
 */
module.exports = class Shoupai {
    /**
     * 验证牌是否合法
     * @param {string} p 牌
     * @returns {string|undefined} 合法的牌或undefined
     */
    static valid_pai(p) {
        if (p.match(/^(?:[mps]\d|z[1-7])_?\*?[\+\=\-]?$/)) return p;
    }

    /**
     * 验证面子是否合法
     * @param {string} m 面子
     * @returns {string|undefined} 合法的面子或undefined
     */
    static valid_mianzi(m) {
        if (m.match(/^z.*[089]/)) return;
        let h = m.replace(/0/g,'5');
        if (h.match(/^[mpsz](\d)\1\1[\+\=\-]\1?$/)) {
            return m.replace(/([mps])05/,'$1'+'50');
        }
        else if (h.match(/^[mpsz](\d)\1\1\1[\+\=\-]?$/)) {
            return m[0]+m.match(/\d(?![\+\=\-])/g).sort().reverse().join('')
                       +(m.match(/\d[\+\=\-]$/)||[''])[0];
        }
        else if (h.match(/^[mps]\d+\-\d*$/)) {
            let hongpai = m.match(/0/);
            let nn = h.match(/\d/g).sort();
            if (nn.length != 3)                               return;
            if (+nn[0] + 1 != +nn[1] || +nn[1] + 1 != +nn[2]) return;
            h = h[0]+h.match(/\d[\+\=\-]?/g).sort().join('');
            return hongpai ? h.replace(/5/,'0') : h;
        }
    }

    /**
     * 构造函数
     * @param {string[]} qipai 起牌
     */
    constructor(qipai = [], fang = 4) {
        /**
         * 一个对象，用于记录每种牌的数量
         */
        this._bingpai = {
            _:  0,
            m: [0,0,0,0,0,0,0,0,0,0],
            p: [0,0,0,0,0,0,0,0,0,0],
            s: [0,0,0,0,0,0,0,0,0,0],
            z: [0,0,0,0,0,0,0,0],
        };
        /**
         * 一个数组，用于记录副露（吃、碰、杠）的牌组
         */
        this._fulou = [];
        /**
         * 记录自摸的牌
         */
        this._zimo  = null;
        /**
         * 记录立直状态
         */
        this._lizhi = false;
        /**
         * 记录北风牌
         */
        this._nukidora = [];
        /**
         * 记录放数
         */
        this._fang = fang;

        for (let p of qipai) {
            if (p == '_') { continue; }
            if (! (p = Shoupai.valid_pai(p))) continue;
            let s = p[0], n = +p[1];
            if (this._bingpai[s][n] == 4) continue;
            this._bingpai[s][n]++;
            if (s != 'z' && n == 0) this._bingpai[s][5]++;
        }
    }

    /**
     * 从字符串创建Shoupai对象
     * @param {string} paistr 牌字符串
     * @returns {Shoupai} Shoupai对象
     */
    static fromString(paistr = '') {
        let fulou   = paistr.split(',');
        let bingpai = fulou.shift();

        let qipai = bingpai.match(/^_*/)[0].match(/_/g) || [];
        for (let suitstr of bingpai.match(/[mpsz]\d+_*/g) || []) {
            let s = suitstr[0];
            for (let n of suitstr.match(/\d/g)) {
                if (s == 'z' && (n < 1 || 7 < n)) continue;
                qipai.push(s+n);
            }
            qipai = qipai.concat(suitstr.match(/_/g)||[]);
        }
        qipai = qipai.slice(0, 14 - fulou.filter(x=>x).length * 3);
        let zimo = (qipai.length -2) % 3 == 0 && qipai.slice(-1)[0];
        const shoupai = new Shoupai(qipai);

        let last;
        for (let m of fulou) {
            if (! m) { shoupai._zimo = last; break }
            m = Shoupai.valid_mianzi(m);
            if (m) {
                shoupai._fulou.push(m);
                last = m;
            }
        }

        shoupai._zimo  = shoupai._zimo || zimo || null;
        shoupai._lizhi = bingpai.slice(-1) == '*';

        return shoupai;
    }

    /**
     * 将Shoupai对象转换为字符串
     * @returns {string} 牌字符串
     */
    toString() {
        let paistr = '';

        for (let s of ['m','p','s','z']) {
            let suitstr = s;
            let bingpai = this._bingpai[s];
            let n_hongpai = s == 'z' ? 0 : bingpai[0];
            for (let n = 1; n < bingpai.length; n++) {
                let n_pai = bingpai[n];
                if (this._zimo) {
                    if (s+n == this._zimo)           { n_pai--;             }
                    if (n == 5 && s+0 == this._zimo) { n_pai--; n_hongpai-- }
                }
                for (let i = 0; i < n_pai; i++) {
                    if (n ==5 && n_hongpai > 0) { suitstr += 0; n_hongpai-- }
                    else                        { suitstr += n;             }
                }
            }
            if (suitstr.length > 1) paistr += suitstr;
        }
        paistr += '_'.repeat(this._bingpai._ + (this._zimo == '_' ? -1 : 0));
        if (this._zimo && this._zimo.length <= 2) paistr += this._zimo;
        if (this._lizhi)                          paistr += '*';

        for (let m of this._fulou) {
            paistr += ',' + m;
        }
        if (this._zimo && this._zimo.length > 2) paistr += ',';

        return paistr;
    }

    /**
     * 克隆Shoupai对象
     * @returns {Shoupai} 克隆的Shoupai对象
     */
    clone() {
        const shoupai = new Shoupai();

        shoupai._bingpai = {
            _: this._bingpai._,
            m: this._bingpai.m.concat(),
            p: this._bingpai.p.concat(),
            s: this._bingpai.s.concat(),
            z: this._bingpai.z.concat(),
        };
        shoupai._fulou = this._fulou.concat();
        shoupai._zimo  = this._zimo;
        shoupai._lizhi = this._lizhi;
        shoupai._nukidora = this._nukidora.concat();
        shoupai._fang = this._fang;

        return shoupai;
    }

    /**
     * 从字符串更新Shoupai对象
     * @param {string} paistr 牌字符串
     * @returns {Shoupai} 更新后的Shoupai对象
     */
    fromString(paistr) {
        const shoupai = Shoupai.fromString(paistr);
        this._bingpai = {
            _: shoupai._bingpai._,
            m: shoupai._bingpai.m.concat(),
            p: shoupai._bingpai.p.concat(),
            s: shoupai._bingpai.s.concat(),
            z: shoupai._bingpai.z.concat(),
        };
        this._fulou = shoupai._fulou.concat();
        this._zimo  = shoupai._zimo;
        this._lizhi = shoupai._lizhi;
        this._nukidora = shoupai._nukidora.concat();
        this._fang = shoupai._fang;

        return this;
    }

    /**
     * 减少指定的牌
     * @param {string} s 花色
     * @param {number} n 数字
     */
    decrease(s, n) {
        let bingpai = this._bingpai[s];
        if (bingpai[n] == 0 || n == 5 && bingpai[0] == bingpai[5]) {
            if (this._bingpai._ == 0)               throw new Error([this,s+n]);
            this._bingpai._--;
        }
        else {
            bingpai[n]--;
            if (n == 0) bingpai[5]--;
        }
    }

    /**
     * 处理自摸操作，更新手牌
     * @param {string} p 牌
     * @param {boolean} check 是否检查
     * @returns {Shoupai} 更新后的Shoupai对象
     */
    zimo(p, check = true) {
        if (check && this._zimo)                    throw new Error([this, p]);
        if (p == '_') {
            this._bingpai._++;
            this._zimo = p;
        }
        else {
            if (! Shoupai.valid_pai(p))             throw new Error(p);
            let s = p[0], n = +p[1];
            let bingpai = this._bingpai[s];
            if (bingpai[n] == 4)                    throw new Error([this, p]);
            bingpai[n]++;
            if (n == 0) {
                if (bingpai[5] == 4)                throw new Error([this, p]);
                bingpai[5]++;
            }
            this._zimo = s+n;
        }
        return this;
    }

    /**
     * 处理打牌操作，更新手牌
     * @param {string} p 牌
     * @param {boolean} check 是否检查
     * @returns {Shoupai} 更新后的Shoupai对象
     */
    dapai(p, check = true) {
        if (check && ! this._zimo)                  throw new Error([this, p]);
        if (! Shoupai.valid_pai(p))                 throw new Error(p);
        let s = p[0], n = +p[1];
        this.decrease(s, n);
        this._zimo = null;
        if (p.slice(-1) == '*') this._lizhi = true;
        return this;
    }

    /**
     * 处理副露操作（吃、碰、杠），更新手牌
     * @param {string} m 面子
     * @param {boolean} check 是否检查
     * @returns {Shoupai} 更新后的Shoupai对象
     */
    fulou(m, check = true) {
        console.log('Shoupai.fulou', m, check);
        if (check && this._zimo)                    throw new Error([this, m]);
        if (m != Shoupai.valid_mianzi(m))           throw new Error(m);
        if (m.match(/\d{4}$/))                      throw new Error([this, m]);
        if (m.match(/\d{3}[\+\=\-]\d$/))            throw new Error([this, m]);
        let s = m[0];
        for (let n of m.match(/\d(?![\+\=\-])/g)) {
            this.decrease(s, n);
        }
        this._fulou.push(m);
        if (! m.match(/\d{4}/)) this._zimo = m;
        return this;
    }

    /**
     * 杠
     * @param {string} m 面子
     * @param {boolean} check 是否检查
     * @returns {Shoupai} 更新后的Shoupai对象
     */
    gang(m, check = true) {
        console.log('Shoupai.gang', m, check);
        if (check && ! this._zimo)                  throw new Error([this, m]);
        if (check && this._zimo.length > 2)         throw new Error([this, m]);
        if (m != Shoupai.valid_mianzi(m))           throw new Error(m);
        let s = m[0];
        if (m.match(/\d{4}$/)) {
            for (let n of m.match(/\d/g)) {
                this.decrease(s, n);
            }
            this._fulou.push(m);
        }
        else if (m.match(/\d{3}[\+\=\-]\d$/)) {
            let m1 = m.slice(0,5);
            let i = this._fulou.findIndex(m2 => m1 == m2);
            if (i < 0)                              throw new Error([this, m]);
            this._fulou[i] = m;
            this.decrease(s, m.slice(-1));
        }
        else                                        throw new Error([this, m]);
        this._zimo = null;
        return this;
    }

    /**
     * 获取门前清状态
     * @returns {boolean} 是否门前清
     */
    get menqian() {
        return this._fulou.filter(m=>m.match(/[\+\=\-]/)).length == 0;
    }

    /**
     * 获取立直状态
     * @returns {boolean} 是否立直
     */
    get lizhi() { return this._lizhi }

    /**
     * 获取可打的牌
     * @param {boolean} check 是否检查
     * @returns {string[]|null} 可打的牌或null
     */
    get_dapai(check = true) {
        if (!this._zimo)
            return null;

        let deny = {};
        if (check && this._zimo.length > 2) {
            let m = this._zimo;
            let s = m[0];
            let n = + m.match(/\d(?=[\+\=\-])/) || 5;
            deny[s+n] = true;
            if (! m.replace(/0/,'5').match(/^[mpsz](\d)\1\1/)) {
                if (n < 7 && m.match(/^[mps]\d\-\d\d$/)) deny[s+(n+3)] = true;
                if (3 < n && m.match(/^[mps]\d\d\d\-$/)) deny[s+(n-3)] = true;
            }
        }

        let dapai = [];
        if (! this._lizhi) {
            for (let s of ['m','p','s','z']) {
                let bingpai = this._bingpai[s];
                for (let n = 1; n < bingpai.length; n++) {
                    if (bingpai[n] == 0)  continue;
                    if (deny[s+n])        continue;
                    if (s+n == this._zimo && bingpai[n] == 1) continue;
                    if (s == 'z' || n != 5)          dapai.push(s+n);
                    else {
                        if (bingpai[0] > 0
                            && s+0 != this._zimo || bingpai[0] > 1)
                                                     dapai.push(s+0);
                        if (bingpai[0] < bingpai[5]) dapai.push(s+n);
                    }
                }
            }
        }
        if (this._zimo.length == 2) dapai.push(this._zimo + '_');
        return dapai;
    }

    /**
     * 获取可吃的面子
     * @param {string} p 牌
     * @param {boolean} check 是否检查
     * @returns {string[]} 可吃的面子
     */
    get_chi_mianzi(p, check = true) {
        if (this._zimo) return null;
        if (! Shoupai.valid_pai(p)) throw new Error(p);

        let mianzi = [];
        let s = p[0], n = + p[1] || 5, d = p.match(/[\+\=\-]$/);
        if (! d) throw new Error(p);
        if (s == 'z' || d != '-') return mianzi;
        if (this._lizhi) return mianzi;

        let bingpai = this._bingpai[s];
        if (3 <= n && bingpai[n-2] > 0 && bingpai[n-1] > 0) {
            if (! check
                || (3 < n ? bingpai[n-3] : 0) + bingpai[n]
                        < 14 - (this._fulou.length + 1) * 3)
            {
                if (n-2 == 5 && bingpai[0] > 0) mianzi.push(s+'067-');
                if (n-1 == 5 && bingpai[0] > 0) mianzi.push(s+'406-');
                if (n-2 != 5 && n-1 != 5 || bingpai[0] < bingpai[5])
                                            mianzi.push(s+(n-2)+(n-1)+(p[1]+d));
            }
        }
        if (2 <= n && n <= 8 && bingpai[n-1] > 0 && bingpai[n+1] > 0) {
            if (! check || bingpai[n] < 14 - (this._fulou.length + 1) * 3) {
                if (n-1 == 5 && bingpai[0] > 0) mianzi.push(s+'06-7');
                if (n+1 == 5 && bingpai[0] > 0) mianzi.push(s+'34-0');
                if (n-1 != 5 && n+1 != 5 || bingpai[0] < bingpai[5])
                                            mianzi.push(s+(n-1)+(p[1]+d)+(n+1));
            }
        }
        if (n <= 7 && bingpai[n+1] > 0 && bingpai[n+2] > 0) {
            if (! check
                ||  bingpai[n] + (n < 7 ? bingpai[n+3] : 0)
                        < 14 - (this._fulou.length + 1) * 3)
            {
                if (n+1 == 5 && bingpai[0] > 0) mianzi.push(s+'4-06');
                if (n+2 == 5 && bingpai[0] > 0) mianzi.push(s+'3-40');
                if (n+1 != 5 && n+2 != 5 || bingpai[0] < bingpai[5])
                                            mianzi.push(s+(p[1]+d)+(n+1)+(n+2));
            }
        }
        return mianzi;
    }

    /**
     * 获取可碰的面子
     * @param {string} p 牌
     * @returns {string[]} 可碰的面子
     */
    get_peng_mianzi(p) {
        if (this._zimo) return null;
        if (!Shoupai.valid_pai(p)) throw new Error(p);

        let mianzi = [];
        let s = p[0], n = + p[1] || 5, d = p.match(/[\+\=\-]$/);
        if (! d) throw new Error(p);
        if (this._lizhi) return mianzi;

        let bingpai = this._bingpai[s];
        if (bingpai[n] >= 2) {
            if (n == 5 && bingpai[0] >= 2)
                mianzi.push(s+'00'+p[1]+d);
            if (n == 5 && bingpai[0] >= 1 && bingpai[5] - bingpai[0] >=1)
                mianzi.push(s+'50'+p[1]+d);
            if (n != 5 || bingpai[5] - bingpai[0] >=2)
                mianzi.push(s+n+n+p[1]+d);
        }
        return mianzi;
    }

    /**
     * 获取可杠的面子
     * @param {string} [p] 牌
     * @returns {string[]} 可杠的面子
     */
    get_gang_mianzi(p) {
        let mianzi = [];
        if (p) {
            if (this._zimo) return null;
            if (! Shoupai.valid_pai(p)) throw new Error(p);

            let s = p[0], n = + p[1] || 5, d = p.match(/[\+\=\-]$/);
            if (! d) throw new Error(p);
            if (this._lizhi) return mianzi;

            let bingpai = this._bingpai[s];
            if (bingpai[n] == 3) {
                if (n == 5)
                    mianzi = [s + '5'.repeat(3 - bingpai[0]) + '0'.repeat(bingpai[0]) + p[1] + d];
                else
                    mianzi = [s+n+n+n+n+d];
            }
        }
        else {
            if (! this._zimo) return null;
            if (this._zimo.length > 2) return null;
            let p = this._zimo.replace(/0/,'5');

            for (let s of ['m','p','s','z']) {
                let bingpai = this._bingpai[s];
                for (let n = 1; n < bingpai.length; n++) {
                    if (bingpai[n] == 0) continue;
                    if (bingpai[n] == 4) {
                        if (this._lizhi && s+n != p) continue;
                        if (n == 5)
                            mianzi.push(s + '5'.repeat(4 - bingpai[0]) + '0'.repeat(bingpai[0]));
                        else
                            mianzi.push(s+n+n+n+n);
                    }
                    else {
                        if (this._lizhi) continue;
                        for (let m of this._fulou) {
                            if (m.replace(/0/g,'5').slice(0,4) == s+n+n+n) {
                                if (n == 5 && bingpai[0] > 0) mianzi.push(m+0);
                                else                          mianzi.push(m+n);
                            }
                        }
                    }
                }
            }
        }
        return mianzi;
    }

    /**
     * 抜きドラ（nukidora）- 在三麻中抜出北风牌
     * @returns {Array<string>} 抜出的牌数组
     */
    extractNukidora() {
        if (this._fang !== 3) return []; // Only in 3-player mode

        const extractedTiles = [];
        const northCount = this._bingpai.z[4]; // z4 is North wind

        for (let i = 0; i < northCount; i++) {
            extractedTiles.push('z4');
            this._nukidora.push('z4');
        }

        // Remove North winds from hand
        this._bingpai.z[4] = 0;

        return extractedTiles;
    }

    /**
     * 检查是否可以抜きドラ
     * @returns {boolean} 是否可以抜きドラ
     */
    allow_nukidora() {
        return this._fang === 3 && this._bingpai.z[4] > 0;
    }

    /**
     * 获取可以抜きドラ的牌
     * @returns {Array<string>} 可以抜きドラ的牌数组
     */
    get_nukidora_pai() {
        if (!this.allow_nukidora()) return [];
        
        const nukidoraPai = [];
        const northCount = this._bingpai.z[4];
        
        for (let i = 0; i < northCount; i++) {
            nukidoraPai.push('z4');
        }
        
        return nukidoraPai;
    }

    /**
     * @returns {number} 
     */
    get nukidoraCount() {
        return this._nukidora.length;
    }
}
