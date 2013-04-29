/*globals beforeEach: true, afterEach: true, before: true, after: true, sinon: true */
(function (global) {
    // These are defined globally on a browser, so only care about node here
    if (typeof require !== 'undefined') {
        global.sinon = require('sinon');
        require('chai').use(require('sinon-chai')).should();
    }

    // Get sinon stubs deeply integrated with mocha
    global.sandbox = function (fn) {

        beforeEach(function () {
            this._sandboxEach = sinon.sandbox.create({
                injectInto: this,
                properties: ['spy', 'stub', 'mock', 'clock', 'server', 'requests'],
                useFakeTimers: false,
                useFakeServer: false
            });
        });

        afterEach(function () {
            this._sandboxEach.restore();
        });

        before(function () {
            this._sandboxAll = sinon.sandbox.create({
                injectInto: this,
                properties: ['spy', 'stub', 'mock', 'clock', 'server', 'requests'],
                useFakeTimers: false,
                useFakeServer: false
            });
        });

        after(function () {
            this._sandboxAll.restore();
        });

        return fn;

    };
})(typeof global === 'undefined' ? window : global);