/*
 *  Majiang.Game
 */
"use strict";

const Majiang = {
    rule:    require('./rule'),
    Shoupai: require('./shoupai'),
    Shan:    require('./shan'),
    He:      require('./he'),
    Util:    Object.assign(require('./xiangting'), require('./hule'))
};

/**
 * 麻将游戏类
 */
module.exports = class Game {
    /**
     * 创建一个游戏实例。
     * @param {Array} players - 游戏中的玩家。
     * @param {Function} callback - 回调函数。
     * @param {Object} rule - 游戏规则。
     * @param {string} title - 游戏标题。
     */
    constructor(players, callback, rule, title) {
        console.log(`Game.constructor`, players, rule, title);

        this._players  = players;
        this._callback = callback || (()=>{});
        this._rule     = rule || Majiang.rule();
        this.sanma     = rule['mode'] == 'sanma';

        this._model = {
            title:      title || '電脳麻将\n' + new Date().toLocaleString(),
            player:     this.sanma ? ['私', '下家', '上家'] : ['私', '下家', '対面', '上家'],
            qijia:      0,
            zhuangfeng: 0,
            jushu:      0,
            changbang:  0,
            lizhibang:  0,
            defen:      (this.sanma ? [0,0,0] : [0,0,0,0]).map(x=>this._rule['配給原点']),
            shan:       null,
            shoupai:    [],
            he:         [],
            player_id:  this.sanma ? [0, 1, 2] : [0, 1, 2, 3],
            fang:       this.sanma ? 3 : 4,
        };

        this._view;

        this._status;
        this._reply = [];

        this._sync  = false;
        this._stop  = null;
        this._speed = 3;
        this._wait  = 0;
        this._timeout_id;

        this.firstTurn = true;

        this._handler;

        // Initialize river (he) and seat mapping for each player
        for (let l = 0; l < this.model.fang; l++) {
            this._model.he[l]        = new Majiang.He();
            this._model.player_id[l] = (this._model.qijia + this._model.jushu + l) % this._model.fang;
        }
    }

    /**
     * 获取游戏模型。
     * @return {Object} 游戏模型。
     */
    get model()      { return this._model  }

    /**
     * 设置游戏视图。
     * @param {Object} view - 游戏视图。
     */
    set view(view)   { this._view = view   }

    /**
     * 获取游戏速度。
     * @return {number} 游戏速度。
     */
    get speed()      { return this._speed  }

    /**
     * 设置游戏速度。
     * @param {number} speed - 游戏速度。
     */
    set speed(speed) { this._speed = speed }

    /**
     * 设置等待时间。
     * @param {number} wait - 等待时间。
     */
    set wait(wait)   { this._wait = wait   }

    /**
     * 设置处理程序回调。
     * @param {Function} callback - 处理程序回调。
     */
    set handler(callback) { this._handler = callback }

    /**
     * 添加牌谱日志。
     * @param {Object} paipu - 牌谱日志。
     */
    add_paipu(paipu) {
        this._paipu.log[this._paipu.log.length - 1].push(paipu);
    }

    /**
     * 延迟执行回调。
     * @param {Function} callback - 回调函数。
     * @param {number} timeout - 超时时间（毫秒）。
     */
    delay(callback, timeout) {
        if (this._sync) return callback();

        timeout = this._speed == 0 ? 0
                : timeout == null  ? Math.max(500, this._speed * 200)
                :                    timeout;
        setTimeout(callback, timeout);
    }

    /**
     * 让玩家说话。
     * @param {string} name - 玩家名称。
     * @param {string} l - 消息内容。
     */
    say(name, l) {
        if (this._view) this._view.say(name, l);
    }

    /**
     * 停止游戏。
     * @param {Function} callback - 回调函数。
     */
    stop(callback = ()=>{}) {
        this._stop = callback;
    }

    /**
     * 开始游戏。
     */
    start() {
        console.log(`Game.start`);
        if (this._timeout_id) return;
        this._stop = null;
        this._timeout_id = setTimeout(()=>this.next(), 0);
    }

    /**
     * 通知玩家事件。
     * @param {string} type - 事件类型。
     * @param {Array} msg - 发送给玩家的消息。
     */
    notify_players(type, msg) {
        console.log(`Game.notify_players`, type, msg);
        for (let l = 0; l < this.model.fang; l++) {
            let id = this._model.player_id[l];
            if (this._sync)
                this._players[id].action(msg[l]);
            else setTimeout(()=>{
                this._players[id].action(msg[l]);
            }, 0);
        }
    }

    /**
     * 请求玩家进行操作。
     * @param {string} type - 操作类型。
     * @param {Array} msg - 发送给玩家的消息。
     * @param {number} timeout - 超时时间（毫秒）。
     */
    call_players(type, msg, timeout) {
        console.log(`Game.call_players`, type, msg, timeout);
        timeout = this._speed == 0 ? 0 : (timeout == null ? this._speed * 200 : timeout);
        this._status = type;
        this._reply  = [];
        for (let l = 0; l < this.model.fang; l++) {
            const id = this._model.player_id[l];
            if (this._sync)
                this._players[id].action(msg[l], reply => this.reply(id, reply));
            else
                setTimeout(() => {
                    this._players[id].action(msg[l], reply => this.reply(id, reply));
                }, 0);
        }

        if (!this._sync) {
            this._timeout_id = setTimeout(()=>this.next(), timeout);
        }
    }

    /**
     * 处理玩家回复。
     * @param {number} id - 玩家ID。
     * @param {Object} reply - 玩家回复。
     */
    reply(id, reply) {
        console.log(`Game.reply`, id, reply);
        this._reply[id] = reply || {};
        if (this._sync) {
            return;
        }
        if (this._reply.filter(x => x).length < this.model.fang)
            return;
        if (!this._timeout_id) {
            this._timeout_id = setTimeout(()=>this.next(), 0);
        }
    }

    /**
     * 进行下一步操作。
     */
    next() {
        console.log(`Game.next`, this._status);
        this._timeout_id = clearTimeout(this._timeout_id);
        if (this._reply.filter(x=>x).length < this.model.fang) return;
        if (this._stop) return this._stop();

        if      (this._status == 'kaiju')    this.reply_kaiju();
        else if (this._status == 'qipai')    this.reply_qipai();
        else if (this._status == 'zimo')     this.reply_zimo();
        else if (this._status == 'dapai')    this.reply_dapai();
        else if (this._status == 'fulou')    this.reply_fulou();
        else if (this._status == 'gang')     this.reply_gang();
        else if (this._status == 'gangzimo') this.reply_zimo();
        else if (this._status == 'kita')     this.reply_kita();
        else if (this._status == 'hule')     this.reply_hule();
        else if (this._status == 'pingju')   this.reply_pingju();
        else                                 this._callback(this._paipu);
    }

    /**
     * 同步游戏状态。
     * @return {Game} 游戏实例。
     */
    do_sync() {
        console.log(`Game.do_sync`);
        this._sync = true;

        this.kaiju();

        for (;;) {
            if      (this._status == 'kaiju')    this.reply_kaiju();
            else if (this._status == 'qipai')    this.reply_qipai();
            else if (this._status == 'zimo')     this.reply_zimo();
            else if (this._status == 'dapai')    this.reply_dapai();
            else if (this._status == 'fulou')    this.reply_fulou();
            else if (this._status == 'gang')     this.reply_gang();
            else if (this._status == 'gangzimo') this.reply_zimo();
            else if (this._status == 'hule')     this.reply_hule();
            else if (this._status == 'pingju')   this.reply_pingju();
            else                                 break;
        }

        this._callback(this._paipu);

        return this;
    }

    /**
     * 开局。
     * @param {number} qijia - 起家。
     */
    kaiju(qijia) {
        console.log(`Game.kaiju`, qijia);
        // this._model.qijia = qijia ?? Math.floor(Math.random() * this.model.fang);
        this._model.qijia = 0; // for test

        this._max_jushu = this._rule['場数'] == 0 ? 0
                        : this._rule['場数'] * this.model.fang - 1;

        this._paipu = {
            title:  this._model.title,
            player: this._model.player,
            qijia:  this._model.qijia,
            log:    [],
            defen:  this._model.defen.concat(),
            point:  [],
            rank:   []
        };

        const msg = [];
        for (let id = 0; id < this.model.fang; id++) {
            // Get nukidora information for each player
            const nukidoraInfo = this.sanma ? {
                nukidora: this._model.shoupai.map(shoupai => ({
                    count: shoupai.nukidoraCount,
                    // tiles: shoupai._nukidora
                }))
            } : null;

            msg[id] = JSON.parse(JSON.stringify({
                kaiju: {
                    id:     id,
                    rule:   this._rule,
                    title:  this._paipu.title,
                    player: this._paipu.player,
                    qijia:  this._paipu.qijia,
                    nukidora: nukidoraInfo
                }
            }));
        }
        this.call_players('kaiju', msg, 0);

        if (this._view) this._view.kaiju();
    }

    /**
     * 起牌。
     * @param {Object} shan - 山牌对象。
     */
    qipai(shan) {
        console.log(`Game.qipai`, shan);
        const model = this._model;

        model.shan = shan || new Majiang.Shan(this._rule);
        for (let l = 0; l < model.fang; l++) {
            let qipai = [];
            for (let i = 0; i < 13; i++) {
                qipai.push(model.shan.zimo());
            }
            // Create new Shoupai instance with empty nukidora array
            model.shoupai[l] = new Majiang.Shoupai(qipai, this.model.fang);
            model.he[l] = new Majiang.He();
            model.player_id[l] = (model.qijia + model.jushu + l) % model.fang;
        }
        model.lunban = -1;

        this.firstTurn = true;

        /**
         * 是否第一次自摸
         * @type {boolean}
         */
        this._diyizimo = true;

        /**
         * 是否风牌
         * @type {boolean}
         */
        this._fengpai  = this._rule['途中流局あり'];

        /**
         * 打出的牌
         * @type {string|null}
         */
        this._dapai = null;

        /**
         * 杠的牌
         * @type {string|null}
         */
        this._gang  = null;

        /**
         * 立直状态
         * @type {Array<number>}
         */
        this._lizhi     = [ 0, 0, 0, 0 ];

        /**
         * 一发状态
         * @type {Array<number>}
         */
        this._yifa      = [ 0, 0, 0, 0 ];

        /**
         * 杠的次数
         * @type {Array<number>}
         */
        this._n_gang    = [ 0, 0, 0, 0 ];

        /**
         * 能否荣和
         * @type {Array<number>}
         */
        this._neng_rong = [ 1, 1, 1, 1 ];

        /**
         * 和牌状态
         * @type {Array<number>}
         */
        this._hule        = [];

        /**
         * 和牌选项
         * @type {string|null}
         */
        this._hule_option = null;

        /**
         * 是否无局
         * @type {boolean}
         */
        this._no_game     = false;

        /**
         * 是否连庄
         * @type {boolean}
         */
        this._lianzhuang  = false;

        /**
         * 场棒数
         * @type {number}
         */
        this._changbang   = model.changbang;

        /**
         * 分配结果
         * @type {Array<number>|null}
         */
        this._fenpei      = null;

        this._paipu.defen = model.defen.concat();
        this._paipu.log.push([]);
        
        // Initialize nukidora arrays for sanma mode but no automatic extraction
        if (this.sanma) {
            for (let l = 0; l < model.fang; l++) {
                model.shoupai[l]._nukidora = [];
            }
        }
        
        let paipu = {
            qipai: {
                zhuangfeng: model.zhuangfeng,
                jushu:      model.jushu,
                changbang:  model.changbang,
                lizhibang:  model.lizhibang,
                defen:      model.player_id.map(id => model.defen[id]),
                baopai:     model.shan.baopai[0],
                shoupai:    model.shoupai.map(shoupai => shoupai.toString())
            }
        };
        
        // Always add nukidora information for 3-player games
        if (this.sanma) {
            paipu.qipai.nukidora = model.shoupai.map((shoupai, l) => ({
                l: l,
                count: shoupai.nukidoraCount
            }));
        }
        
        this.add_paipu(paipu);


        
        let msg = [];
        for (let l = 0; l < model.fang; l++) {
            msg[l] = JSON.parse(JSON.stringify(paipu));
            for (let i = 0; i < model.fang; i++) {
                if (i != l) msg[l].qipai.shoupai[i] = '';
            }
            
            // Add starting hand kita options for players with z4
            if (this.sanma && this.allow_kita(l)) {
                msg[l].kita = this.get_kita_options(l);
                console.log(`[QIPAI] Adding starting hand kita options for player ${l}:`, msg[l].kita);
            }
        }
        this.call_players('qipai', msg, 0);

        if (this._view) this._view.redraw();
    }

    /**
     * 摸牌
     */
    zimo() {
        console.log(`Game.zimo`);
        const model = this._model;

        if(model.lunban === -1){
            this.firstTurn = true;
            console.log(`[ZIMO] First turn of the game`);
        } else {
            this.firstTurn = false;
        }

        model.lunban = (model.lunban + 1) % model.fang;
        console.log(`[ZIMO] Turn switched to player ${model.lunban}`);

        // Check wall state before drawing
        console.log(`[ZIMO] Wall tiles remaining: ${model.shan.paishu}`);
        if (model.shan.paishu === 0) {
            console.log(`[ZIMO] ERROR: Attempting to draw from empty wall!`);
            return this.delay(() => this.pingju('荒牌平局'), 0);
        }

        // Draw tile normally - NO automatic nukidora extraction
        const zimo = model.shan.zimo();
        console.log(`[ZIMO] Player ${model.lunban} drew tile: ${zimo}`);
        
        model.shoupai[model.lunban].zimo(zimo, false);
        
        // Log hand state after drawing
        const handAfterDraw = model.shoupai[model.lunban].toString();
        const tileCount = this.countTilesInHand(model.shoupai[model.lunban]);
        console.log(`[ZIMO] Player ${model.lunban} hand after draw: ${handAfterDraw} (${tileCount} tiles)`);

        // Create normal zimo paipu
        const zimoPaipu = { zimo: { l: model.lunban, p: zimo } };
        this.add_paipu(zimoPaipu);
        
        // Check for kita opportunity in sanma mode
        // In original system: drawing 1 z4 results in count of 2 (1 in bingpai + 1 in zimo)
        const drewZ4 = zimo === 'z4';
        const bingpaiZ4Count = model.shoupai[model.lunban]._bingpai.z[4];
        const totalZ4Count = model.shoupai[model.lunban].getTotalZ4Count();
        
        // Offer kita when:
        // 1. Player just drew z4 (drewZ4 = true, will show totalZ4Count >= 2)
        // 2. Player has z4 in bingpai from previous turns (persistent kita)
        const kitaAvailable = this.sanma && (drewZ4 || bingpaiZ4Count > 0) && this.allow_kita(model.lunban);
        
        if (kitaAvailable) {
            console.log(`[ZIMO] Kita opportunity available for player ${model.lunban} (drew z4: ${drewZ4}, z4 in bingpai: ${bingpaiZ4Count}, total: ${totalZ4Count})`);
        }
        
        // Send normal zimo event - ALWAYS send this for proper game flow
        const zimoMsg = [];
        for (let l = 0; l < model.fang; l++) {
            zimoMsg[l] = JSON.parse(JSON.stringify(zimoPaipu));
            if (l != model.lunban) zimoMsg[l].zimo.p = '';
            
            // Add kita option when player has z4 tiles (accounting for original double-counting behavior)
            if (l === model.lunban && kitaAvailable) {
                zimoMsg[l].kita = this.get_kita_options(l);
                console.log(`[ZIMO] Adding kita option to player ${l} (drew z4: ${drewZ4}, z4 in bingpai: ${bingpaiZ4Count}, total: ${totalZ4Count}):`, zimoMsg[l].kita);
            }
            
            // Add updated nukidora count information for sanma games
            if (this.sanma) {
                zimoMsg[l].nukidora = model.shoupai.map((shoupai, playerIndex) => ({
                    l: playerIndex,
                    count: shoupai.nukidoraCount
                }));
            }
        }
        
        console.log(`[ZIMO] Sending zimo event to all players, kita available: ${kitaAvailable}`);
        this.call_players('zimo', zimoMsg);
        
        if (this._view) this._view.update(zimoPaipu);
    }

    /**
     * 打牌。
     * @param {string} dapai - 打出的牌。
     */
    dapai(dapai) {
        console.log(`[DAPAI] Player ${this._model.lunban} discarding: ${dapai}`);
        const model = this._model;

        // Log hand state before discard
        const handBefore = model.shoupai[model.lunban].toString();
        const beforeTileCount = this.countTilesInHand(model.shoupai[model.lunban]);
        console.log(`[DAPAI] Player ${model.lunban} hand before discard: ${handBefore} (${beforeTileCount} tiles)`);

        this._yifa[model.lunban] = 0;

        if (!model.shoupai[model.lunban].lizhi)
            this._neng_rong[model.lunban] = true;

        model.shoupai[model.lunban].dapai(dapai);
        model.he[model.lunban].dapai(dapai);

        // Log hand state after discard
        const handAfter = model.shoupai[model.lunban].toString();
        const afterTileCount = this.countTilesInHand(model.shoupai[model.lunban]);
        console.log(`[DAPAI] Player ${model.lunban} hand after discard: ${handAfter} (${afterTileCount} tiles)`);

        if (this._diyizimo) {
            if (! dapai.match(/^z[1234]/)) this._fengpai = false;
            if (this._dapai && this._dapai.slice(0,2) != dapai.slice(0,2))
                this._fengpai = false;
        }
        else
            this._fengpai = false;

        if (dapai.slice(-1) == '*') {
            console.log(`[DAPAI] Player ${model.lunban} declared riichi!`);
            this._lizhi[model.lunban] = this._diyizimo ? 2 : 1;
            this._yifa[model.lunban]  = this._rule['一発あり'];
        }

        if (Majiang.Util.xiangting(model.shoupai[model.lunban]) == 0
            && Majiang.Util.tingpai(model.shoupai[model.lunban])
                .find(p=>model.he[model.lunban].find(p)))
        {
            this._neng_rong[model.lunban] = false;
            console.log(`[DAPAI] Player ${model.lunban} furiten - cannot win on ron`);
        }

        this._dapai = dapai;

        const paipu = { dapai: { l: model.lunban, p: dapai } };
        this.add_paipu(paipu);

        if (this._gang) {
            console.log(`[DAPAI] Opening kan dora after discard`);
            this.kaigang();
        }

        const msg = [];
        for (let l = 0; l < model.fang; l++) {
            msg[l] = JSON.parse(JSON.stringify(paipu));
        }
        console.log(`[DAPAI] Notifying all players of discard: ${dapai}`);
        this.call_players('dapai', msg);

        if (this._view) this._view.update(paipu);
    }

    /**
     * 副露。
     * @param {string} fulou - 副露的牌。
     */
    fulou(fulou) {
        let model = this._model;

        this._diyizimo = false;
        this._yifa     = [0,0,0,0];

        model.he[model.lunban].fulou(fulou);

        let d = (fulou.match(/[\+\=\-]/) || ['_'])[0];
        let offset;
        if (this.sanma) {
            // Dynamically determine the offset so that the generated marker
            // matches what `_+=-` would produce for the resulting seat.
            offset = 1;
            while (offset < this.model.fang) {
                const seat = (model.lunban + offset) % this.model.fang;
                const diff4 = (4 + model.lunban - seat) % 4;
                const marker = '_+=-'[diff4];
                if (marker === d) break;
                offset++;
            }
            if (offset === this.model.fang) offset = 0; // safety
        }
        else {
            offset = '_-=+'.indexOf(d);
        }
        model.lunban = (model.lunban + offset) % model.fang;

        model.shoupai[model.lunban].fulou(fulou);

        if (fulou.match(/^[mpsz]\d{4}/)) {
            this._gang = fulou;
            this._n_gang[model.lunban]++;
        }

        let paipu = { fulou: { l: model.lunban, m: fulou } };
        this.add_paipu(paipu);

        const msg = [];
        for (let l = 0; l < model.fang; l++) {
            msg[l] = JSON.parse(JSON.stringify(paipu));
        }
        this.call_players('fulou', msg);

        if (this._view) this._view.update(paipu);
    }

    /**
     * 杠牌。
     * @param {string} gang - 杠的牌。
     */
    gang(gang) {
        const model = this._model;

        model.shoupai[model.lunban].gang(gang);

        const paipu = { gang: { l: model.lunban, m: gang } };
        this.add_paipu(paipu);

        if (this._gang) this.kaigang();

        this._gang = gang;
        this._n_gang[model.lunban]++;

        const msg = [];
        for (let l = 0; l < model.fang; l++) {
            msg[l] = JSON.parse(JSON.stringify(paipu));
        }
        this.call_players('gang', msg);

        if (this._view) this._view.update(paipu);
    }

    /**
     * 杠后自摸。
     */
    gangzimo() {
        const model = this._model;

        this._diyizimo = false;
        this._yifa     = [0,0,0,0];

        const zimo = model.shan.gangzimo();
        model.shoupai[model.lunban].zimo(zimo);

        const paipu = { gangzimo: { l: model.lunban, p: zimo } };
        this.add_paipu(paipu);

        if (! this._rule['カンドラ後乗せ'] ||
            this._gang.match(/^[mpsz]\d{4}$/)) this.kaigang();

        const msg = [];
        for (let l = 0; l < model.fang; l++) {
            msg[l] = JSON.parse(JSON.stringify(paipu));
            if (l != model.lunban) msg[l].gangzimo.p = '';
        }
        this.call_players('gangzimo', msg);

        if (this._view) this._view.update(paipu);
    }

    /**
     * 开杠。
     */
    kaigang() {
        this._gang = null;

        if (!this._rule['カンドラあり']) return;

        const model = this._model;

        model.shan.kaigang();
        const baopai = model.shan.baopai.pop();

        const paipu = { kaigang: { baopai: baopai } };
        this.add_paipu(paipu);

        const msg = [];
        for (let l = 0; l < model.fang; l++) {
            msg[l] = JSON.parse(JSON.stringify(paipu));
        }
        this.notify_players('kaigang', msg);

        if (this._view) this._view.update(paipu);
    }

    /**
     * 执行kita操作（抜きドラ - 抜出北风牌）
     * @param {string} pai - 要抜出的牌（应该是'z4'）
     * @param {number} playerIndex - 玩家索引（用于起手kita）
     */
    kita(pai, playerIndex = null) {
        const model = this._model;
        const kitaPlayer = playerIndex !== null ? playerIndex : model.lunban;
        const isStartingHand = this._status === 'qipai' || model.lunban === -1;
        
        console.log(`[KITA] Starting kita action for player ${kitaPlayer}, tile: ${pai}, starting hand: ${isStartingHand}`);

        // Log current hand state before kita
        const handBefore = model.shoupai[kitaPlayer].toString();
        const beforeTileCount = this.countTilesInHand(model.shoupai[kitaPlayer]);
        console.log(`[KITA] Player ${kitaPlayer} hand before kita: ${handBefore} (${beforeTileCount} tiles)`);
        console.log(`[KITA] Current nukidora count: ${model.shan.nukidora.length}`);

        // 验证kita操作的有效性
        if (!this.allow_kita(kitaPlayer)) {
            const errorDetails = {
                sanma: this.sanma,
                lunban: model.lunban,
                kitaPlayer: kitaPlayer,
                isStartingHand: isStartingHand,
                zimo: model.shoupai[kitaPlayer]._zimo,
                handTileCount: this.countTilesInHand(model.shoupai[kitaPlayer])
            };
            console.log(`[KITA] ERROR: Kita not allowed!`, errorDetails);
            throw new Error(`Kita not allowed: ${JSON.stringify(errorDetails)}`);
        }

        if (pai !== 'z4') {
            console.log(`[KITA] ERROR: Invalid kita tile: ${pai}, expected z4`);
            throw new Error(`Invalid kita tile: ${pai}`);
        }

        console.log(`[KITA] Kita validation passed, proceeding with extraction`);

        // 使用Shoupai方法抜出nukidora
        console.log(`[DEBUG] Before kita, nukidora array:`, model.shoupai[kitaPlayer]._nukidora);
        const extractedTiles = model.shoupai[kitaPlayer].extractNukidora(isStartingHand);
        console.log(`[DEBUG] After kita, nukidora array:`, model.shoupai[kitaPlayer]._nukidora);
        console.log(`[KITA] Extracted nukidora tiles:`, extractedTiles);

        if (extractedTiles.length === 0) {
            console.log(`[KITA] WARNING: No tiles extracted, this shouldn't happen`);
        }

        // 添加到shan的nukidora集合中
        for (const tile of extractedTiles) {
            model.shan.addNukidora(tile);
            console.log(`[KITA] Added ${tile} to nukidora collection`);
        }

        // Log hand state after extraction
        const handAfter = model.shoupai[kitaPlayer].toString();
        const afterTileCount = this.countTilesInHand(model.shoupai[kitaPlayer]);
        console.log(`[KITA] Player ${kitaPlayer} hand after extraction: ${handAfter} (${afterTileCount} tiles)`);
        console.log(`[KITA] New nukidora count: ${model.shan.nukidora.length}`);

        // 创建kita牌谱条目
        const kitaPaipu = { 
            kita: { 
                l: kitaPlayer, 
                p: pai,
                count: model.shoupai[kitaPlayer].nukidoraCount, // Total accumulated nukidora count
                starting_hand: isStartingHand
            } 
        };
        this.add_paipu(kitaPaipu);

        // 通知所有玩家kita操作
        const kitaMsg = [];
        for (let l = 0; l < model.fang; l++) {
            kitaMsg[l] = JSON.parse(JSON.stringify(kitaPaipu));
            
            // Add updated nukidora count information for sanma games
            if (this.sanma) {
                kitaMsg[l].nukidora = model.shoupai.map((shoupai, playerIndex) => ({
                    l: playerIndex,
                    count: shoupai.nukidoraCount
                }));
                console.log(`[KITA] Added nukidora count to message for player ${l}:`, kitaMsg[l].nukidora);
            }
        }
        console.log(`[KITA] Notifying all players of kita action`);
        this.notify_players('kita', kitaMsg);

        if (this._view) this._view.update(kitaPaipu);

        // 处理后续流程
        if (isStartingHand) {
            console.log(`[KITA] Starting hand kita complete, no replacement draw needed`);
            // For starting hand kita, no replacement draw is needed
            // Continue with normal qipai processing
        } else {
            // 摸替换牌
            console.log(`[KITA] Normal kita complete, proceeding to replacement tile draw`);
            this.delay(() => this.kita_replacement(), 0);
        }
    }

    /**
     * 处理kita后的替换牌摸取
     */
    kita_replacement() {
        console.log(`[KITA-REPLACEMENT] Starting replacement tile draw for player ${this._model.lunban}`);
        const model = this._model;

        // Log hand state before replacement
        const handBefore = model.shoupai[model.lunban].toString();
        const beforeTileCount = this.countTilesInHand(model.shoupai[model.lunban]);
        console.log(`[KITA-REPLACEMENT] Player ${model.lunban} hand before replacement: ${handBefore} (${beforeTileCount} tiles)`);

        // 检查牌墙是否耗尽
        console.log(`[KITA-REPLACEMENT] Wall tiles remaining: ${model.shan.paishu}`);
        if (model.shan.paishu === 0) {
            console.log(`[KITA-REPLACEMENT] ERROR: Wall exhausted during kita replacement!`);
            return this.delay(() => this.pingju('荒牌平局'), 0);
        }

        // Even simpler fix: Use normal zimo method for replacement, regardless of existing zimo
        const replacement = model.shan.zimo();
        console.log(`[KITA-REPLACEMENT] Drew replacement tile: ${replacement}`);
        
        // Use normal zimo method with check=false (allows existing zimo, adds to bingpai)
        model.shoupai[model.lunban].zimo(replacement, false, true);

        // Log hand state after replacement
        const handAfter = model.shoupai[model.lunban].toString();
        const afterTileCount = this.countTilesInHand(model.shoupai[model.lunban]);
        console.log(`[KITA-REPLACEMENT] Player ${model.lunban} hand after replacement: ${handAfter} (${afterTileCount} tiles)`);

        // Check if player still has z4 tiles for future regular turns
        const remainingZ4Count = model.shoupai[model.lunban].getTotalZ4Count();
        if (remainingZ4Count > 0) {
            console.log(`[KITA-REPLACEMENT] Player still has ${remainingZ4Count} z4 tile(s) for future kita on regular turns`);
        }

        // 创建替换牌的zimo牌谱
        const zimoPaipu = { zimo: { l: model.lunban, p: replacement } };
        this.add_paipu(zimoPaipu);

        // 发送替换牌的zimo事件
        const zimoMsg = [];
        for (let l = 0; l < model.fang; l++) {
            zimoMsg[l] = JSON.parse(JSON.stringify(zimoPaipu));
            if (l != model.lunban) zimoMsg[l].zimo.p = '';
            
            // 只有当替换牌是z4时才提供kita选项
            if (l === model.lunban && replacement === 'z4') {
                zimoMsg[l].kita = this.get_kita_options(l);
                console.log(`[KITA-REPLACEMENT] Adding kita option for z4 replacement tile:`, zimoMsg[l].kita);
            }
            
            // Add updated nukidora count information for sanma games
            if (this.sanma) {
                zimoMsg[l].nukidora = model.shoupai.map((shoupai, playerIndex) => ({
                    l: playerIndex,
                    count: shoupai.nukidoraCount
                }));
            }
        }
        
        console.log(`[KITA-REPLACEMENT] Sending replacement zimo event, kita available: ${replacement === 'z4'}`);
        this.call_players('zimo', zimoMsg);

        if (this._view) this._view.update(zimoPaipu);
    }

    /**
     * 和牌。
     */
    hule() {
        console.log(`[HULE] Processing win condition`);
        let model = this._model;

        if (this._status != 'hule') {
            console.log(`[HULE] Closing wall, current status: ${this._status}`);
            model.shan.close();
            this._hule_option = this._status == 'gang'     ? 'qianggang'
                              : this._status == 'gangzimo' ? 'lingshang'
                              :                              null;
            console.log(`[HULE] Win option set to: ${this._hule_option}`);
        }

        let menfeng  = this._hule.length ? this._hule.shift() : model.lunban;
        let rongpai  = menfeng == model.lunban ? null
                     : (this._hule_option == 'qianggang'
                            ? this._gang[0] + this._gang.slice(-1)
                            : this._dapai.slice(0,2)
                       ) + '_+=-'[(4 + model.lunban - menfeng) % 4];
        let shoupai  = model.shoupai[menfeng].clone();
        let fubaopai = shoupai.lizhi ? model.shan.fubaopai : null;

        const winType = rongpai ? 'RON' : 'TSUMO';
        console.log(`[HULE] ${winType} win by player ${menfeng}`);
        console.log(`[HULE] Winning hand: ${shoupai.toString()}`);
        if (rongpai) {
            console.log(`[HULE] Ron tile: ${rongpai} from player ${model.lunban}`);
        }
        console.log(`[HULE] Current nukidora count: ${model.shan.nukidora.length}`);

        let param = {
            rule:           this._rule,
            zhuangfeng:     model.zhuangfeng,
            menfeng:        menfeng,
            hupai: {
                lizhi:      this._lizhi[menfeng],
                yifa:       this._yifa[menfeng],
                qianggang:  this._hule_option == 'qianggang',
                lingshang:  this._hule_option == 'lingshang',
                haidi:      model.shan.paishu > 0
                            || this._hule_option == 'lingshang' ? 0
                                : ! rongpai                     ? 1
                                :                                 2,
                tianhu:     (this._diyizimo && this.firstTurn && ! rongpai && model.lunban == menfeng)
                                ? (menfeng == 0 ? 1 : 2)
                                : 0,
                nukidora:   this.sanma ? shoupai.nukidoraCount : 0  // Add nukidora count for scoring
            },
            baopai:         model.shan.baopai,
            fubaopai:       fubaopai,
            nukidora:       model.shan.nukidora,
            jicun:          { changbang: model.changbang,
                              lizhibang: model.lizhibang },
            fang:           model.fang  // Add number of players for proper scoring
        };
        
        console.log(`[HULE] Calculating win with parameters:`, {
            winType,
            menfeng,
            rongpai,
            nukidoraCount: this.sanma ? shoupai.nukidoraCount : 0,
            baopaiCount: model.shan.baopai.length,
            riichi: this._lizhi[menfeng],
            firstTurn: this.firstTurn
        });
        
        const res = Majiang.Util.hule(shoupai, rongpai, param);
        
        if (!res) {
            console.log(`[HULE] ERROR: Win calculation failed!`);
            console.log(`[HULE] Hand details:`, {
                hand: shoupai.toString(),
                rongpai,
                menfeng,
                zhuangfeng: model.zhuangfeng
            });
            return;
        }
        
        console.log(`[HULE] Win calculation result:`, {
            fu: res.fu,
            fanshu: res.fanshu,
            damanguan: res.damanguan,
            defen: res.defen,
            fenpei: res.fenpei,
            hupai: res.hupai
        });

        if (this._rule['連荘方式'] > 0 && menfeng == 0) this._lianzhuang = true;
        if (this._rule['場数'] == 0) this._lianzhuang = false;
        this._fenpei = res.fenpei;

        let paipu = {
            hule: {
                l:          menfeng,
                shoupai:    rongpai ? shoupai.zimo(rongpai).toString()
                                    : shoupai.toString(),
                baojia:     rongpai ? model.lunban : null,
                fubaopai:   fubaopai,
                fu:         res.fu,
                fanshu:     res.fanshu,
                damanguan:  res.damanguan,
                defen:      res.defen,
                hupai:      res.hupai,
                fenpei:     res.fenpei
            }
        };
        for (let key of ['fu','fanshu','damanguan']) {
            if (! paipu.hule[key]) delete paipu.hule[key];
        }
        this.add_paipu(paipu);

        let msg = [];
        for (let l = 0; l < model.fang; l++) {
            msg[l] = JSON.parse(JSON.stringify(paipu));
            
            // Add nukidora information for sanma games
            if (this.sanma) {
                msg[l].nukidora = model.shoupai.map((shoupai, playerIndex) => ({
                    l: playerIndex,
                    count: shoupai.nukidoraCount
                }));
            }
        }
        console.log(`[HULE] Notifying all players of win by player ${menfeng}`);
        this.call_players('hule', msg, this._wait);

        if (this._view) this._view.update(paipu);
    }

    /**
     * 平局。
     * @param {string} name - 平局类型。
     * @param {Array} shoupai - 玩家手牌。
     */
    pingju(name, shoupai = ['','','','']) {
        let model = this._model;
        let fenpei = [0,0,0,0];

        if (!name) {
            let n_tingpai = 0;
            for (let l = 0; l < model.fang; l++) {
                if (this._rule['ノーテン宣言あり'] && ! shoupai[l] && ! model.shoupai[l].lizhi)
                    continue;
                if (!this._rule['ノーテン罰あり'] && (this._rule['連荘方式'] != 2 || l != 0)
                    && ! model.shoupai[l].lizhi)
                {
                    shoupai[l] = '';
                }
                else if (Majiang.Util.xiangting(model.shoupai[l]) == 0
                        && Majiang.Util.tingpai(model.shoupai[l]).length > 0)
                {
                    n_tingpai++;
                    shoupai[l] = model.shoupai[l].toString();
                    if (this._rule['連荘方式'] == 2 && l == 0)
                        this._lianzhuang = true;
                }
                else {
                    shoupai[l] = '';
                }
            }
            if (this._rule['流し満貫あり']) {
                for (let l = 0; l < model.fang; l++) {
                    let all_yaojiu = true;
                    for (let p of model.he[l]._pai) {
                        if (p.match(/[\+\=\-]$/)) { all_yaojiu = false; break }
                        if (p.match(/^z/))          continue;
                        if (p.match(/^[mps][19]/))  continue;
                        all_yaojiu = false; break;
                    }
                    if (all_yaojiu) {
                        name = '流し満貫';
                        for (let i = 0; i < model.fang; i++) {
                            fenpei[i] += l == 0 && i == l ? 12000
                                       : l == 0           ? -4000
                                       : l != 0 && i == l ?  8000
                                       : l != 0 && i == 0 ? -4000
                                       :                    -2000;
                        }
                    }
                }
            }
            if (! name) {
                name = '荒牌平局';
                if (this._rule['ノーテン罰あり']
                    && 0 < n_tingpai && n_tingpai < model.fang)
                {
                    for (let l = 0; l < model.fang; l++) {
                        fenpei[l] = shoupai[l] ?  3000 / n_tingpai
                                               : -3000 / (model.fang - n_tingpai);
                    }
                }
            }
            if (this._rule['連荘方式'] == 3) this._lianzhuang = true;
        }
        else {
            this._no_game    = true;
            this._lianzhuang = true;
        }

        if (this._rule['場数'] == 0) this._lianzhuang = true;

        this._fenpei = fenpei;

        let paipu = {
            pingju: { name: name, shoupai: shoupai, fenpei: fenpei }
        };
        this.add_paipu(paipu);

        const msg = [];
        for (let l = 0; l < model.fang; l++) {
            msg[l] = JSON.parse(JSON.stringify(paipu));
            
            // Add nukidora information for sanma games
            if (this.sanma) {
                msg[l].nukidora = model.shoupai.map((shoupai, playerIndex) => ({
                    l: playerIndex,
                    count: shoupai.nukidoraCount
                }));
            }
        }
        this.call_players('pingju', msg, this._wait);

        if (this._view) this._view.update(paipu);
    }

    /**
     * 结束当前局。
     */
    last() {
        let model = this._model;

        model.lunban = -1;
        if (this._view) this._view.update();

        if (!this._lianzhuang) {
            model.jushu++;
            model.zhuangfeng += (model.jushu / 4)|0;
            model.jushu = model.jushu % 4;
        }

        let jieju = false;
        let guanjun = -1;
        const defen = model.defen;
        for (let i = 0; i < model.fang; i++) {
            let id = (model.qijia + i) % 4;
            if (defen[id] < 0 && this._rule['トビ終了あり'])    jieju = true;
            if (defen[id] >= 30000
                && (guanjun < 0 || defen[id] > defen[guanjun])) guanjun = id;
        }

        let sum_jushu = model.zhuangfeng * 4 + model.jushu;

        if      (15 < sum_jushu)                                jieju = true;
        else if ((this._rule['場数'] + 1) * 4 - 1 < sum_jushu)  jieju = true;
        else if (this._max_jushu < sum_jushu) {
            if      (this._rule['延長戦方式'] == 0)             jieju = true;
            else if (this._rule['場数'] == 0)                   jieju = true;
            else if (guanjun >= 0)                              jieju = true;
            else {
                this._max_jushu += this._rule['延長戦方式'] == 3 ? 4
                                 : this._rule['延長戦方式'] == 2 ? 1
                                 :                                 0;
            }
        }
        else if (this._max_jushu == sum_jushu) {
            if (this._rule['オーラス止めあり'] && guanjun == model.player_id[0]
                && this._lianzhuang && ! this._no_game)         jieju = true;
        }

        if (jieju)  this.delay(()=>this.jieju(), 0);
        else        this.delay(()=>this.qipai(), 0);
    }

    /**
     * 结束游戏。
     */
    jieju() {
        let model = this._model;

        let paiming = [];
        const defen = model.defen;
        for (let i = 0; i < model.fang; i++) {
            let id = (model.qijia + i) % 4;
            for (let j = 0; j < 4; j++) {
                if (j == paiming.length || defen[id] > defen[paiming[j]]) {
                    paiming.splice(j, 0, id);
                    break;
                }
            }
        }
        defen[paiming[0]] += model.lizhibang * 1000;
        this._paipu.defen = defen;

        let rank = [0,0,0,0];
        for (let i = 0; i < model.fang; i++) {
            rank[paiming[i]] = i + 1;
        }
        this._paipu.rank = rank;

        const round = ! this._rule['順位点'].find(p=>p.match(/\.\d$/));
        let point = [0,0,0,0];
        for (let i = 1; i < model.fang; i++) {
            let id = paiming[i];
            point[id] = (defen[id] - 30000) / 1000
                      + + this._rule['順位点'][i];
            if (round) point[id] = Math.round(point[id]);
            point[paiming[0]] -= point[id];
        }
        this._paipu.point = point.map(p=> p.toFixed(round ? 0 : 1));

        let paipu = { jieju: this._paipu };

        const msg = [];
        for (let l = 0; l < model.fang; l++) {
            msg[l] = JSON.parse(JSON.stringify(paipu));
            
            // Add final nukidora counts for sanma games
            if (this.sanma) {
                msg[l].nukidora = model.shoupai.map((shoupai, playerIndex) => ({
                    l: playerIndex,
                    count: shoupai.nukidoraCount
                }));
            }
        }
        this.call_players('jieju', msg, this._wait);

        if (this._view) this._view.summary(this._paipu);

        if (this._handler) this._handler();
    }

    /**
     * 获取玩家的回复。
     * @param {number} l - 玩家索引。
     * @return {Object} 玩家回复。
     */
    get_reply(l) {
        let model = this._model;
        return this._reply[model.player_id[l]] || {};
    }

    /**
     * 处理开局回复。
     */
    reply_kaiju() { this.delay(()=>this.qipai(), 0) }

    /**
     * 处理起牌回复。
     */
    reply_qipai() { 
        const model = this._model;
        
        // Check for starting hand kita actions
        let anyKitaPerformed = false;
        for (let l = 0; l < model.fang; l++) {
            const reply = this.get_reply(l);
            if (reply.kita && this.allow_kita(l)) {
                console.log(`[REPLY-QIPAI] Player ${l} performed starting hand kita: ${reply.kita}`);
                this.kita(reply.kita, l);
                anyKitaPerformed = true;
            }
        }
        
        if (anyKitaPerformed) {
            console.log(`[REPLY-QIPAI] Starting hand kita actions completed, proceeding to first zimo`);
        }
        
        this.delay(()=>this.zimo(), 0) 
    }

    /**
     * 处理自摸回复。
     */
    reply_zimo() {
        let model = this._model;
        let reply = this.get_reply(model.lunban);
        
        console.log(`[REPLY-ZIMO] Processing reply from player ${model.lunban}:`, reply);
        console.log(`[REPLY-ZIMO] Player ${model.lunban} current hand: ${model.shoupai[model.lunban].toString()}`);
        
        // Handle kita action (high priority after hule)
        if (reply.kita) {
            console.log(`[REPLY-ZIMO] Player ${model.lunban} requested kita action: ${reply.kita}`);
            
            const kitaAllowed = this.allow_kita();
            const kitaOptions = this.get_kita_options();
            console.log(`[REPLY-ZIMO] Kita allowed: ${kitaAllowed}, available options:`, kitaOptions);
            
            if (kitaAllowed && kitaOptions.includes(reply.kita)) {
                console.log(`[REPLY-ZIMO] Kita action approved, executing kita`);
                this.say('kita', model.lunban);
                return this.delay(() => this.kita(reply.kita));
            } else {
                console.log(`[REPLY-ZIMO] Kita action rejected - not allowed or invalid option`);
            }
        }
        
        if (reply.daopai) {
            console.log(`[REPLY-ZIMO] Player ${model.lunban} declared daopai (nine terminals)`);
            if (this.allow_pingju()) {
                let shoupai = ['','','',''];
                shoupai[model.lunban] = model.shoupai[model.lunban].toString();
                console.log(`[REPLY-ZIMO] Daopai approved, ending game with nine terminals`);
                return this.delay(()=>this.pingju('九種九牌', shoupai), 0);
            } else {
                console.log(`[REPLY-ZIMO] Daopai rejected - conditions not met`);
            }
        }
        else if (reply.hule) {
            console.log(`[REPLY-ZIMO] Player ${model.lunban} declared tsumo win`);
            if (this.allow_hule()) {
                console.log(`[REPLY-ZIMO] Tsumo approved, player wins!`);
                this.say('zimo', model.lunban);
                return this.delay(()=>this.hule());
            } else {
                console.log(`[REPLY-ZIMO] Tsumo rejected - win conditions not met`);
            }
        }
        else if (reply.gang) {
            console.log(`[REPLY-ZIMO] Player ${model.lunban} requested gang: ${reply.gang}`);
            const availableGang = this.get_gang_mianzi();
            console.log(`[REPLY-ZIMO] Available gang options:`, availableGang);
            
            if (availableGang.find(m => m == reply.gang)) {
                console.log(`[REPLY-ZIMO] Gang approved, executing gang`);
                this.say('gang', model.lunban);
                return this.delay(()=>this.gang(reply.gang));
            } else {
                console.log(`[REPLY-ZIMO] Gang rejected - not a valid gang option`);
            }
        }
        else if (reply.dapai) {
            let dapai = reply.dapai.replace(/\*$/,'');
            console.log(`[REPLY-ZIMO] Player ${model.lunban} chose to discard: ${dapai}`);
            
            const possibleDapai = this.get_dapai() || [];
            console.log(`[REPLY-ZIMO] Possible discard options:`, possibleDapai);
            
            if (possibleDapai.find(p => p == dapai)) {
                if (reply.dapai.slice(-1) == '*' && this.allow_lizhi(dapai)) {
                    console.log(`[REPLY-ZIMO] Riichi discard approved`);
                    this.say('lizhi', model.lunban);
                    return this.delay(()=>this.dapai(reply.dapai));
                }
                console.log(`[REPLY-ZIMO] Normal discard approved`);
                return this.delay(()=>this.dapai(dapai), 0);
            } else {
                console.log(`[REPLY-ZIMO] Discard rejected - not a valid option`);
            }
        }

        console.log(`[REPLY-ZIMO] No valid action found, auto-discarding last tile`);
        let p = this.get_dapai().pop();
        console.log(`[REPLY-ZIMO] Auto-discarding: ${p}`);
        this.delay(()=>this.dapai(p), 0);
    }

    /**
     * 处理打牌回复。
     */
    reply_dapai() {
        let model = this._model;

        for (let i = 1; i < model.fang; i++) {
            let l = (model.lunban + i) % model.fang;
            let reply = this.get_reply(l) || {};
            if (reply.hule && this.allow_hule(l)) {
                if (this._rule['最大同時和了数'] == 1  && this._hule.length)
                    continue;
                this.say('rong', l);
                this._hule.push(l);
            }
            else {
                let shoupai = model.shoupai[l].clone().zimo(this._dapai);
                if (Majiang.Util.xiangting(shoupai) == -1)
                    this._neng_rong[l] = false;
            }
        }
        if (this._hule.length == 3 && this._rule['最大同時和了数'] == 2) {
            let shoupai = ['','','',''];
            for (let l of this._hule) {
                shoupai[l] = model.shoupai[l].toString();
            }
            return this.delay(()=>this.pingju('三家和', shoupai));
        }
        else if (this._hule.length) {
            return this.delay(()=>this.hule());
        }

        if (this._dapai.slice(-1) == '*') {
            model.defen[model.player_id[model.lunban]] -= 1000;
            model.lizhibang++;

            if (this._lizhi.filter(x=>x).length == 4 && this._rule['途中流局あり'])
            {
                let shoupai = model.shoupai.map(s=>s.toString());
                return this.delay(()=>this.pingju('四家立直', shoupai));
            }
        }

        if (this._diyizimo && model.lunban == 3) {
            this._diyizimo = false;
            if (this._fengpai) {
                return this.delay(()=>this.pingju('四風連打'), 0);
            }
        }

        if (this._n_gang.reduce((x, y)=> x + y) == 4) {
            if (Math.max(...this._n_gang) < 4 && this._rule['途中流局あり']) {
                return this.delay(()=>this.pingju('四開槓'), 0);
            }
        }

        if (!model.shan.paishu) {
            let shoupai = ['','','',''];
            for (let l = 0; l < model.fang; l++) {
                let reply = this.get_reply(l);
                if (reply.daopai) shoupai[l] = reply.daopai;
            }
            return this.delay(()=>this.pingju('', shoupai), 0);
        }

        for (let i = 1; i < model.fang; i++) {
            let l = (model.lunban + i) % model.fang;
            let reply = this.get_reply(l);
            if (reply.fulou) {
                let m = reply.fulou.replace(/0/g,'5');
                if (m.match(/^[mpsz](\d)\1\1\1/)) {
                    if (this.get_gang_mianzi(l).find(m => m == reply.fulou)) {
                        this.say('gang', l);
                        return this.delay(()=>this.fulou(reply.fulou));
                    }
                }
                else if (m.match(/^[mpsz](\d)\1\1/)) {
                    if (this.get_peng_mianzi(l).find(m => m == reply.fulou)) {
                        this.say('peng', l);
                        return this.delay(()=>this.fulou(reply.fulou));
                    }
                }
            }
        }
        let l = (model.lunban + 1) % model.fang;
        let reply = this.get_reply(l);
        if (reply.fulou) {
            if (this.get_chi_mianzi(l).find(m => m == reply.fulou)) {
                this.say('chi', l);
                return this.delay(()=>this.fulou(reply.fulou));
            }
        }

        this.delay(()=>this.zimo(), 0);
    }

    /**
     * 处理副露回复。
     */
    reply_fulou() {
        let model = this._model;

        if (this._gang) {
            return this.delay(()=>this.gangzimo(), 0);
        }

        let reply = this.get_reply(model.lunban);
        if (reply.dapai) {
            if (this.get_dapai().find(p => p == reply.dapai)) {
                return this.delay(()=>this.dapai(reply.dapai), 0);
            }
        }

        let p = this.get_dapai().pop();
        this.delay(()=>this.dapai(p), 0);
    }

    /**
     * 处理杠牌回复。
     */
    reply_gang() {
        let model = this._model;

        if (this._gang.match(/^[mpsz]\d{4}$/)) {
            return this.delay(()=>this.gangzimo(), 0);
        }

        for (let i = 1; i < model.fang; i++) {
            let l = (model.lunban + i) % model.fang;
            let reply = this.get_reply(l);
            if (reply.hule && this.allow_hule(l)) {
                if (this._rule['最大同時和了数'] == 1  && this._hule.length)
                    continue;
                this.say('rong', l);
                this._hule.push(l);
            }
            else {
                let p = this._gang[0] + this._gang.slice(-1);
                let shoupai = model.shoupai[l].clone().zimo(p);
                if (Majiang.Util.xiangting(shoupai) == -1)
                    this._neng_rong[l] = false;
            }
        }
        if (this._hule.length) {
            return this.delay(()=>this.hule());
        }

        this.delay(()=>this.gangzimo(), 0);
    }

    /**
     * 处理和牌回复。
     */
    reply_hule() {
        let model = this._model;

        for (let l = 0; l < model.fang; l++) {
            model.defen[model.player_id[l]] += this._fenpei[l];
        }
        model.changbang = 0;
        model.lizhibang = 0;

        if (this._hule.length) {
            return this.delay(()=>this.hule());
        }
        else {
            if (this._lianzhuang) model.changbang = this._changbang + 1;
            return this.delay(()=>this.last(), 0);
        }
    }

    /**
     * 处理kita操作回复。
     */
    reply_kita() {
        // Kita是单人操作，无需等待其他玩家回复，直接继续到替换牌摸取
        this.delay(() => this.kita_replacement(), 0);
    }

    /**
     * 处理平局回复。
     */
    reply_pingju() {
        let model = this._model;

        for (let l = 0; l < model.fang; l++) {
            model.defen[model.player_id[l]] += this._fenpei[l];
        }
        model.changbang++;

        this.delay(()=>this.last(), 0);
    }

    /**
     * 获取可能的打牌。
     * @return {Array} 可能的打牌。
     */
    get_dapai() {
        let model = this._model;
        return Game.get_dapai(this._rule, model.shoupai[model.lunban]);
    }

    /**
     * 获取可能的吃牌面子。
     * @param {number} l - 玩家索引。
     * @return {Array} 可能的吃牌面子。
     */
    get_chi_mianzi(l) {
        let model = this._model;
        let d = '_+=-'[(4 + model.lunban - l) % 4];
        return Game.get_chi_mianzi(this._rule, model.shoupai[l], this._dapai + d, model.shan.paishu);
    }

    /**
     * 获取可能的碰牌面子。
     * @param {number} l - 玩家索引。
     * @return {Array} 可能的碰牌面子。
     */
    get_peng_mianzi(l) {
        let model = this._model;
        let d = '_+=-'[(4 + model.lunban - l) % 4];
        return Game.get_peng_mianzi(this._rule, model.shoupai[l], this._dapai + d, model.shan.paishu);
    }

    /**
     * 获取可能的杠牌面子。
     * @param {number} l - 玩家索引。
     * @return {Array} 可能的杠牌面子。
     */
    get_gang_mianzi(l) {
        let model = this._model;
        if (l == null) {
            return Game.get_gang_mianzi(this._rule, model.shoupai[model.lunban],
                                        null, model.shan.paishu,
                                        this._n_gang.reduce((x, y)=> x + y));
        }
        else {
            let d = '_+=-'[(4 + model.lunban - l) % 4];
            return Game.get_gang_mianzi(this._rule, model.shoupai[l],
                                        this._dapai + d, model.shan.paishu,
                                        this._n_gang.reduce((x, y)=> x + y));
        }
    }

    /**
     * 检查玩家是否可以立直。
     * @param {string} p - 打出的牌。
     * @return {boolean} 如果玩家可以立直则返回true，否则返回false。
     */
    allow_lizhi(p) {
        let model = this._model;
        return Game.allow_lizhi(this._rule, model.shoupai[model.lunban],
                                p, model.shan.paishu,
                                model.defen[model.player_id[model.lunban]]);
    }

    /**
     * 检查玩家是否可以和牌。
     * @param {number} l - 玩家索引。
     * @return {boolean} 如果玩家可以和牌则返回true，否则返回false。
     */
    allow_hule(l) {
        let model = this._model;
        if (l == null) {
            let hupai = model.shoupai[model.lunban].lizhi
                     || this._status == 'gangzimo'
                     || model.shan.paishu == 0;
            return Game.allow_hule(this._rule,
                                   model.shoupai[model.lunban], null,
                                   model.zhuangfeng, model.lunban, hupai);
        }
        else {
            let p = (this._status == 'gang'
                        ? this._gang[0] + this._gang.slice(-1)
                        : this._dapai
                    ) + '_+=-'[(4 + model.lunban - l) % 4];
            let hupai = model.shoupai[l].lizhi
                     || this._status == 'gang'
                     || model.shan.paishu == 0;
            return Game.allow_hule(this._rule,
                                   model.shoupai[l], p,
                                   model.zhuangfeng, l, hupai,
                                   this._neng_rong[l]);
        }
    }

    /**
     * 检查玩家是否可以平局。
     * @return {boolean} 如果玩家可以平局则返回true，否则返回false。
     */
    allow_pingju() {
        let model = this._model;
        return Game.allow_pingju(this._rule, model.shoupai[model.lunban], this._diyizimo);
    }

    /**
     * 检查当前玩家是否可以进行kita操作（抜きドラ）
     * @param {number} l - 玩家索引，如果不提供则使用当前玩家
     * @return {boolean} 如果可以进行kita则返回true，否则返回false
     */
    allow_kita(l = null) {
        const model = this._model;
        const playerIndex = l !== null ? l : model.lunban;
        
        console.log(`[ALLOW-KITA] Checking kita availability for player ${playerIndex}`);
        console.log(`[ALLOW-KITA] Sanma mode: ${this.sanma}`);
        console.log(`[ALLOW-KITA] Game status: ${this._status}`);
        console.log(`[ALLOW-KITA] Current lunban: ${model.lunban}`);
        
        if (!this.sanma) {
            console.log(`[ALLOW-KITA] Kita not available - not in sanma mode`);
            return false;
        }

        // Detailed debugging of hand state
        const shoupai = model.shoupai[playerIndex];
        const bingpaiZ4Count = shoupai._bingpai.z[4];
        const zimoTile = shoupai._zimo;
        const zimoIsZ4 = zimoTile === 'z4';
        const totalZ4Count = shoupai.getTotalZ4Count();
        
        console.log(`[ALLOW-KITA] Player ${playerIndex} hand details:`);
        console.log(`[ALLOW-KITA]   - Full hand: ${shoupai.toString()}`);
        console.log(`[ALLOW-KITA]   - z4 tiles in bingpai: ${bingpaiZ4Count}`);
        console.log(`[ALLOW-KITA]   - Zimo tile: ${zimoTile}`);
        console.log(`[ALLOW-KITA]   - Zimo is z4: ${zimoIsZ4}`);
        console.log(`[ALLOW-KITA]   - Total z4 count: ${totalZ4Count}`);
        console.log(`[ALLOW-KITA]   - Current nukidora count: ${shoupai.nukidoraCount}`);

        // Special handling for starting hand kita (during qipai phase)
        if (this._status === 'qipai' || model.lunban === -1) {
            const hasZ4InHand = totalZ4Count > 0;
            console.log(`[ALLOW-KITA] Starting hand check - player ${playerIndex} has z4: ${hasZ4InHand}`);
            return hasZ4InHand;
        }
        
        // Normal kita check - can do kita if it's their turn and they have any z4 tiles
        if (playerIndex !== model.lunban) {
            console.log(`[ALLOW-KITA] Kita not available - not current player's turn (requested: ${playerIndex}, current: ${model.lunban})`);
            return false;
        }
        
        // Player can do kita if they have any z4 tiles (in bingpai or as zimo)
        if (totalZ4Count > 0) {
            console.log(`[ALLOW-KITA] Kita is available! Player has ${totalZ4Count} z4 tile(s)`);
            console.log(`[ALLOW-KITA]   - ${bingpaiZ4Count} in bingpai + ${zimoIsZ4 ? 1 : 0} in zimo = ${totalZ4Count} total`);
            return true;
        } else {
            console.log(`[ALLOW-KITA] Kita not available - no z4 tiles in hand`);
            return false;
        }
    }

    /**
     * 获取指定玩家可进行的kita选项
     * @param {number} l - 玩家索引，如果不提供则使用当前玩家
     * @return {Array<string>} kita选项数组
     */
    get_kita_options(l = null) {
        const playerIndex = l !== null ? l : this._model.lunban;
        const options = this.allow_kita(l) ? ['z4'] : [];
        console.log(`[KITA-OPTIONS] Available kita options for player ${playerIndex}:`, options);
        return options;
    }

    /**
     * 正确计算手牌中的瓦片数量
     * @param {Object} shoupai - 玩家手牌对象
     * @return {number} 手牌中的瓦片总数
     */
    countTilesInHand(shoupai) {
        let count = 0;
        
        // Count tiles in bingpai (closed hand)
        for (let suit of ['m', 'p', 's', 'z']) {
            for (let i = 1; i <= 9; i++) {
                if (shoupai._bingpai[suit] && shoupai._bingpai[suit][i]) {
                    count += shoupai._bingpai[suit][i];
                }
            }
        }
        
        // Count zimo tile
        if (shoupai._zimo) {
            count += 1;
        }
        
        // Count fulou (open melds) - each meld has 3 or 4 tiles
        if (shoupai._fulou) {
            for (let meld of shoupai._fulou) {
                if (meld.match(/^[mpsz]\d{4}/)) {
                    count += 4; // Kong (gang)
                } else {
                    count += 3; // Pon/Chi
                }
            }
        }
        
        return count;
    }

    /**
     * 检查玩家是否可以宣告无听。
     * @param {Object} rule - 游戏规则。
     * @param {Object} shoupai - 玩家手牌。
     * @param {number} paishu - 剩余牌数。
     * @return {boolean} 如果玩家可以宣告无听则返回true，否则返回false。
     */
    static allow_no_daopai(rule, shoupai, paishu) {
        if (paishu > 0 || shoupai._zimo) return false;
        if (! rule['ノーテン宣言あり']) return false;
        if (shoupai.lizhi) return false;

        return Majiang.Util.xiangting(shoupai) == 0
                && Majiang.Util.tingpai(shoupai).length > 0;
    }

    static get_dapai(rule, shoupai) {
        if (rule['喰い替え許可レベル'] == 0) return shoupai.get_dapai(true);
        if (rule['喰い替え許可レベル'] == 1 && shoupai._zimo && shoupai._zimo.length > 2) {
            const deny = shoupai._zimo[0] + (+shoupai._zimo.match(/\d(?=[\+\=\-])/)||5);
            return shoupai.get_dapai(false).filter(p => p.replace(/0/,'5') != deny);
        }
        return shoupai.get_dapai(false);
    }

    static get_chi_mianzi(rule, shoupai, p, paishu) {
        if (rule['mode'] == 'sanma') return [];
        let mianzi = shoupai.get_chi_mianzi(p, rule['喰い替え許可レベル'] == 0);
        if (!mianzi) return mianzi;
        if (rule['喰い替え許可レベル'] == 1 && shoupai._fulou.length == 3 && shoupai._bingpai[p[0]][p[1]] == 2)
            mianzi = [];
        return paishu == 0 ? [] : mianzi;
    }

    static get_peng_mianzi(rule, shoupai, p, paishu) {
        let mianzi = shoupai.get_peng_mianzi(p);
        if (!mianzi) return mianzi;
        return paishu == 0 ? [] : mianzi;
    }

    static get_gang_mianzi(rule, shoupai, p, paishu, n_gang) {
        let mianzi = shoupai.get_gang_mianzi(p);
        if (!mianzi || mianzi.length == 0) return mianzi;

        if (shoupai.lizhi) {
            if (rule['リーチ後暗槓許可レベル'] == 0) return [];
            else if (rule['リーチ後暗槓許可レベル'] == 1) {
                let new_shoupai, n_hule1 = 0, n_hule2 = 0;
                new_shoupai = shoupai.clone().dapai(shoupai._zimo);
                for (let p of Majiang.Util.tingpai(new_shoupai)) {
                    n_hule1 += Majiang.Util.hule_mianzi(new_shoupai, p).length;
                }
                new_shoupai = shoupai.clone().gang(mianzi[0]);
                for (let p of Majiang.Util.tingpai(new_shoupai)) {
                    n_hule2 += Majiang.Util.hule_mianzi(new_shoupai, p).length;
                }
                if (n_hule1 > n_hule2) return [];
            }
            else {
                let new_shoupai;
                new_shoupai = shoupai.clone().dapai(shoupai._zimo);
                let n_tingpai1 = Majiang.Util.tingpai(new_shoupai).length;
                new_shoupai = shoupai.clone().gang(mianzi[0]);
                if (Majiang.Util.xiangting(new_shoupai) > 0) return [];
                let n_tingpai2 = Majiang.Util.tingpai(new_shoupai).length;
                if (n_tingpai1 > n_tingpai2) return [];
            }
        }
        return paishu == 0 || n_gang == 4 ? [] : mianzi;
    }

    static allow_lizhi(rule, shoupai, p, paishu, defen) {
        if (!shoupai._zimo) return false;
        if (shoupai.lizhi) return false;
        if (!shoupai.menqian) return false;
        if (!rule['ツモ番なしリーチあり'] && paishu < 4) return false;
        if (rule['トビ終了あり'] && defen < 1000) return false;
        if (Majiang.Util.xiangting(shoupai) > 0) return false;
        if (p) {
            let new_sp = shoupai.clone().dapai(p);
            return Majiang.Util.xiangting(new_sp) == 0 && Majiang.Util.tingpai(new_sp).length > 0;
        } else {
            let dapai = [];
            for (let p of Game.get_dapai(rule, shoupai)) {
                let new_sp = shoupai.clone().dapai(p);
                if (Majiang.Util.xiangting(new_sp) == 0 && Majiang.Util.tingpai(new_sp).length > 0) dapai.push(p);
            }
            return dapai.length ? dapai : false;
        }
    }

    static allow_hule(rule, shoupai, p, zhuangfeng, menfeng, hupai, neng_rong) {
        if (p && !neng_rong) return false;
        let new_sp = shoupai.clone(); if (p) new_sp.zimo(p);
        if (Majiang.Util.xiangting(new_sp) != -1) return false;

        // do NOT short-circuit on hupai flag; always verify with Util.hule
        // hupai flag may still influence scoring (tianhu etc.) but must not bypass legality check
        const param = { rule, zhuangfeng, menfeng, hupai:{}, baopai:[], jicun:{ changbang:0, lizhibang:0 } };
        const res = Majiang.Util.hule(shoupai, p, param);
        if (!res) {
            console.error('[HULE-CHECK-FAIL]',
                { hand: shoupai.toString(), rongpai: p, menfeng, zhuangfeng, hupaiFlag: hupai });
            return false;
        }
        return res.hupai != null;
    }

    static allow_pingju(rule, shoupai, diyizimo) {
        if (!(diyizimo && shoupai._zimo)) return false;
        if (!rule['途中流局あり']) return false;
        let n_yaojiu = 0;
        for (let s of ['m','p','s','z']) {
            let bp = shoupai._bingpai[s];
            let nn = (s == 'z') ? [1,2,3,4,5,6,7] : [1,9];
            for (let n of nn) if (bp[n] > 0) n_yaojiu++;
        }
        return n_yaojiu >= 9;
    }

    static allow_no_daopai(rule, shoupai, paishu) {
        if (paishu > 0 || shoupai._zimo) return false;
        if (!rule['ノーテン宣言あり']) return false;
        if (shoupai.lizhi) return false;
        return Majiang.Util.xiangting(shoupai) == 0 && Majiang.Util.tingpai(shoupai).length > 0;
    }
}

