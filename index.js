/*globals window: true*/
(function () {
    'use strict';
    var prop = Object.defineProperty,
        eventSplitter = /\s+/;

    function nobleClassExtendProps(onto, from/*...*/) {
        for (var props = Object.getOwnPropertyNames(from), pL = props.length, n = 0; n < pL; ++n) {
            var replace = Object.getOwnPropertyDescriptor(onto, props[n]);
            if (!replace || replace.writable) {
                prop(onto, props[n], Object.getOwnPropertyDescriptor(from, props[n]));
            }
        }
    }

    function nobleClassDispatchEventObject(obj, action, evts, cb, ctx) {
        if (!evts || typeof evts === 'string' && !eventSplitter.test(evts)) return false;
        if (typeof evts === 'object' && typeof cb === 'object' && typeof ctx === 'undefined') {
            ctx = cb;
            cb = null;
        }
        var evN = typeof evts === 'string' ? evts.split(eventSplitter) : Object.keys(evts);
        for (var i = 0, l = evN.length; i < l; ++i) {
            if (typeof evts === 'object') {
                cb = typeof evts[evN[i]] === 'function' ? evts[evN[i]] : ctx[evts[evN[i]]];
            }
            obj[action](evN[i], cb, ctx);
        }
        return true;
    }

    // Optimise for small argument lists, where <fn>.call can be used (much faster than <fn>.apply)
    function nobleClassEmitEvent(obj, events, args) {
        /*jshint maxcomplexity: 10*/
        var i = -1, l = events.length, a1 = args[0], a2 = args[1], a3 = args[2];
        switch (args.length) {
        case 0:
            while (++i < l) events[i].cb.call(events[i].ctx || obj);
            return;
        case 1:
            while (++i < l) events[i].cb.call(events[i].ctx || obj, a1);
            return;
        case 2:
            while (++i < l) events[i].cb.call(events[i].ctx || obj, a1, a2);
            return;
        case 3:
            while (++i < l) events[i].cb.call(events[i].ctx || obj, a1, a2, a3);
            return;
        default:
            while (++i < l) events[i].cb.apply(events[i].ctx || obj, args);
        }
    }

    function NobleClass() {}

    NobleClass.prototype = Object.freeze({
        constructor: NobleClass,

        on: function on(name, cb, ctx) {
            this._events || (prop(this, '_events', { value: {}, writable: true }));
            if (name && !nobleClassDispatchEventObject(this, 'on', name, cb, ctx)) {
                if (typeof cb !== 'function') throw new TypeError('listener for ' + name + ' must be a function');
                (this._events[name] || (this._events[name] = [])).push({ cb: cb, ctx: ctx });
            }
            return this;
        },

        once: function once(name, cb, ctx) {
            if (name && nobleClassDispatchEventObject(this, 'once', name, cb, ctx)) return this;
            // Dont want to bind handleOnce to `this` as cb needs to be given the context
            var _this = this;
            var handleOnce = function () {
                _this.off(name, handleOnce);
                cb.apply(this, arguments);
            };
            prop(handleOnce, '_cb', { value: cb });
            return this.on(name, handleOnce, ctx);
        },

        off: function off(name, cb, ctx) {
            var events;
            if (name === '*' || !this._events) {
                prop(this, '_events', { value: {}, writable: true });
                return this;
            } else if (name && !nobleClassDispatchEventObject(this, 'off', name, cb, ctx) && (events = this._events[name])) {
                var retain = this._events[name] = [];
                for (var i = 0, ev; i < events.length; ++i) {
                    ev = events[i];
                    if ((cb && ev.cb !== cb && ev.cb._cb !== cb) || (ctx && ctx !== ev.ctx)) {
                        retain.push(events[i]);
                    }
                }
                if (!retain.length) delete this._events[name];
            }
            if (this._events['off:' + name]) this.emit('off:' + name, cb, ctx, this);
            return this;
        },

        emit: function emit(name) {
            // If nothing is listening to the error event, throw it instead.
            if (name === 'error' && !(this._events || {}).error) {
                throw arguments[1];
            } else if (!this._events) {
                return this;
            }
            var args = [].slice.call(arguments, 1);
            if (this._events[name]) nobleClassEmitEvent(this, this._events[name], args);
            if (this._events.all) nobleClassEmitEvent(this, this._events.all, [name].concat(args));
            return this;
        }

    });

    prop(NobleClass, 'extend', { configurable: true, writable: true, value: function nobleClassExtend(protoProps, staticProps) {
        var child;

        if (protoProps && protoProps.hasOwnProperty('constructor')) {
            child = protoProps.constructor;
        } else {
            child = function subClass() { return child['super'].apply(this, arguments); };
        }

        // Add ".super" static to child
        prop(child, 'super', { value: this });

        // Extend all static props onto the child.
        nobleClassExtendProps(child, this);
        if (staticProps) nobleClassExtendProps(child, staticProps);

        child.prototype = Object.create(this.prototype, {
            constructor: {
                value: child,
                enumerable: false,
                writable: true,
                configurable: true
            }
        });

        if (protoProps) nobleClassExtendProps(child.prototype, protoProps);

        return child;
    }});

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = NobleClass;
    } else {
        (typeof window !== 'undefined' ? window : global).NobleClass = NobleClass;
    }

})();