//# NobleClass

// > © Keith Cirkel
//
// > NobleClass may be freely distributed under the MIT license.
//
// > For all details and documentation:
// > http://github.com/keithamus/NobleClass

// NobleClass is a simple Class implementation inspired by Backbone & NodeJS, but using ES5
// features. This means it copies property values such as enumerability and writability across
// classes. It also has proper prototypal inheritence using Object.create.

// It comes with a complete EventEmitter implementation, similar to Backbone's, but also borrowing
// some bits from Node's EventEmitter. It features `on`, `off`, `once` and `emit`.

// It is more comprehensive than a simple `util.inherits()` in Node, as it allows
// you to cleanly express additional prototype & static properties, and also
// inherits static properties from the parent class. The built in EventEmitter is
// also useful as it offers additional benefits to EventEmitter (explianed later)
// and works in the browser.

// I suppose some of you are asking "Why? There are plenty of decent Class
// implementations around, even some ES5 ones, even ones with EventEmitters etc".
// This is true, mostly. But none do it how I wanted to do it. Don't like how I've
// done it? That's fine, use another, or write your own, or fork mine!

// Below is the heavily commented codebase for NobleClass, which you can use for documentation.
// Failing that, you can also have a look at the [test generated documentation](test.html)

/*globals window: true*/
(function () {
    'use strict';
    // Shortcuts for Object.* methods, used frequently.
    var prop = Object.defineProperty,
        getPropDesc = Object.getOwnPropertyDescriptor;


    // NobleClass Constructor
    // -----------

    // Does nothing, just here to be a class.
    function NobleClass() {}


    // Events
    // -------------

    // Regular expression used to split event strings (see below). Cached here for performance.
    var eventSplitter = /\s+/;

    // #### nobleClassDispatchEventObject
    // This takes munged event arguments, such as having an object of events or multiple events in
    // one string, and splits the out into simple event arguments to dispatch to the respective
    // event function. All event binding functions (on/off/once) call this first to clean up their
    // argument array.
    function nobleClassDispatchEventObject(obj, action, evts, cb, ctx) {
        // If the event name is just a normal event name, this function is effectively a NoOp.
        if (!evts || typeof evts === 'string' && !eventSplitter.test(evts)) return false;

        // If the evts is an object of events, then the callbacks are values inside the event
        // argument, so do shuffle the arguments to ensure ctx is actually the context.
        if (typeof evts === 'object' && typeof cb === 'object' && typeof ctx === 'undefined') {
            ctx = cb;
            cb = null;
        }

        // Either evts is an object, with the event names as keys on the object, and callbacks as
        // values of those keys, or it is a string of space separated event names. Either way a
        // simple array of event names can be generated to iterate over the events names.
        var evN = typeof evts === 'string' ? evts.split(eventSplitter) : Object.keys(evts);

        // With the event name list, iterate over each event name and call .on/.off/.once with the
        // normalised arguments.
        for (var i = 0, l = evN.length; i < l; ++i) {
            if (typeof evts === 'object') {
                // This detects if the event object is referring to either function literals, or
                // strings which point to function names on `ctx`, and gets the right value
                cb = typeof evts[evN[i]] === 'function' ? evts[evN[i]] : ctx[evts[evN[i]]];
            }
            obj[action](evN[i], cb, ctx);
        }
        // Return true to tell .on/.off/.once this function has done something
        return true;
    }

    // #### nobleClassEmitEvent
    // Optimise emitting of events for majority usecases where the argument lists are 3 or less
    // arguments. This works because `<Function>.call()` is faster than `<Function>.apply()`.
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

    // Extend NobleClass to add event emitter functions, and also lock it down so it cannot be
    // edited later on.
    NobleClass.prototype = Object.freeze({
        constructor: NobleClass,

        // #### On
        // On adds a function `cb` to an event `name` in the `._events` stack, with an optional
        // "this" context: `ctx`. Internally it calls `nobleClassDispatchEventObject` so you can
        // give it event objects or multiple event names in one string.
        on: function on(name, cb, ctx) {
            // Create events as a non-enumerable property (unless it exists).
            this._events || (prop(this, '_events', { value: {}, writable: true }));
            // Try and pass it through nobleClassDispatchEventObject first, if that doesn't do
            // anything then it's a nicely formatted call, so add it to the events object.
            if (name && !nobleClassDispatchEventObject(this, 'on', name, cb, ctx)) {
                if (typeof cb !== 'function') {
                    throw new TypeError('listener for ' + name + ' must be a function');
                }
                (this._events[name] || (this._events[name] = [])).push({ cb: cb, ctx: ctx });
            }
            return this;
        },

        // #### Once
        // Once is essentially the same as on, with the caveat that the listener given will fire
        // once and then be removed out of the event listener chain.
        once: function once(name, cb, ctx) {
            // Try and pass it through nobleClassDispatchEventObject first, if that doesn't do
            // anything then it's a nicely formatted call, so...
            if (name && nobleClassDispatchEventObject(this, 'once', name, cb, ctx)) return this;
            // Create a wrapper function for `cb` that `off`s itself as soon as it has been
            // executed. This cannot be bound to `this` because then it won't use `ctx` for the
            // call to `cb`, so old school `_this` hackery needs to be used.
            var _this = this;
            var handleOnce = function handleOnce() {
                _this.off(name, handleOnce);
                cb.apply(this, arguments);
            };
            // Add a `_cb` reference to the underyling function, which can be used in `off` to
            // unbind the function without a reference to the wrapper function.
            prop(handleOnce, '_cb', { value: cb });
            // Everything else is just a `.on`, so call that with the new wrapper function
            return this.on(name, handleOnce, ctx);
        },

        // #### Off
        // Off removes event listeners by `name`, `cb` function and optionally `ctx` context from
        // the `._events` object. It calls `nobleClassDispatchEventObject`
        off: function off(name, cb, ctx) {
            var events;
            // If `name` is `"*"`, then `off` will unbind every event on the class, the quickest way
            // to do that is just assign `._events` to `{}`. Also, if `._events` doesn't exist then
            // it may aswell go down this route to return early.
            if (name === '*' || !this._events) {
                prop(this, '_events', { value: {}, writable: true });
                return this;
            // Try and pass it through nobleClassDispatchEventObject first, if that doesn't do
            // anything then it's a nicely formatted call, so add it to the events object.
            // Capture the event stack for `name` into the `events` var because it is about to get
            // trashed.
            } else if (name && !nobleClassDispatchEventObject(this, 'off', name, cb, ctx) &&
            (events = this._events[name])) {
                // Empty out the events stack for `name` and repopulate it with all the old events
                // that don't contain `cb` (with `ctx` as its context, if supplied). This could be
                // done using `<Array>.indexOf` and `<Array>.slice` but it'd be more complex and
                // slower than a simple for loop + if
                var retain = this._events[name] = [];
                for (var i = 0, ev; i < events.length; ++i) {
                    ev = events[i];
                    if ((cb && ev.cb !== cb && ev.cb._cb !== cb) || (ctx && ctx !== ev.ctx)) {
                        retain.push(events[i]);
                    }
                }
                // If the new events stack is empty, just delete the reference to make future
                // events around this faster (mostly a quick return route for emitting)
                if (!retain.length) delete this._events[name];
            }
            // Fire an "off:<eventname>" event so subscribers can detect when their listeners have
            // been off'd. Pass the old `cb` and `ctx` incase the event decides it wants to rebind
            if (this._events['off:' + name]) this.emit('off:' + name, cb, ctx, this);
            return this;
        },

        // #### Emit
        // Emit fires every function in the array of bound events. It takes - minimally - a `name`,
        // but also takes unlimited extra arguments, which it passes to the bound listeners.
        emit: function emit(name) {
            // As a special case for error events, when no listeners are bound to an error event,
            // then throw the first argument (which *should* be an Error object).
            if (name === 'error' && !(this._events || {}).error) {
                throw arguments[1];
            // Return early if events object, is empty or has no events bound to `name`.
            } else if (!this._events || !this._events[name]) {
                return this;
            }
            // Fire the event with all other arguments given to `emit`, also fire an `all` event
            // which includes the real event name as the first argument. Useful for catching events
            // for facade classes, to pipe events through to other classes.
            var args = [].slice.call(arguments, 1);
            if (this._events[name]) nobleClassEmitEvent(this, this._events[name], args);
            if (this._events.all) nobleClassEmitEvent(this, this._events.all, [name].concat(args));
            return this;
        }

    });

    // NobleClass Extend
    // -----------------

    // `nobleClassExtendProps` is a method to copy property definitions from a `from` object to a
    // `onto` object. Because it uses Object.getOwnPropertyDescriptor it can also copy getter and
    // setter functions (rather than copying their values). Also, it uses Object.getOwnPropertyNames
    // meaning it can get non-enumerable properties and copy those over too.
    function nobleClassExtendProps(onto, from) {
        for (var props = Object.getOwnPropertyNames(from), pL = props.length, n = 0; n < pL; ++n) {
            var replace = getPropDesc(onto, props[n]);
            if (!replace || replace.writable) {
                prop(onto, props[n], getPropDesc(from, props[n]));
            }
        }
    }

    // The `.extend` function is a non-enumerable static property on NobleClass which is the crux
    // of the Class system. `.extend` always results in a new child class, which is a parent of the
    // class it is being called from.
    prop(NobleClass, 'extend', { configurable: true, writable: true, value: function nobleClassExtend(protoProps, staticProps) {
        var child;

        // If protoProps has a `constructor` function then this should be used as the basis of the
        // child class, but if it doesn't then a use a default function (`subClass`) which simply
        // calls `.super`. In most cases you will want to provide a custom constructor.
        if (protoProps && protoProps.hasOwnProperty('constructor')) {
            child = protoProps.constructor;
        } else {
            child = function subClass() { return child.super.apply(this, arguments); };
        }

        // Add ".super" static to child. This references the parent class, which allows you to call
        // the super class functions inside the child class functions (although you cannot do
        // `this.super`, as it is a static on the class - for memory reasons)
        prop(child, 'super', { value: this });

        // Extend all static props from the parent class, onto the child, and from the `staticProps`
        // object. `staticProps` comes last so you can override parent class static properties.
        nobleClassExtendProps(child, this);
        if (staticProps) nobleClassExtendProps(child, staticProps);

        // Object.create will create an `instanceof` reference to the parent, meaning `child
        // instanceof parent` works. It takes an optional set of values. The constructor is composed
        // back into the `child.prototype` here because if it was not supplied in `protoProps` it
        // will not be available in the prototype (up until now)
        child.prototype = Object.create(this.prototype, {
            constructor: {
                value: child,
                enumerable: false,
                writable: true,
                configurable: true
            }
        });

        // Finally extend all `protoProps` onto the child.
        if (protoProps) nobleClassExtendProps(child.prototype, protoProps);

        return child;
    }});

    // Exporting
    // ---------

    // Export out NobleClass into a module.exports module (for Node)
    // or a property on the window object (for Browsers)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = NobleClass;
    } else {
        (typeof window !== 'undefined' ? window : global).NobleClass = NobleClass;
    }

})();