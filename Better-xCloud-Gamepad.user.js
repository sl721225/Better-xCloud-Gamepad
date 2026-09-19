// ==UserScript==
// @name         Better xCloud Gamepad v14 (模組重建版)
// @namespace    http://tampermonkey.net/
// @version      14.1.0
// @description  獨立輸入來源、類比巨集、六組佈局、賽車與極簡 HUD。安裝前請停用舊版。
// @author       You
// @match        *://*.xbox.com/*
// @run-at       document-idle
// @grant        none
// @noframes
// ==/UserScript==

/*
 * v14.1.0 — 完整單檔，無外部相依。頂部巨集、說明開關、巨集命名與 JSON 備份／還原。
 * 沿用 v14 的儲存 key。備份檔只包含巨集，不包含佈局／介面設定。
 * 設定：better_xcloud_gamepad_v14；首次讀入 v13/v12，舊資料不覆寫。
 * F2 / L3+R3 1.5秒：有鎖定/連發則解除，否則收合/展開。
 * 紅色「全停」：停止巨集、AFK、連發、鎖定與手動輸入。
 * 安全性：切模式、進入佈局編輯、失焦或切到背景時釋放輸入並停止自動操作。
 * 類比軸仲裁：手動 > 巨集 > AFK；按鍵取各來源最大值。
 * 實體手把只讀取監控，不複製進虛擬手把，避免雙重輸入。
 */
(function () {
    'use strict';
    const VERSION = '14.1.0';
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(Number(v)) ? Number(v) : 0));
    const clone = value => JSON.parse(JSON.stringify(value));
    const slots = factory => Object.fromEntries(Array.from({length: 6}, (_, i) => [i + 1, factory()]));
    const blank = () => ({buttons: Array(17).fill(0), axes: Array(4).fill(0)});
    const LABELS = ['A','B','X','Y','LB','RB','LT','RT','View','Menu','L3','R3','▲','▼','◀','▶','Xbox'];
    const GROUPS = {'0':'face','1':'face','2':'face','3':'face','12':'dpad','13':'dpad','14':'dpad','15':'dpad',
        '8':'center','9':'center','4':'leftTop','6':'leftTop','5':'rightTop','7':'rightTop',
        stick_0:'leftStick','10':'leftStick',stick_2:'rightStick','11':'rightStick'};
    const DEFAULTS = () => ({delay:3000, bgTrans:false, afkAmp:0.2, gameMode:'standard', comboTaps:false, racingAutoFade:true, showHelp:true,
        splitMode:false, uiScale:1, showViewer:false, viewerScale:0.8, viewerPos:{x:'20px',y:'20px'},
        panelPos:null, layoutSlot:1, layouts:slots(() => ({})), macros:slots(() => ({name:'',duration:0,events:[]}))});

    class ConfigStore {
        constructor(storage, warn = console.warn) {
            this.storage = storage; this.warn = warn; this.key = 'better_xcloud_gamepad_v14';
            this.prefs = DEFAULTS(); this.writable = true; this.load();
        }
        sanitize(data) {
            const p = DEFAULTS(); const d = data && typeof data === 'object' ? data : {};
            ['bgTrans','comboTaps','splitMode','showViewer','racingAutoFade','showHelp'].forEach(k => {if (typeof d[k] === 'boolean') p[k]=d[k];});
            p.delay = d.delay == null ? p.delay : clamp(d.delay,100,10000);
            p.afkAmp = d.afkAmp == null ? p.afkAmp : clamp(d.afkAmp,0.1,0.5);
            p.gameMode = d.gameMode === 'racing' ? 'racing' : 'standard';
            p.uiScale = [0.8,1,1.2,1.5].includes(Number(d.uiScale)) ? Number(d.uiScale) : 1;
            p.viewerScale = [0.6,0.8,1,1.2].includes(Number(d.viewerScale)) ? Number(d.viewerScale) : 0.8;
            p.layoutSlot = Math.round(clamp(d.layoutSlot || 1,1,6));
            const point = v => v && Number.isFinite(parseFloat(v.x)) && Number.isFinite(parseFloat(v.y))
                ? {x:`${clamp(parseFloat(v.x),-20000,20000)}px`,y:`${clamp(parseFloat(v.y),-20000,20000)}px`} : null;
            p.viewerPos = point(d.viewerPos) || p.viewerPos; p.panelPos = point(d.panelPos);
            for (let s=1;s<=6;s++) {
                const layout = d.layouts?.[s];
                for (const id of [...Object.keys(GROUPS),'16']) {
                    const pos = layout?.[id];
                    if (pos && Number.isFinite(Number(pos.x)) && Number.isFinite(Number(pos.y)))
                        p.layouts[s][id]={x:clamp(pos.x,-10000,10000),y:clamp(pos.y,-10000,10000)};
                }
                const m = d.macros?.[s];
                if (m && Array.isArray(m.events)) {
                    const events = m.events.filter(e => e && ['btn','axis'].includes(e.type) && Number.isInteger(e.id)
                        && e.id>=0 && e.id<(e.type==='btn'?17:4) && Number.isFinite(e.t) && e.t>=0 && Number.isFinite(e.val))
                        .map(e=>({t:e.t,type:e.type,id:e.id,val:clamp(e.val,e.type==='btn'?0:-1,1)})).sort((a,b)=>a.t-b.t);
                    p.macros[s]={name:typeof m.name==='string'?m.name.trim().slice(0,60):'',events,duration:Math.max(0,Number.isFinite(m.duration)?m.duration:0,events.at(-1)?.t||0)};
                }
            }
            return p;
        }
        load() {
            for (const key of [this.key,'better_xcloud_gamepad','xcloud_gamepad_prefs_v12_4']) {
                let raw;
                try {raw=this.storage.getItem(key);} catch (e) {this.writable=false; this.warn('無法讀取設定，使用暫存設定。',e); return;}
                if (!raw) continue;
                try {
                    const doc = JSON.parse(raw);
                    if (key===this.key && doc.version>14) {this.writable=false; this.warn('設定來自較新版本，停止覆寫。');}
                    this.prefs=this.sanitize(doc.settings || doc); return;
                } catch (e) {this.warn(`設定 ${key} 無法解析；保留原始內容。`,e); if(key===this.key) this.writable=false;}
            }
        }
        save() {
            if(!this.writable) return false;
            try {this.storage.setItem(this.key,JSON.stringify({version:14,build:VERSION,settings:this.prefs})); return true;}
            catch(e) {this.warn('設定儲存失敗；目前操作仍可使用，請勿重新整理。',e); return false;}
        }
    }

    class InputManager {
        constructor(clock = () => performance.now()) {this.clock=clock; this.sources=new Map(); this.sequence=0; this.onChange=null;}
        source(key, priority=40) {
            if(!this.sources.has(key)) this.sources.set(key,{buttons:new Map(),axes:new Map(),priority,order:++this.sequence});
            return this.sources.get(key);
        }
        set(key,type,id,val,priority=40) {
            if(!Number.isInteger(id)||id<0||id>=(type==='btn'?17:4)) return;
            const s=this.source(key,priority); const map=type==='btn'?s.buttons:s.axes;
            const value=clamp(val,type==='btn'?0:-1,1);
            if(map.get(id)===value) return;
            map.set(id,value); s.order=++this.sequence; this.onChange?.();
        }
        clear(key) {if(this.sources.delete(key)) this.onChange?.();}
        clearAll() {this.sources.clear(); this.onChange?.();}
        snapshot(filter = () => true) {
            const out=blank(); const winners=Array(4).fill(null);
            for(const [key,s] of this.sources) {
                if(!filter(key)) continue;
                for(const [id,v] of s.buttons) out.buttons[id]=Math.max(out.buttons[id],v);
                for(const [id,v] of s.axes) {
                    const old=winners[id];
                    if(!old||s.priority>old.priority||(s.priority===old.priority&&s.order>old.order)) {out.axes[id]=v; winners[id]=s;}
                }
            }
            return out;
        }
        recordingState() {return this.snapshot(key=>key!=='macro'&&key!=='afk');}
    }

    class VirtualGamepad {
        constructor(input, nav, target) {
            this.input=input; this.nav=nav; this.target=target; this.original=nav.getGamepads;
            this.descriptor=Object.getOwnPropertyDescriptor(nav,'getGamepads'); this.slot=null;
            this.pad={id:'Xbox 360 Controller',index:0,mapping:'standard',connected:false,timestamp:0,
                buttons:Array.from({length:17},()=>({value:0,pressed:false,touched:false})),axes:[0,0,0,0]};
        }
        readPhysical() {try {return this.original ? Array.from(this.original.call(this.nav)) : [];} catch {return [];}}
        event(type) {
            // GamepadEvent 的 constructor 不接受純 JS gamepad；使用帶有 gamepad 欄位的 Event。
            const e=new Event(type); Object.defineProperty(e,'gamepad',{value:this.pad}); this.target.dispatchEvent(e);
        }
        sync(pads) {
            if(this.slot===null||pads[this.slot]) {
                if(this.pad.connected) {this.pad.connected=false; this.event('gamepaddisconnected');}
                let free=Array.from({length:Math.max(4,pads.length+1)},(_,i)=>i).find(i=>!pads[i]);
                this.slot=free; this.pad.index=free; this.pad.connected=true;
                this.event('gamepadconnected');
            }
            const state=this.input.snapshot(); let changed=false;
            state.buttons.forEach((v,i)=>{const b=this.pad.buttons[i]; if(b.value!==v) changed=true;
                b.value=v; b.touched=v>0; b.pressed=v>0.05;});
            state.axes.forEach((v,i)=>{if(this.pad.axes[i]!==v) changed=true; this.pad.axes[i]=v;});
            if(changed||!this.pad.timestamp) this.pad.timestamp=this.input.clock();
        }
        install() {
            this.hook=()=>{const pads=this.readPhysical(); this.sync(pads); pads[this.slot]=this.pad; return pads;};
            Object.defineProperty(this.nav,'getGamepads',{value:this.hook,configurable:true,writable:true});
            this.sync(this.readPhysical());
        }
        destroy() {
            if(this.nav.getGamepads===this.hook) {
                if(this.descriptor) Object.defineProperty(this.nav,'getGamepads',this.descriptor);
                else delete this.nav.getGamepads;
            }
            if(this.pad.connected) {this.pad.connected=false; this.event('gamepaddisconnected');}
        }
    }

    class PhysicalGamepadMonitor {
        constructor(virtual) {this.virtual=virtual; this.state=blank(); this.lastActivity=-Infinity; this.active=false; this.connected=false; this.id=''; this.lastIndex=null;}
        poll(now) {
            const pads=this.virtual.readPhysical().filter(p=>p?.connected);
            const active=p=>p.buttons.some(b=>b.pressed||b.value>0.05)||p.axes.some(a=>Math.abs(a)>0.15);
            const p=pads.find(active)||pads.find(p=>p.index===this.lastIndex)||pads[0];
            this.connected=!!p; this.active=!!p&&active(p); this.state=blank(); this.id=p?.id||'';
            if(p) {this.lastIndex=p.index; this.state.buttons=this.state.buttons.map((_,i)=>clamp(p.buttons[i]?.value??(p.buttons[i]?.pressed?1:0),0,1));
                this.state.axes=this.state.axes.map((_,i)=>clamp(p.axes[i]||0,-1,1));}
            if(this.active) this.lastActivity=now;
            if(!p) this.lastActivity=-Infinity;
        }
    }

    class ButtonAutomation {
        constructor(input,config,clock) {this.input=input; this.config=config; this.clock=clock; this.modes=new Map(); this.pulses=new Map();}
        mode(id) {return this.modes.get(Number(id))?.mode||'none';}
        set(id,mode) {
            id=Number(id); this.input.clear(`auto:${id}`); this.modes.delete(id);
            if(mode==='hold'||mode==='interval') this.modes.set(id,{mode,start:this.clock()});
            this.tick(this.clock());
        }
        cycle(id) {this.set(id,{none:'interval',interval:'hold',hold:'none'}[this.mode(id)]);}
        pulse(key,id,ms=80) {this.pulses.set(key,{id,end:this.clock()+ms}); this.input.set(key,'btn',id,1);}
        restart() {for(const m of this.modes.values()) m.start=this.clock(); this.tick(this.clock());}
        tick(now) {
            for(const [id,m] of this.modes) {
                const delay=this.config.prefs.delay;
                const on=m.mode==='hold'||(now-m.start)%delay<Math.min(100,delay*0.4);
                this.input.set(`auto:${id}`,'btn',id,on?1:0,20);
            }
            for(const [key,p] of this.pulses) if(now>=p.end) {this.pulses.delete(key);this.input.clear(key);}
        }
        stopModes() {for(const id of [...this.modes.keys()]) this.set(id,'none');}
        stop() {this.stopModes(); for(const key of this.pulses.keys()) this.input.clear(key); this.pulses.clear();}
    }

    class MacroEngine {
        constructor(input,config,clock) {
            this.input=input; this.config=config; this.clock=clock; this.slot=1; this.recording=false; this.playing=false;
            this.loop=false; this.started=null; this.events=[]; this.last=blank(); this.index=0;
            input.onChange=()=>this.capture();
        }
        select(slot) {this.stop(); this.slot=slot;}
        record() {this.stop(); this.recording=true; this.started=null; this.events=[]; this.last=blank(); this.capture();}
        capture(force=false) {
            if(!this.recording) return;
            const state=this.input.recordingState(); const now=this.clock();
            for(const [type,field] of [['btn','buttons'],['axis','axes']]) state[field].forEach((raw,id)=>{
                const val=Math.round(raw*100)/100; const old=this.last[field][id];
                const endpoint=val===0||Math.abs(val)===1;
                if(val===old||(!force&&!endpoint&&Math.abs(val-old)<(type==='axis'?0.02:0.01)-1e-8)) return;
                if(this.started===null) this.started=now;
                this.events.push({t:now-this.started,type,id,val}); this.last[field][id]=val;
            });
        }
        stopRecording() {
            if(!this.recording) return;
            this.capture(true); this.recording=false;
            if(this.started!==null) {
                const duration=Math.max(1,this.clock()-this.started);
                this.config.prefs.macros[this.slot]={name:this.config.prefs.macros[this.slot].name||'',duration,events:clone(this.events)}; this.config.save();
            }
        }
        stopPlayback() {this.playing=false; this.loop=false; this.input.clear('macro');}
        stop() {this.stopRecording();this.stopPlayback();}
        clear() {this.stop(); this.config.prefs.macros[this.slot]={name:'',duration:0,events:[]}; this.config.save();}
        play(loop=false) {
            this.stop(); const m=this.config.prefs.macros[this.slot]; if(!m.events.length) return false;
            this.data=clone(m); this.data.duration=Math.max(1,this.data.duration,this.data.events.at(-1).t);
            this.playing=true;this.loop=loop;this.index=0;this.playStart=this.clock();this.tick(this.playStart);return true;
        }
        tick(now) {
            if(!this.playing) return;
            let elapsed=now-this.playStart;
            if(elapsed>=this.data.duration&&this.loop) {
                this.playStart+=Math.floor(elapsed/this.data.duration)*this.data.duration;
                elapsed=now-this.playStart;this.index=0;this.input.clear('macro');
            }
            while(this.index<this.data.events.length&&this.data.events[this.index].t<=elapsed) {
                const e=this.data.events[this.index++]; this.input.set('macro',e.type,e.id,e.val,30);
            }
            if(elapsed>=this.data.duration&&!this.loop) this.stopPlayback();
        }
    }

    // 備份驗證比設定遷移嚴格：任一事件有錯，整份拒收，不悄悄丟掉部分動作。
    class MacroBackup {
        static MAX_BYTES=16*1024*1024;
        static MAX_EVENTS=200000;
        static validate(doc) {
            if(!doc||doc.format!=='better-xcloud-macros'||doc.version!==1)throw Error('不是支援的巨集備份，請選擇本程式匯出的 JSON（格式版本 1）。');
            if(!Array.isArray(doc.macros)||![1,6].includes(doc.macros.length))throw Error('備份必須包含單一槽位或完整六組。');
            const seen=new Set();let total=0;
            const macros=doc.macros.map(m=>{
                if(!m||!Number.isInteger(m.slot)||m.slot<1||m.slot>6||seen.has(m.slot))throw Error('槽位編號無效或重複。');
                seen.add(m.slot);
                if(typeof m.name!=='string'||m.name.length>60)throw Error(`槽位 ${m.slot} 的名稱須為 60 字以內的文字。`);
                if(!Number.isFinite(m.duration)||m.duration<0||!Array.isArray(m.events))throw Error(`槽位 ${m.slot} 的時間或事件格式錯誤。`);
                total+=m.events.length;if(total>this.MAX_EVENTS)throw Error('備份超過 200,000 筆事件上限，請分槽匯出。');
                let previous=0;
                const events=m.events.map((e,i)=>{
                    if(!e||!['btn','axis'].includes(e.type)||!Number.isInteger(e.id)||e.id<0||e.id>=(e.type==='btn'?17:4)
                        ||!Number.isFinite(e.val)||e.val<(e.type==='btn'?0:-1)||e.val>1
                        ||!Number.isFinite(e.t)||e.t<previous||e.t>m.duration)
                        throw Error(`槽位 ${m.slot} 第 ${i+1} 筆事件無效（按鍵、類比值或時間順序）。`);
                    previous=e.t;return {t:e.t,type:e.type,id:e.id,val:e.val};
                });
                return {slot:m.slot,name:m.name.trim(),duration:m.duration,events};
            });
            return {format:doc.format,version:1,macros};
        }
        static parse(text) {
            if(new TextEncoder().encode(text).length>this.MAX_BYTES)throw Error('檔案超過 16 MB 上限。');
            let doc;try{doc=JSON.parse(text.replace(/^\uFEFF/,''));}catch{throw Error('JSON 無法解析，請確認檔案完整且未被修改。');}
            return this.validate(doc);
        }
        static encode(config,slot=null) {
            const ids=slot===null?[1,2,3,4,5,6]:[slot];
            const doc={format:'better-xcloud-macros',version:1,appVersion:VERSION,exportedAt:new Date().toISOString(),
                macros:ids.map(s=>({slot:s,name:config.prefs.macros[s].name||'',duration:config.prefs.macros[s].duration,events:clone(config.prefs.macros[s].events)}))};
            this.validate(doc);const text=JSON.stringify(doc,null,2);
            if(new TextEncoder().encode(text).length>this.MAX_BYTES)throw Error('備份超過 16 MB，請分槽匯出。');
            return text;
        }
        static plan(doc,source,target) {
            const valid=this.validate(doc);
            if(source==='all') {
                if(valid.macros.length!==6)throw Error('只有完整六組備份才能全部還原。');
                return valid.macros.map(m=>({slot:m.slot,value:{name:m.name,duration:m.duration,events:m.events}}));
            }
            const selected=valid.macros.find(m=>m.slot===Number(source));
            if(!selected||!Number.isInteger(target)||target<1||target>6)throw Error('請選擇有效的來源與目的槽位。');
            return [{slot:target,value:{name:selected.name,duration:selected.duration,events:selected.events}}];
        }
        static commit(config,doc,source,target,isBusy) {
            if(isBusy())throw Error('請先停止錄製或播放，再匯入。');
            const plan=this.plan(doc,source,target);const previous=config.prefs.macros;
            config.prefs.macros={...previous};for(const item of plan)config.prefs.macros[item.slot]=clone(item.value);
            if(!config.save()){config.prefs.macros=previous;throw Error('儲存失敗，已保留原本的巨集；請先匯出備份並檢查網站儲存空間。');}
            return plan.length;
        }
    }

    // 唯一的全域拖曳事件組。每根手指各自拥有工作階段，取消只影響自己。
    class PointerManager {
        constructor(target,signal) {
            this.sessions=new Map();this.bindings=new WeakMap();
            target.addEventListener('pointermove',e=>{const s=this.sessions.get(e.pointerId);if(s){e.preventDefault();s.move?.(e);}},{signal,passive:false});
            for(const type of ['pointerup','pointercancel','lostpointercapture'])
                target.addEventListener(type,e=>this.finish(e.pointerId,e,type!=='pointerup'),{signal,capture:true});
            this.signal=signal;
        }
        bind(el,start) {
            el.style.touchAction='none';
            el.addEventListener('pointerdown',e=>{
                if(e.button!==0||this.sessions.has(e.pointerId)) return;
                const session=start(e); if(!session) return;
                e.preventDefault();e.stopPropagation(); session.el=el;this.sessions.set(e.pointerId,session);
                try{el.setPointerCapture(e.pointerId);}catch{/* Detached test elements do not support capture. */}
            },{signal:this.signal});
        }
        finish(id,e,cancelled) {
            const s=this.sessions.get(id);if(!s)return;this.sessions.delete(id);
            s.end?.(e,cancelled);try{if(s.el.hasPointerCapture(id)) s.el.releasePointerCapture(id);}catch{}
        }
        cancelAll() {for(const [id] of [...this.sessions]) this.finish(id,null,true);}
        get busy() {return this.sessions.size>0;}
    }

    class LayoutManager {
        constructor(config) {this.config=config;this.items=new Map();this.editing=false;this.group=true;this.snap=true;this.dragging=false;}
        register(id,el) {this.items.set(String(id),el);this.apply();}
        offsets() {return this.config.prefs.layouts[this.config.prefs.layoutSlot];}
        apply() {for(const [id,el] of this.items) {const p=this.offsets()[id]||{x:0,y:0};el.style.transform=`translate(${p.x}px,${p.y}px)`;}}
        drag(id,e,scale) {
            if(this.dragging) return null;this.dragging=true;
            const group=this.group?GROUPS[id]:null;
            const ids=group?[...this.items.keys()].filter(i=>GROUPS[i]===group):[String(id)];
            const starts=Object.fromEntries(ids.map(i=>[i,{...(this.offsets()[i]||{x:0,y:0})}]));
            const x=e.clientX,y=e.clientY;
            return {move:ev=>{
                let dx=(ev.clientX-x)/scale,dy=(ev.clientY-y)/scale;
                if(this.snap){dx=Math.round(dx/10)*10;dy=Math.round(dy/10)*10;}
                ids.forEach(i=>this.offsets()[i]={x:starts[i].x+dx,y:starts[i].y+dy});this.apply();
            },end:(_,cancel)=>{this.dragging=false;if(cancel){ids.forEach(i=>this.offsets()[i]=starts[i]);this.apply();}else this.config.save();}};
        }
        reset() {this.config.prefs.layouts[this.config.prefs.layoutSlot]={};this.apply();this.config.save();}
    }

    class RacingController {
        constructor(app) {this.app=app;this.afk=false;this.left=null;this.right=null;}
        start(side,e) {
            if(this[side])return null;this.app.manualStart();
            const key=`race:${e.pointerId}`;const s={x:e.clientX,y:e.clientY,dx:0,dy:0,ratio:0,pressed:false,flick:false};this[side]=s;
            if(side==='left')this.app.input.set(key,'axis',0,0);
            return {move:ev=>{
                this.app.manualStart();const dx=ev.clientX-s.x,dy=ev.clientY-s.y;
                if(side==='left') {
                    s.dx=clamp(dx,-55,55);this.app.input.set(key,'axis',0,s.dx/55);
                    const down=dy>40;if(down&&!s.pressed)this.app.vibrate(30);s.pressed=down;
                    this.app.input.set(key,'btn',0,down?1:0);
                }else{
                    if(!s.flick&&Math.abs(dx)>35){s.flick=true;this.app.auto.pulse(`flick:${e.pointerId}`,dx>0?1:2);this.app.vibrate([40,30]);}
                    s.dy=clamp(dy,-70,70);s.ratio=Math.abs(s.dy)/70;
                    this.app.input.set(key,'btn',7,s.dy<0&&s.ratio>0.05?s.ratio:0);
                    this.app.input.set(key,'btn',6,s.dy>=0&&s.ratio>0.05?s.ratio:0);
                }
            },end:()=>{this[side]=null;this.app.input.clear(key);}};
        }
        tick(now) {
            if(!this.afk){this.app.input.clear('afk');return;}
            const axis=(Math.sin(now/800)+Math.sin(now/1700)*0.4+(Math.random()-0.5)*0.04)*this.app.config.prefs.afkAmp;
            this.app.input.set('afk','axis',0,axis,10);
        }
        stop() {this.afk=false;this.app.input.clear('afk');}
    }

    // DOM / CSS 與核心引擎分離。Shadow DOM 隔離 Xbox 網頁樣式。
    const el = (tag,cls='',text='') => {const n=document.createElement(tag);n.className=cls;if(text)n.textContent=text;return n;};
    const button = (text,fn,cls='') => {const b=el('button',cls,text);b.type='button';b.onclick=e=>{e.stopPropagation();fn(e);};return b;};
    const styleValue = (node,key,value) => {if(node.style[key]!==value) node.style[key]=value;};
    const CSS = `
    :host{all:initial;font-family:system-ui,"Microsoft JhengHei",sans-serif;color:#edf4fa;--line:#ffffff26;--green:#74efb4;--muted:#93a4b6}
    *{box-sizing:border-box} [hidden]{display:none!important} button,select,input{font:inherit;color:inherit}
    button,select{border:1px solid var(--line);background:#1c2937;border-radius:8px;padding:6px 9px;cursor:pointer;font-size:11px;line-height:1.3}
    button:hover{border-color:#74efb4aa} button:focus-visible,select:focus-visible{outline:2px solid #74efb4}
    button.on{background:#235341;color:#baffdc;border-color:#74efb4} button.danger{color:#ffaba9;border-color:#ff777766;background:#482c34}
    .panel,.viewer,.popup{position:fixed;pointer-events:auto;user-select:none;border:1px solid var(--line);border-radius:16px;background:#111c29ed;box-shadow:0 8px 30px #0005;transform-origin:top left}
    .panel{padding:10px;width:550px;z-index:5}.panel.transparent{background:transparent;box-shadow:none}.panel.transparent .controls{background:transparent}
    .header,.row,.tabs,.status{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.header{justify-content:space-between;min-height:28px}
    .brand{font-size:11px;letter-spacing:.8px;color:var(--green);cursor:grab;touch-action:none;padding:7px 4px}
    .meta,.hint{font-size:10px;color:var(--muted);line-height:1.6}.hint{margin-top:8px}.status{margin-top:7px}.status:empty{display:none}
    .status button{font-size:10px;padding:4px 7px}.tabs{margin:10px 0;border-top:1px solid var(--line);padding-top:8px}
    .tools{padding:10px;background:#0a131cbb;border:1px solid var(--line);border-radius:10px;max-height:40vh;overflow:auto;overscroll-behavior:contain}
    .setting{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:6px 0;font-size:11px}.setting select{max-width:170px}
    .slots{display:grid;grid-template-columns:repeat(6,1fr);gap:5px;margin-bottom:9px}
    .slots button{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.help-off .hint,.help-off .racing-hint,.help-off .racezone>span{display:none}
    input[type=text]{min-width:0;width:70%;background:#1c2937;border:1px solid var(--line);border-radius:6px;padding:6px;user-select:text}button:disabled,select:disabled,input:disabled{opacity:.45;cursor:default}
    .backup{border-top:1px solid var(--line);margin-top:10px;padding-top:10px}.import-preview{margin-top:8px;padding:8px;border:1px solid var(--line);border-radius:8px}.import-preview .meta{overflow-wrap:anywhere}.backup-message{margin-top:7px;font-size:11px;white-space:pre-wrap;overflow-wrap:anywhere}
    .controls{position:relative;margin-top:10px;display:flex;flex-direction:column;gap:12px}
    .topkeys{display:flex;justify-content:space-between;gap:10px}.cluster{display:flex;gap:7px;align-items:center}
    .playrow{display:flex;align-items:flex-end;justify-content:center;gap:44px;padding:0 8px}.zone{display:flex;align-items:flex-end;gap:22px}
    .padkey{position:relative;z-index:1;touch-action:none;height:32px;min-width:44px;display:flex;align-items:center;justify-content:center;font-weight:700;border-radius:9px;background:#1b2938cc;color:#e2eaf3;padding:0;flex-shrink:0}
    .padkey[data-id="0"]{color:#74efb4}.padkey[data-id="1"]{color:#ff8585}.padkey[data-id="2"]{color:#82bfff}.padkey[data-id="3"]{color:#ffe088}
    .padkey[data-mode="hold"]{border-color:#ff7777;box-shadow:inset 0 0 0 1px #ff7777}.padkey[data-mode="interval"]{border-color:#ffd26e;box-shadow:inset 0 0 0 1px #ffd26e}
    .padkey.active{background:#39725d;color:#fff;box-shadow:0 0 10px #74efb455}.padkey.trigger{background:linear-gradient(to top,#3b8267 var(--depth,0%),#1b2938cc var(--depth,0%))}
    .cross{display:grid;grid-template-columns:repeat(3,32px);grid-template-rows:repeat(3,32px);gap:4px}.cross .padkey{width:32px;height:32px;min-width:0}
    .face .padkey{border-radius:50%}.stickwrap{position:relative}.stick{width:86px;height:86px;border-radius:50%;border:1px solid #ffffff40;background:#0a1420c9;position:relative;touch-action:none;display:flex;align-items:center;justify-content:center}
    .stick.active{border-color:var(--green)}.knob{width:38px;height:38px;border-radius:50%;background:#728599;border:2px solid #a5b9cd;pointer-events:none;display:grid;place-items:center;font-size:9px;color:#172432}
    .stickwrap>.padkey{position:absolute;bottom:-2px;left:-4px;width:25px;height:25px;min-width:0;border-radius:50%;font-size:9px}
    .stickwrap.left{left:-8px}.stickwrap.right{left:8px}.stickwrap.right>.padkey{left:auto;right:-4px}
    .editing .padkey,.editing .stick{outline:1px dashed #ffda75;cursor:move}.editing .controls{background-image:radial-gradient(#ffe19944 1px,transparent 1px);background-size:10px 10px}
    .compact .playrow{gap:18px}.compact .zone{gap:12px}.compact .stick{width:50px;height:50px}.compact .knob{width:24px;height:24px}.compact .cross{grid-template-columns:repeat(3,24px);grid-template-rows:repeat(3,24px);gap:2px}.compact .cross .padkey{width:24px;height:24px;font-size:9px}
    .split .playrow{justify-content:space-between}.racing-hint{margin-top:5px;color:var(--muted);font-size:10px}
    .racearea{position:fixed;left:0;bottom:0;width:100vw;height:62vh;display:flex;pointer-events:none;z-index:1}.racezone{width:50%;height:100%;pointer-events:auto;touch-action:none;position:relative}.racezone>span{position:absolute;bottom:12px;left:20px;font-size:10px;color:#ffffff55;pointer-events:none}
    canvas{position:fixed;inset:0;pointer-events:none;z-index:2}
    .viewer{width:300px;padding:12px;z-index:4;cursor:grab;touch-action:none}.viewer .head{display:flex;justify-content:space-between;font-size:9px;color:var(--muted);letter-spacing:1px;margin-bottom:10px}
    .triggers{display:flex;gap:14px}.meter{flex:1;font-size:10px;color:var(--muted)}.meterlabel{display:flex;justify-content:space-between;margin-bottom:4px}.track{height:7px;border-radius:5px;background:#ffffff15;overflow:hidden}.fill{width:100%;height:100%;background:var(--green);transform:scaleX(0);transform-origin:left}.mirror .fill{transform-origin:right}
    .viewerkeys{display:flex;justify-content:space-between;margin:11px 0 12px}.vkey{border:1px solid var(--line);border-radius:5px;font-size:9px;min-width:28px;height:21px;display:flex;align-items:center;justify-content:center;color:#9db0c2}.vkey.active{color:#142b20;background:var(--green);border-color:var(--green)}
    .vbottom{display:flex;align-items:center;justify-content:space-between;gap:7px}.vstick{width:46px;height:46px;border-radius:50%;border:1px solid #ffffff33;display:grid;place-items:center;position:relative;background:#0a1420}.vdot{width:20px;height:20px;background:#7890a6;border:1px solid #b3c5d7;border-radius:50%;display:grid;place-items:center;font-size:7px;color:#081727}.vdot.active{background:var(--green)}
    .vcross{display:grid;grid-template-columns:repeat(3,18px);grid-template-rows:repeat(3,18px);gap:2px}.vcross .vkey{min-width:0;height:18px;font-size:8px}.vface .vkey{border-radius:50%}
    .viewerfoot{display:flex;justify-content:flex-end;margin-top:7px}.viewerfoot button{padding:3px 7px;font-size:10px}.popup{z-index:10;padding:8px;display:flex;gap:6px;flex-wrap:wrap;max-width:calc(100vw - 16px)}
    .notice{position:fixed;top:12px;left:50%;transform:translateX(-50%);max-width:90vw;background:#512b31;color:#ffdedc;padding:10px 16px;border-radius:10px;z-index:20;pointer-events:auto;font-size:12px}
    `;

    class ControlPanel {
        constructor(app) {
            this.app=app;this.config=app.config;this.p=this.config.prefs;this.root=el('section','panel');
            this.root.setAttribute('aria-label','虛擬手把控制面板');this.collapsed=false;this.tab=null;this.dirty=true;
            this.buttons=[];this.sticks=[];this.tapStates=new Map();
            this.header=el('div','header');this.drag=el('span','brand','⠿  XCLOUD / 14');
            this.collapseBtn=button('收合',()=>{app.pointers.cancelAll();this.collapsed=!this.collapsed;this.refresh();});
            this.modeBtn=button('',()=>app.changeMode());this.toolBtn=button('工具',()=>this.openTab(this.tab&&this.tab!=='macro'?null:'settings'));
            this.macroQuick=button('巨集',()=>this.openTab(this.tab==='macro'&&!this.collapsed?null:'macro'));
            this.helpBtn=button('?',()=>{this.p.showHelp=!this.p.showHelp;this.config.save();this.refresh();});this.helpBtn.setAttribute('aria-label','顯示操作說明');
            this.stopBtn=button('全停',()=>app.stopAll(),'danger');
            this.header.append(this.drag,this.modeBtn,this.macroQuick,this.helpBtn,this.toolBtn,this.collapseBtn,this.stopBtn);
            this.status=el('div','status');this.status.setAttribute('aria-label','作用中狀態');
            this.tabs=el('div','tabs');this.tabButtons={};
            for(const [key,title] of [['settings','設定'],['macro','巨集'],['layout','佈局']]) {
                const b=button(title,()=>this.openTab(key));this.tabButtons[key]=b;this.tabs.append(b);
            }
            this.tools=el('div','tools');this.pages={settings:this.settingsPage(),macro:this.macroPage(),layout:this.layoutPage()};
            this.tools.append(...Object.values(this.pages));
            this.controls=el('div','controls');this.buildControls();
            this.help=el('div','hint','右鍵：連發 → 鎖定 → 解除　｜　F2：解除連發／鎖定，否則收合');
            this.raceHint=el('div','racing-hint','左區：轉向／下拉 A　右區：上滑 RT、下滑 LT／右甩：B 進檔、左甩：X 退檔');
            this.root.append(this.header,this.status,this.tabs,this.tools,this.controls,this.help,this.raceHint);app.shadow.append(this.root);
            app.dragElement(this.drag,this.root,()=>{this.p.panelPos={x:this.root.style.left,y:this.root.style.top};this.config.save();},()=>!(this.p.gameMode==='racing'&&!this.collapsed));
            this.root.style.left=this.p.panelPos?.x||'15px';this.root.style.top=this.p.panelPos?.y||`${Math.max(15,window.innerHeight-280*this.p.uiScale)}px`;
            this.refresh();
        }
        selectSetting(parent,label,key,options,after=()=>{}) {
            const row=el('label','setting');row.append(el('span','',label));const select=el('select');select.dataset.setting=key;
            for(const [value,title] of options) {const o=el('option','',title);o.value=String(value);select.append(o);}
            select.value=String(this.p[key]);select.onchange=()=>{
                this.app.pointers.cancelAll();const raw=select.value;
                this.p[key]=typeof this.p[key]==='boolean'?raw==='true':typeof this.p[key]==='number'?Number(raw):raw;
                after();this.config.save();this.refresh();
            };row.append(select);parent.append(row);return select;
        }
        settingsPage() {
            const page=el('div');
            this.selectSetting(page,'連發間隔','delay',[100,200,500,1000,2000,3000,5000,10000].map(v=>[v,`${v/1000} 秒`]),()=>this.app.auto.restart());
            this.selectSetting(page,'雙擊連發／三擊鎖定','comboTaps',[[false,'關閉（防誤觸）'],[true,'開啟']]);
            this.selectSetting(page,'AFK 擺頭幅度','afkAmp',[.1,.15,.2,.25,.3,.4,.5].map(v=>[v,`${Math.round(v*100)}%`]));
            this.afkBtn=button('啟動 AFK 擺頭',()=>{this.app.manualStart();this.app.racing.afk=!this.app.racing.afk;this.app.racing.tick(this.app.clock());this.refresh();});page.append(this.afkBtn);
            this.selectSetting(page,'控制面板大小','uiScale',[.8,1,1.2,1.5].map(v=>[v,`${Math.round(v*100)}%`]));
            this.selectSetting(page,'控制面板背景','bgTrans',[[false,'半透明'],[true,'透明']]);
            this.selectSetting(page,'賽車操作時淡化','racingAutoFade',[[true,'開啟（25%）'],[false,'關閉']]);
            this.selectSetting(page,'左右分離','splitMode',[[false,'合併'],[true,'分離']]);
            this.selectSetting(page,'極簡展示 HUD','showViewer',[[false,'隱藏（實體操作時自動顯示）'],[true,'顯示']]);
            this.selectSetting(page,'展示 HUD 大小','viewerScale',[.6,.8,1,1.2].map(v=>[v,`${Math.round(v*100)}%`]),()=>this.app.viewer?.resize());
            const row=el('div','row');const key=el('select');key.setAttribute('aria-label','自動按鍵');
            LABELS.forEach((label,i)=>{const o=el('option','',label);o.value=i;key.append(o);});
            row.append(key,button('連發',()=>this.setMode(Number(key.value),'interval')),button('鎖定',()=>this.setMode(Number(key.value),'hold')),button('解除',()=>this.setMode(Number(key.value),'none')));
            page.append(el('div','hint','觸控裝置也可在這裡指定按鍵自動操作。'),row);
            return page;
        }
        macroPage() {
            const page=el('div');const slotsRow=el('div','slots');this.macroSlots=[];
            for(let s=1;s<=6;s++){const b=button(String(s),()=>{this.app.macro.select(s);this.refresh();});this.macroSlots.push(b);slotsRow.append(b);}
            const row=el('div','row');
            row.append(button('● 錄製',()=>{this.app.stopAll();this.app.macro.record();this.refresh();}),
                button('■ 停止',()=>{this.app.macro.stop();this.refresh();}),
                button('▶ 播放',()=>this.app.playMacro(false)),button('↻ 循環',()=>this.app.playMacro(true)),
                button('清除',()=>{if(confirm('清除此巨集槽位？')){this.app.macro.clear();this.refresh();}},'danger'));
            const nameRow=el('label','setting');nameRow.append(el('span','','巨集名稱'));this.macroName=el('input');this.macroName.type='text';this.macroName.maxLength=60;
            this.macroName.onchange=()=>{if(this.macroBusy())return;const macro=this.p.macros[this.app.macro.slot],old=macro.name;macro.name=this.macroName.value.trim();if(!this.config.save()){macro.name=old;this.backupMessage.textContent='名稱儲存失敗。';}this.refreshStatus();};nameRow.append(this.macroName);
            this.macroStatus=el('div','meta');
            page.append(slotsRow,nameRow,row,this.macroStatus,el('div','hint','第一次操作才開始計時；按下停止前的等待也會保存。手動遊戲輸入會停止播放。'),this.backupPage());
            return page;
        }
        macroBusy() {return this.app.macro.playing||this.app.macro.recording;}
        backupPage() {
            const box=el('div','backup'),row=el('div','row');
            this.exportOne=button('匯出此組',()=>this.exportMacros(this.app.macro.slot));this.exportAll=button('匯出六組',()=>this.exportMacros());
            this.importBtn=button('匯入 JSON',()=>{if(this.macroBusy())return;this.importFile.value='';this.importFile.click();});
            this.importFile=el('input');this.importFile.type='file';this.importFile.accept='.json,application/json';this.importFile.hidden=true;
            this.importFile.onchange=()=>this.readBackup(this.importFile.files[0]);
            this.backupMessage=el('div','backup-message');this.backupMessage.setAttribute('role','status');
            this.importPreview=el('div','import-preview');this.importPreview.hidden=true;this.importToken=0;
            row.append(this.exportOne,this.exportAll,this.importBtn);box.append(row,this.importFile,this.backupMessage,this.importPreview,el('div','hint','備份包含巨集名稱、按鍵、類比深度與等待時間。匯入只更動所選巨集，不會改變佈局或其他設定。'));return box;
        }
        exportMacros(slot=null) {
            try {
                if(this.app.macro.recording)throw Error('請先停止錄製，再匯出完整巨集。');
                const json=MacroBackup.encode(this.config,slot),url=URL.createObjectURL(new Blob([json],{type:'application/json'}));
                const a=el('a');a.href=url;a.download=`xcloud-macros-${slot===null?'all':`slot-${slot}`}-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
                this.app.shadow.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
                this.backupMessage.textContent='已產生 JSON 備份，請確認瀏覽器下載。';
            }catch(e){this.backupMessage.textContent=e.message;}
        }
        async readBackup(file) {
            if(!file)return;const token=++this.importToken;this.importPreview.hidden=true;
            try {
                if(this.macroBusy())throw Error('請先停止錄製或播放，再匯入。');
                if(file.size>MacroBackup.MAX_BYTES)throw Error('檔案超過 16 MB，請改用單組備份。');
                const text=await file.text();if(token!==this.importToken||this.app.destroyed)return;
                if(this.macroBusy())throw Error('請先停止錄製或播放，再匯入。');
                this.showImport(MacroBackup.parse(text));this.backupMessage.textContent='資料檢查完成，尚未寫入。請選擇還原位置。';
            }catch(e){if(token===this.importToken&&!this.app.destroyed)this.backupMessage.textContent=e.message;}
        }
        showImport(doc) {
            const preview=this.importPreview;preview.replaceChildren();preview.hidden=false;
            preview.append(el('strong','','匯入預覽'));
            for(const m of doc.macros)preview.append(el('div','meta',`${m.slot} · ${m.name||'未命名'} · ${m.events.length} 筆 · ${(m.duration/1000).toFixed(1)} 秒`));
            const sourceRow=el('label','setting'),targetRow=el('label','setting');sourceRow.append(el('span','','備份來源'));targetRow.append(el('span','','寫入槽位'));
            this.importSource=el('select');this.importTarget=el('select');
            this.importSource.setAttribute('aria-label','備份來源');this.importTarget.setAttribute('aria-label','寫入槽位');
            const option=(select,value,label)=>{const o=el('option','',label);o.value=value;select.append(o);};
            for(const m of doc.macros)option(this.importSource,m.slot,`${m.slot} · ${m.name||'未命名'}`);
            if(doc.macros.length===6)option(this.importSource,'all','還原全部六組（包含空槽）');
            for(let s=1;s<=6;s++)option(this.importTarget,s,`槽位 ${s}`);this.importTarget.value=String(this.app.macro.slot);
            this.importSource.onchange=()=>this.refreshStatus();sourceRow.append(this.importSource);targetRow.append(this.importTarget);
            this.importApply=button('確認匯入',()=>{
                try {
                    if(this.macroBusy())throw Error('請先停止錄製或播放，再匯入。');
                    const source=this.importSource.value,target=Number(this.importTarget.value),plan=MacroBackup.plan(doc,source,target);
                    const destinations=plan.map(entry=>`槽位 ${entry.slot}（${this.p.macros[entry.slot].name||'未命名'}，${this.p.macros[entry.slot].events.length} 筆）`).join('\n');
                    if(!confirm(`匯入將取代以下巨集：\n${destinations}\n${source==='all'?'備份中的空槽也會覆蓋現有資料。\n':''}確定繼續？`))return;
                    const count=MacroBackup.commit(this.config,doc,source,target,()=>this.macroBusy());
                    this.importToken++;preview.hidden=true;this.backupMessage.textContent=`已匯入 ${count} 組巨集。`;this.refresh();
                }catch(e){this.backupMessage.textContent=e.message;}
            });
            const actions=el('div','row');actions.append(this.importApply,button('取消',()=>{this.importToken++;preview.hidden=true;this.backupMessage.textContent='已取消，巨集沒有變更。';this.refresh();}));
            preview.append(sourceRow,targetRow,actions);this.refresh();
        }
        layoutPage() {
            const page=el('div');const slotRow=el('div','slots');this.layoutSlots=[];
            for(let s=1;s<=6;s++){const b=button(String(s),()=>{this.app.pointers.cancelAll();this.p.layoutSlot=s;this.app.layout.apply();this.config.save();this.refresh();});this.layoutSlots.push(b);slotRow.append(b);}
            this.editBtn=button('開始編輯',()=>{
                if(this.p.gameMode==='racing'){this.app.notice('賽車模式不支援佈局編輯，請先切回標準模式。');return;}
                this.app.stopAll();this.app.layout.editing=!this.app.layout.editing;this.refresh();
            });
            this.groupBtn=button('群組移動',()=>{this.app.layout.group=!this.app.layout.group;this.refresh();});
            this.snapBtn=button('磁吸 10px',()=>{this.app.layout.snap=!this.app.layout.snap;this.refresh();});
            const row=el('div','row');row.append(this.editBtn,this.groupBtn,this.snapBtn,button('還原此組',()=>{
                if(confirm('還原目前槽位的佈局？其他槽位不受影響。')){this.app.pointers.cancelAll();this.app.layout.reset();}
            },'danger'));
            page.append(slotRow,row,el('div','hint','編輯時拖曳按鍵／搖桿；拖曳只改位置，不送出遊戲輸入。舊版儲存的位移會沿用於新介面的對應控制元件。'));
            return page;
        }
        openTab(tab) {if(this.app.layout.editing&&tab!=='layout'){this.app.pointers.cancelAll();this.app.layout.editing=false;}
            this.tab=tab;if(tab)this.collapsed=false;this.refresh();}
        setMode(id,mode) {this.app.manualStart();this.app.auto.set(id,mode);this.refresh();}
        createKey(id,width=44,height=32) {
            const node=el('button','padkey',LABELS[id]);node.type='button';node.dataset.id=id;node.dataset.mode='none';
            node.style.width=`${width}px`;node.style.height=`${height}px`;node.title=`${LABELS[id]}：右鍵切換連發／鎖定`;
            this.app.layout.register(String(id),node);this.buttons.push({id,node});
            this.app.pointers.bind(node,e=>{
                if(this.app.layout.editing) return this.app.layout.drag(String(id),e,this.effectiveScale);
                this.app.manualStart();const source=`manual:${e.pointerId}`;this.app.input.set(source,'btn',id,1);
                const combo=this.p.comboTaps&&this.p.gameMode==='standard';let taps=this.tapStates.get(id);
                if(!taps){taps={count:0,last:-Infinity,due:null};this.tapStates.set(id,taps);}
                if(combo){const now=this.app.clock();taps.count=now-taps.last<300?taps.count+1:1;taps.last=now;taps.due=null;}
                return {end:(_,cancelled)=>{
                    this.app.input.clear(source);
                    if(cancelled){taps.count=0;taps.due=null;}
                    else if(combo&&taps.count>1)taps.due=this.app.clock()+180;
                }};
            });
            node.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();
                if(!this.app.layout.editing&&this.p.gameMode==='standard'){this.app.manualStart();this.app.auto.cycle(id);this.refresh();}});
            return node;
        }
        createStick(axis) {
            const wrapper=el('div',`stickwrap ${axis===0?'left':'right'}`);const base=el('div','stick');const knob=el('div','knob',axis===0?'LS':'RS');
            base.setAttribute('aria-label',axis===0?'左搖桿':'右搖桿');base.dataset.axis=axis;base.append(knob);
            this.app.layout.register(`stick_${axis}`,base);this.sticks.push({axis,node:base,knob});
            let active=false;
            this.app.pointers.bind(base,e=>{
                if(this.app.layout.editing)return this.app.layout.drag(`stick_${axis}`,e,this.effectiveScale);
                if(active)return null;active=true;this.app.manualStart();const source=`manual:${e.pointerId}`;
                const rect=base.getBoundingClientRect();const scale=rect.width/base.offsetWidth;
                const radius=(base.clientWidth-knob.offsetWidth)/2*scale;
                const move=ev=>{this.app.manualStart();let x=(ev.clientX-rect.left-rect.width/2)/radius,y=(ev.clientY-rect.top-rect.height/2)/radius;
                    const d=Math.max(1,Math.hypot(x,y));this.app.input.set(source,'axis',axis,x/d);this.app.input.set(source,'axis',axis+1,y/d);};
                move(e);return {move,end:()=>{active=false;this.app.input.clear(source);}};
            });
            wrapper.append(base,this.createKey(axis===0?10:11,25,25));return wrapper;
        }
        cross(face=false) {
            const grid=el('div',face?'cross face':'cross');
            for(const [id,col,row] of (face?[[3,2,1],[2,1,2],[1,3,2],[0,2,3]]:[[12,2,1],[14,1,2],[15,3,2],[13,2,3]])) {
                const key=this.createKey(id,32,32);key.style.width='';key.style.height='';key.style.gridColumn=col;key.style.gridRow=row;grid.append(key);
            }return grid;
        }
        buildControls() {
            const top=el('div','topkeys');const left=el('div','cluster'),center=el('div','cluster'),right=el('div','cluster');
            left.append(this.createKey(6),this.createKey(4));center.append(this.createKey(8,52),this.createKey(16,32),this.createKey(9,52));
            right.append(this.createKey(5),this.createKey(7));top.append(left,center,right);
            const row=el('div','playrow');const l=el('div','zone'),r=el('div','zone');
            l.append(this.createStick(0),this.cross());r.append(this.cross(true),this.createStick(2));row.append(l,r);
            this.controls.append(top,row);
        }
        tick(now,state) {
            for(const [id,t] of this.tapStates)if(t.due!==null&&now>=t.due){t.due=null;
                if(this.p.comboTaps&&this.p.gameMode==='standard'&&!this.app.layout.editing){const mode=t.count===2?'interval':'hold';this.setMode(id,this.app.auto.mode(id)===mode?'none':mode);}t.count=0;}
            for(const {id,node} of this.buttons){node.classList.toggle('active',state.buttons[id]>0.05);
                node.dataset.mode=this.app.auto.mode(id);if(id===6||id===7){node.classList.add('trigger');node.style.setProperty('--depth',`${Math.round(state.buttons[id]*100)}%`);}}
            for(const {axis,node,knob} of this.sticks){const radius=(node.clientWidth-knob.offsetWidth)/2;
                styleValue(knob,'transform',`translate(${state.axes[axis]*radius}px,${state.axes[axis+1]*radius}px)`);
                node.classList.toggle('active',Math.hypot(state.axes[axis],state.axes[axis+1])>0.15);}
            const m=this.app.macro;
            const msg=m.recording?(m.started===null?'等待第一次操作…':`● 錄製中 ${((now-m.started)/1000).toFixed(1)} 秒`):m.playing?`${m.loop?'↻ 循環':'▶ 播放'} 槽位 ${m.slot}`:
                `槽位 ${m.slot}：${this.p.macros[m.slot].events.length} 筆 / ${(this.p.macros[m.slot].duration/1000).toFixed(1)} 秒`;
            if(this.macroStatus.textContent!==msg)this.macroStatus.textContent=msg;
            const sig=JSON.stringify([...this.app.auto.modes].map(([id,v])=>[id,v.mode]))+this.app.racing.afk+m.playing+m.recording+m.slot;
            if(sig!==this.statusSignature){this.statusSignature=sig;this.refreshStatus();}
        }
        refreshStatus() {
            this.status.replaceChildren();for(const [id,m] of this.app.auto.modes)this.status.append(button(`${LABELS[id]} ${m.mode==='hold'?'鎖定':'連發'} ×`,()=>this.setMode(id,'none')));
            if(this.app.racing.afk)this.status.append(button('AFK ×',()=>{this.app.racing.stop();this.refresh();}));
            const m=this.app.macro;if(m.playing||m.recording)this.status.append(button(`巨集 ${m.slot} ${m.recording?'錄製':'播放'} ■`,()=>{m.stop();this.refresh();}));
            this.macroSlots.forEach((b,i)=>{const data=this.p.macros[i+1];b.classList.toggle('on',m.slot===i+1);b.textContent=`${i+1}${data.events.length?' •':''}${data.name?' '+data.name:''}`;b.title=data.name||`槽位 ${i+1}`;});
            this.macroName.disabled=this.importBtn.disabled=!!this.macroBusy();
            this.exportOne.disabled=this.exportAll.disabled=!!m.recording;
            if(this.app.shadow.activeElement!==this.macroName||this.macroName.dataset.slot!==String(m.slot)){this.macroName.value=this.p.macros[m.slot].name||'';this.macroName.dataset.slot=String(m.slot);}
            if(this.importApply){this.importApply.disabled=this.importSource.disabled=!!this.macroBusy();this.importTarget.disabled=this.macroBusy()||this.importSource.value==='all';}
            this.afkBtn.classList.toggle('on',this.app.racing.afk);this.afkBtn.textContent=this.app.racing.afk?'停止 AFK 擺頭':'啟動 AFK 擺頭';
        }
        refresh() {
            this.root.classList.toggle('help-off',!this.p.showHelp);this.app.racingView?.area.classList.toggle('help-off',!this.p.showHelp);
            this.helpBtn.classList.toggle('on',this.p.showHelp);this.helpBtn.setAttribute('aria-pressed',String(this.p.showHelp));this.helpBtn.title=this.p.showHelp?'隱藏操作說明':'顯示操作說明';
            this.macroQuick.classList.toggle('on',this.tab==='macro'&&!this.collapsed);this.macroQuick.setAttribute('aria-expanded',String(this.tab==='macro'&&!this.collapsed));
            const racing=this.p.gameMode==='racing';this.root.classList.toggle('compact',racing);this.root.classList.toggle('split',this.p.splitMode&&!racing);
            this.root.classList.toggle('transparent',this.p.bgTrans);this.root.classList.toggle('editing',this.app.layout.editing);
            const width=this.collapsed?350:this.p.splitMode&&!racing?Math.max(550,(window.innerWidth-30)/this.p.uiScale):550;
            this.effectiveScale=Math.min(this.p.uiScale,(window.innerWidth-16)/width);
            this.root.style.transform=`scale(${this.effectiveScale})`;
            this.root.style.width=`${width}px`;
            this.modeBtn.textContent=racing?'賽車':'標準';this.collapseBtn.textContent=this.collapsed?'展開':'收合';
            this.controls.hidden=this.collapsed;this.help.hidden=this.collapsed;this.raceHint.hidden=this.collapsed||!racing;
            this.tabs.hidden=this.tools.hidden=this.collapsed||!this.tab;
            for(const [key,page] of Object.entries(this.pages)){page.hidden=key!==this.tab;this.tabButtons[key].classList.toggle('on',key===this.tab);}
            this.layoutSlots.forEach((b,i)=>b.classList.toggle('on',this.p.layoutSlot===i+1));
            this.editBtn.textContent=this.app.layout.editing?'完成編輯':'開始編輯';this.editBtn.classList.toggle('on',this.app.layout.editing);
            this.groupBtn.textContent=this.app.layout.group?'群組移動':'單顆移動';this.snapBtn.textContent=this.app.layout.snap?'磁吸 10px':'自由移動';
            this.groupBtn.classList.toggle('on',this.app.layout.group);this.snapBtn.classList.toggle('on',this.app.layout.snap);
            for(const select of this.root.querySelectorAll('[data-setting]'))select.value=String(this.p[select.dataset.setting]);
            this.refreshStatus();
            if(!this.tools.hidden){
                const otherHeight=this.root.offsetHeight-this.tools.offsetHeight;
                this.tools.style.maxHeight=`${Math.max(60,(window.innerHeight-16)/this.effectiveScale-otherHeight)}px`;
            }
            this.app.clampElement(this.root);
        }
        cancelTaps() {this.tapStates.clear();}
    }

    class ViewerHUD {
        constructor(app) {
            this.app=app;this.p=app.config.prefs;this.root=el('aside','viewer');this.root.setAttribute('aria-label','展示 HUD');
            this.root.style.left=this.p.viewerPos.x;this.root.style.top=this.p.viewerPos.y;this.keys=new Map();
            const head=el('div','head');head.append(el('span','','INPUT / LIVE'));this.sourceLabel=el('span','','VIRTUAL');head.append(this.sourceLabel);
            const meters=el('div','triggers');this.meters=[];
            for(const [id,label] of [[6,'LT'],[7,'RT']]){const meter=el('div',id===7?'meter mirror':'meter');const labels=el('div','meterlabel');
                const percent=el('span','','0%');labels.append(el('span','',label),percent);const track=el('div','track'),fill=el('div','fill');track.append(fill);meter.append(labels,track);meters.append(meter);this.meters.push({id,fill,percent});}
            const row=el('div','viewerkeys');for(const id of [4,8,16,9,5])row.append(this.key(id));
            const bottom=el('div','vbottom');this.sticks=[];
            const stick=axis=>{const base=el('div','vstick'),dot=el('div','vdot',axis===0?'LS':'RS');base.append(dot);this.sticks.push({axis,dot});return base;};
            const cross=face=>{const c=el('div',face?'vcross vface':'vcross');for(const [id,x,y] of(face?[[3,2,1],[2,1,2],[1,3,2],[0,2,3]]:[[12,2,1],[14,1,2],[15,3,2],[13,2,3]])){
                const k=this.key(id);k.style.gridColumn=x;k.style.gridRow=y;c.append(k);}return c;};
            bottom.append(stick(0),cross(false),cross(true),stick(2));
            const foot=el('div','viewerfoot');this.sizeBtn=button('',e=>app.popup(e,[.6,.8,1,1.2].map(v=>[v,`${Math.round(v*100)}%`]),this.p.viewerScale,v=>{
                this.p.viewerScale=v;this.resize();app.panel.refresh();app.config.save();}));
            this.sizeBtn.title='調整展示大小';foot.append(this.sizeBtn);this.root.append(head,meters,row,bottom,foot);app.shadow.append(this.root);
            app.dragElement(this.root,this.root,()=>{this.p.viewerPos={x:this.root.style.left,y:this.root.style.top};app.config.save();});this.resize();
        }
        key(id) {const k=el('span','vkey',LABELS[id]);k.dataset.id=id;this.keys.set(id,k);return k;}
        resize() {this.root.style.transform=`scale(${this.p.viewerScale})`;this.sizeBtn.textContent=`${Math.round(this.p.viewerScale*100)}%`;this.app.clampElement(this.root);}
        render(state,physical) {
            this.sourceLabel.textContent=physical?'PHYSICAL':'VIRTUAL';
            for(const {id,fill,percent} of this.meters){const v=clamp(state.buttons[id],0,1);styleValue(fill,'transform',`scaleX(${v})`);const t=`${Math.round(v*100)}%`;if(percent.textContent!==t)percent.textContent=t;}
            for(const [id,k] of this.keys)k.classList.toggle('active',state.buttons[id]>0.05);
            for(const {axis,dot} of this.sticks){styleValue(dot,'transform',`translate(${state.axes[axis]*10}px,${state.axes[axis+1]*10}px)`);dot.classList.toggle('active',state.buttons[axis===0?10:11]>0.05);}
        }
    }

    class RacingRenderer {
        constructor(app) {
            this.app=app;this.area=el('div','racearea');this.area.hidden=true;this.area.classList.toggle('help-off',!app.config.prefs.showHelp);
            for(const side of ['left','right']){const zone=el('div','racezone');zone.dataset.side=side;
                zone.append(el('span','',side==='left'?'轉向 · 下拉 A':'RT ↑ · LT ↓ · 左甩 X 退檔 · 右甩 B 進檔'));app.pointers.bind(zone,e=>app.racing.start(side,e));this.area.append(zone);}
            this.canvas=el('canvas');this.ctx=this.canvas.getContext('2d');app.shadow.append(this.area,this.canvas);this.resize();
        }
        resize() {this.dpr=window.devicePixelRatio||1;this.canvas.width=window.innerWidth*this.dpr;this.canvas.height=window.innerHeight*this.dpr;
            this.canvas.style.width=`${window.innerWidth}px`;this.canvas.style.height=`${window.innerHeight}px`;}
        render() {
            const c=this.ctx;if(!c)return;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,window.innerWidth,window.innerHeight);
            const l=this.app.racing.left,r=this.app.racing.right;
            if(l){c.lineWidth=2;c.strokeStyle=l.pressed?'#74efb4':'#82bfff';c.beginPath();c.arc(l.x,l.y,55,0,Math.PI*2);c.stroke();c.fillStyle=c.strokeStyle;c.beginPath();c.arc(l.x+l.dx,l.y,14,0,Math.PI*2);c.fill();}
            if(r){c.fillStyle='#ffffff44';c.fillRect(r.x-2,r.y-70,4,140);c.fillStyle=r.dy<0?'#74efb4':'#ff8585';c.fillRect(r.x-3,Math.min(r.y,r.y+r.dy),6,Math.abs(r.dy));c.beginPath();c.arc(r.x,r.y+r.dy,12,0,Math.PI*2);c.fill();}
        }
    }

    class App {
        constructor() {
            this.clock=()=>performance.now();this.abort=new AbortController();this.signal=this.abort.signal;this.destroyed=false;this.override=false;
            this.manualUntil=-Infinity;this.comboSince=null;this.comboFired=false;this.popupNode=null;
            this.lastRaceContact=-Infinity;this.panelWakeUntil=-Infinity;this.panelPointers=new Set();
            let storage;try{storage=window.localStorage;}catch{storage={getItem:()=>null,setItem:()=>{throw Error('Storage unavailable');}};}
            this.warnings=[];this.config=new ConfigStore(storage,(message,e)=>{console.warn('[xCloud v14]',message,e||'');if(!this.warnings.includes(message)){this.warnings.push(message);this.notice(message);}});
            this.input=new InputManager(this.clock);this.virtual=new VirtualGamepad(this.input,navigator,window);this.physical=new PhysicalGamepadMonitor(this.virtual);
            this.auto=new ButtonAutomation(this.input,this.config,this.clock);this.macro=new MacroEngine(this.input,this.config,this.clock);
            this.layout=new LayoutManager(this.config);this.pointers=new PointerManager(window,this.signal);this.racing=new RacingController(this);
        }
        start() {
            this.host=el('div');this.host.id='bxg-v14-root';this.host.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:2147483000;';
            this.shadow=this.host.attachShadow({mode:'open'});const style=el('style');style.textContent=CSS;this.shadow.append(style);document.documentElement.append(this.host);
            for(const type of ['click','dblclick','contextmenu'])this.shadow.addEventListener(type,e=>e.stopPropagation(),{signal:this.signal});
            this.panel=new ControlPanel(this);this.viewer=new ViewerHUD(this);this.racingView=new RacingRenderer(this);
            try {this.virtual.install();} catch(e) {this.notice('無法掛接虛擬手把。請停用其他手把腳本後重新整理。');throw e;}
            this.bindEvents();this.loop();
            if(this.warnings.length)this.notice(this.warnings.join(' '));
        }
        bindEvents() {
            window.addEventListener('keydown',e=>{if(e.code==='F2'&&!e.repeat){e.preventDefault();this.shortcut();}},{signal:this.signal});
            window.addEventListener('blur',()=>this.suspend(),{signal:this.signal});
            document.addEventListener('visibilitychange',()=>{if(document.hidden)this.suspend();},{signal:this.signal});
            window.addEventListener('pagehide',()=>this.suspend(),{signal:this.signal});
            window.addEventListener('resize',()=>{this.pointers.cancelAll();this.panel.refresh();this.viewer.resize();this.racingView.resize();},{signal:this.signal});
            document.addEventListener('pointerdown',e=>{
                if(this.popupNode&&!e.composedPath().includes(this.popupNode))this.closePopup();
                if(!e.composedPath().includes(this.viewer.root)){this.manualUntil=this.clock()+2500;if(this.override){this.override=false;this.updateVisibility();}}
                if(e.composedPath().includes(this.panel.root)){
                    this.panelPointers.add(e.pointerId);this.panelWakeUntil=this.clock()+1000;
                    this.updatePanelFade(this.clock());
                }
            },{signal:this.signal,capture:true});
            for(const type of ['pointerup','pointercancel','lostpointercapture'])window.addEventListener(type,e=>{
                if(this.panelPointers.delete(e.pointerId))this.panelWakeUntil=this.clock()+1000;
            },{signal:this.signal,capture:true});
            document.addEventListener('fullscreenchange',()=>{
                this.pointers.cancelAll();const target=document.fullscreenElement||document.documentElement;
                if(target!==this.host&&!target.contains(this.host))target.append(this.host);
                this.panel.refresh();this.viewer.resize();this.racingView.resize();
            },{signal:this.signal});
        }
        manualStart() {this.macro.stopPlayback();this.manualUntil=this.clock()+2500;this.override=false;}
        vibrate(pattern) {try{navigator.vibrate?.(pattern);}catch{}}
        stopAll() {
            this.macro.stop();this.pointers.cancelAll();this.panel?.cancelTaps();this.auto.stop();this.racing.stop();this.input.clearAll();
            this.lastRaceContact=-Infinity;this.panelPointers.clear();this.panelWakeUntil=-Infinity;
            if(this.panel)this.updatePanelFade(this.clock());
            this.panel?.refreshStatus();
        }
        suspend() {this.stopAll();this.override=false;this.closePopup();this.updateVisibility();}
        shortcut() {
            if(this.auto.modes.size){this.auto.stopModes();this.panel.refreshStatus();}
            else {this.pointers.cancelAll();this.panel.collapsed=!this.panel.collapsed;this.panel.refresh();}
            this.manualUntil=this.clock()+2500;this.override=false;this.updateVisibility();
        }
        changeMode() {
            this.stopAll();this.layout.editing=false;
            this.config.prefs.gameMode=this.config.prefs.gameMode==='racing'?'standard':'racing';
            if(this.config.prefs.gameMode==='racing'){this.panel.root.style.left='15px';this.panel.root.style.top='15px';}
            else {this.panel.root.style.left=this.config.prefs.panelPos?.x||'15px';this.panel.root.style.top=this.config.prefs.panelPos?.y||`${Math.max(15,window.innerHeight-280)}px`;}
            this.config.save();this.panel.refresh();this.updateVisibility();
        }
        playMacro(loop) {this.stopAll();this.macro.play(loop);this.panel.refresh();}
        clampElement(node) {
            if(!node||node.hidden)return;const rect=node.getBoundingClientRect();
            // CSS left/top 是視窗座標，不需除以 scale。
            node.style.left=`${clamp(parseFloat(node.style.left)||rect.left,8,Math.max(8,window.innerWidth-rect.width-8))}px`;
            node.style.top=`${clamp(parseFloat(node.style.top)||rect.top,8,Math.max(8,window.innerHeight-rect.height-8))}px`;
        }
        dragElement(handle,node,save,enabled=()=>true) {
            let busy=false;
            this.pointers.bind(handle,e=>{
                if(busy||!enabled()||e.target.closest('button,select,input'))return null;busy=true;
                const rect=node.getBoundingClientRect();const x=e.clientX,y=e.clientY,l=rect.left,t=rect.top;
                return {move:ev=>{node.style.left=`${l+ev.clientX-x}px`;node.style.top=`${t+ev.clientY-y}px`;},end:(_,cancel)=>{
                    busy=false;if(cancel){node.style.left=`${l}px`;node.style.top=`${t}px`;}this.clampElement(node);if(!cancel)save();}};
            });
        }
        closePopup() {this.popupNode?.remove();this.popupNode=null;}
        popup(e,options,current,select) {
            this.closePopup();const menu=el('div','popup');menu.setAttribute('role','group');
            for(const [value,label] of options)menu.append(button(label,()=>{select(value);this.closePopup();},value===current?'on':''));
            this.popupNode=menu;this.shadow.append(menu);const anchor=e.currentTarget?.getBoundingClientRect();
            menu.style.left=`${anchor?.left??e.clientX}px`;menu.style.top=`${anchor?.bottom??e.clientY}px`;this.clampElement(menu);
        }
        notice(message) {if(!this.shadow)return;const n=el('div','notice',message);n.append(button('關閉',()=>n.remove()));this.shadow.append(n);}
        updateVisibility() {
            if(!this.panel||!this.viewer||!this.racingView)return;
            this.panel.root.hidden=this.override;this.viewer.root.hidden=!(this.override||this.config.prefs.showViewer);
            this.racingView.area.hidden=this.override||this.panel.collapsed||this.config.prefs.gameMode!=='racing';
        }
        updatePanelFade(now) {
            const eligible=this.config.prefs.racingAutoFade&&this.config.prefs.gameMode==='racing'
                &&!this.panel.collapsed&&!this.panel.tab&&!this.layout.editing&&!this.override;
            // 使用觸控工作階段，不只看 pointermove；按住油門不移動也會持續淡化。
            if(!eligible)this.lastRaceContact=-Infinity;
            else if(this.racing.left||this.racing.right)this.lastRaceContact=now;
            const awake=this.panelPointers.size>0||now<this.panelWakeUntil;
            const dim=eligible&&!awake&&now-this.lastRaceContact<1000;
            // 頂部面板一被觸碰就立即清楚，其餘淡入淡出則平滑過渡。
            styleValue(this.panel.root,'transition',awake?'none':'opacity 200ms ease');
            styleValue(this.panel.root,'opacity',dim?'0.25':'1');
        }
        loop() {
            if(this.destroyed)return;
            const now=this.clock();this.physical.poll(now);
            const shouldOverride=this.physical.connected&&now-this.physical.lastActivity<2500&&now>=this.manualUntil&&!this.layout.editing&&!this.pointers.busy;
            if(shouldOverride!==this.override){this.override=shouldOverride;if(!shouldOverride)this.panel.refresh();}
            this.auto.tick(now);this.macro.tick(now);this.racing.tick(now);
            const virtualState=this.input.snapshot();
            const combo=(virtualState.buttons[10]>0.05&&virtualState.buttons[11]>0.05)||(this.physical.state.buttons[10]>0.05&&this.physical.state.buttons[11]>0.05);
            if(combo){if(this.comboSince===null)this.comboSince=now;if(!this.comboFired&&now-this.comboSince>=1500){this.comboFired=true;this.shortcut();}}
            else {this.comboSince=null;this.comboFired=false;}
            this.virtual.sync(this.virtual.readPhysical());this.updateVisibility();this.updatePanelFade(now);
            const showPhysical=this.physical.connected&&(this.override||this.physical.active);
            // 控制面板監控採最大按鍵值；實體軸僅在有活動時覆蓋顯示，不修改虛擬輸出。
            const display=this.input.snapshot();
            if(showPhysical){display.buttons=display.buttons.map((v,i)=>Math.max(v,this.physical.state.buttons[i]));this.physical.state.axes.forEach((v,i)=>{if(Math.abs(v)>0.15)display.axes[i]=v;});}
            this.panel.tick(now,display);
            if(!this.viewer.root.hidden)this.viewer.render(showPhysical?this.physical.state:this.input.snapshot(),showPhysical);
            this.racingView.render();this.raf=requestAnimationFrame(()=>this.loop());
        }
        destroy() {
            this.destroyed=true;cancelAnimationFrame(this.raf);this.stopAll();this.abort.abort();this.virtual.destroy();this.host?.remove();
            if(window.__BXG_V14__===this)delete window.__BXG_V14__;
        }
    }

    // 測試可載入純邏輯類別，不啟動 DOM，也不改寫真實 navigator。
    if(typeof module==='object'&&module.exports) {
        module.exports={ConfigStore,InputManager,VirtualGamepad,PhysicalGamepadMonitor,ButtonAutomation,MacroEngine,MacroBackup,LayoutManager,PointerManager,RacingController,App};return;
    }
    if(window.top!==window.self)return;
    const boot=()=>{window.__BXG_V14__?.destroy?.();const app=new App();window.__BXG_V14__=app;
        try{app.start();}catch(e){console.error('[xCloud v14] 啟動失敗',e);app.destroy();alert('xCloud v14 啟動失敗，請查看 Console 並確認舊版已停用。');}};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
