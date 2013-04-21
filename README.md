NobleClass
----------

NobleClass is a simple Class implementation inspired by Backbone, but using ES5
features. This means it copies property values such as enumerability and
writability across classes. It also has proper prototypal inheritence.

It also comes with a complete EventEmitter implementation, similar to
Backbone's, but also borrowing some bits from Node's EventEmitter. It features
`on`, `off`, `once` and `emit`.

It is more comprehensive than a simple `util.inherits()` in Node, as it allows
you to cleanly express additional prototype & static properties, and also
inherits static properties from the parent class. The built in EventEmitter is
also useful as it offers additional benefits to EventEmitter (explianed later)
and works in the browser.

I suppose some of you are asking "Why? There are plenty of decent Class
implementations around, even some ES5 ones, even ones with EventEmitters etc".
This is true, mostly. But none do it how I wanted to do it. Don't like how I've
done it? That's fine, use another, or write your own, or fork mine!

Usage
-----

Making new classes is easy. `constructor` in the prototype will automatically
be fired upon class construction.

```javascript
var Class = require('NobleClass');

AThing = Class.extend({

    someProtoProp: 1,
    anotherProtoProp: 'hi',

    someProtoMethod: function () { /*...*/ }
    anotherProtoMethod: function () { /*...*/ }

});

AnotherThing = AThing.extend({

    constructor: function () {},

    someProtoMethod: function () { AnotherThing.super.someProtoMethod.call(this); /*...*/ }

}. {
    staticProperty: true
});

console.assert(AnotherThing instanceof AThing); // true
console.assert(AThing instanceof Class); // true
console.assert(AThing.prototype.someProtoMethod !== AnotherThing.prototype.someProtoMethod); // true
```

Each class comes with the `on`, `off`, `once` and `emit` methods, which can be
used like so:

```javascript
var Class = require('NobleClass');

AnotherThing = AThing.extend({

    get name() {
        return this._name;
    },

    set name(value) {
        this.emit('change:name', this._name, value, this);
    }

});

inst = new AnotherThing();

inst.on('change:name', function (old, new, context) { /*...*/ });
inst.on('all', function () {}); // Fires on all events.
inst.on('off:change:name', function (context) {}) // Fires when the 'change:name' event is `off'ed`
inst.off('change:name') // Fires the `off:change:name` event and removes all `change:name` events
```

LICENSE
-------

MIT