'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * author: daleoooo
 */

function defaultSetTimeoutFunc(callback, timeout) {
    setTimeout(callback, timeout);
}

var PromiseFlow = function () {
    function PromiseFlow() {
        var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

        _classCallCheck(this, PromiseFlow);

        var _options$setTimeoutFu = options.setTimeoutFunc,
            setTimeoutFunc = _options$setTimeoutFu === undefined ? defaultSetTimeoutFunc : _options$setTimeoutFu,
            _options$PromiseFunc = options.PromiseFunc,
            PromiseFunc = _options$PromiseFunc === undefined ? Promise : _options$PromiseFunc,
            _options$retry = options.retry,
            retry = _options$retry === undefined ? 0 : _options$retry,
            _options$delay = options.delay,
            delay = _options$delay === undefined ? 0 : _options$delay,
            beforeErrorReject = options.beforeErrorReject;


        this.options = Object.assign({}, options);
        this.tasks = [];
        this.ERROR_TYPE_NAME = 'PromiseFlowError';
        this.setTimeoutFunc = setTimeoutFunc;
        this.PromiseFunc = PromiseFunc;
        this.retry = 0;
        this.delay = 0;
        this.beforeErrorReject = beforeErrorReject;
        this.options = options;

        return this;
    }

    _createClass(PromiseFlow, [{
        key: '_isFunction',
        value: function _isFunction(func) {
            return typeof func === 'function';
        }
    }, {
        key: '_throwError',
        value: function _throwError(message) {
            var err = new Error(message);
            err.type = this.ERROR_TYPE_NAME;
            throw err;
        }
    }, {
        key: '_throwPromiseError',
        value: function _throwPromiseError(message) {
            var err = new Error(message);
            err.type = this.ERROR_TYPE_NAME;
            return this.PromiseFunc.reject(err);
        }
    }, {
        key: '_getDelayPromise',
        value: function _getDelayPromise(delay) {
            var _this = this;

            return new this.PromiseFunc(function (resolve) {
                _this.setTimeoutFunc(resolve, delay);
            });
        }
    }, {
        key: '_runSingleTaskWithoutRetry',
        value: function _runSingleTaskWithoutRetry(_ref) {
            var task = _ref.task,
                lastError = _ref.lastError,
                lastResult = _ref.lastResult,
                retriedError = _ref.retriedError,
                retriedTimes = _ref.retriedTimes;

            var promise = task(lastError, lastResult, { retriedError: retriedError, retriedTimes: retriedTimes });

            if (!this._isFunction(promise.then)) {
                return this._throwPromiseError('task must return a promise');
            }

            return promise;
        }
    }, {
        key: '_runSingleTask',
        value: function _runSingleTask(task, options, lastError, lastResult) {
            var _options$retry2 = options.retry,
                retry = _options$retry2 === undefined ? 0 : _options$retry2,
                _options$delay2 = options.delay,
                delay = _options$delay2 === undefined ? 0 : _options$delay2;


            var context = this;
            var retriedTimes = 0;
            function retryRunSingleTask(err) {
                if (err && err.type === context.ERROR_TYPE_NAME) {
                    return context.PromiseFunc.reject(err);
                }

                var taskPromise = context._runSingleTaskWithoutRetry({
                    task: task, lastError: lastError, lastResult: lastResult, err: err, retriedTimes: retriedTimes
                });

                retriedTimes += 1;
                if (retriedTimes > retry) {
                    return taskPromise;
                }
                return taskPromise.catch(retryRunSingleTask);
            }

            if (delay > 0) {
                return this._getDelayPromise(delay).then(function () {
                    return retryRunSingleTask();
                });
            }

            return retryRunSingleTask();
        }
    }, {
        key: 'add',
        value: function add(task) {
            var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

            if (!this._isFunction(task)) {
                return this._throwError('task must be a function');
            }
            this.tasks.push({ task: task, options: options });
            return this;
        }
    }, {
        key: 'findTaskInexByName',
        value: function findTaskInexByName(name) {
            for (var i = 0; i < this.tasks.length; i++) {
                if (name === this.tasks[i].options.name) {
                    return i;
                }
            }
        }
    }, {
        key: 'run',
        value: function run() {
            var context = this;
            var taskIndex = 0;

            function runSingleTask(lastError, lastResult) {
                var _context$tasks$taskIn = context.tasks[taskIndex],
                    task = _context$tasks$taskIn.task,
                    options = _context$tasks$taskIn.options;
                var _options$ignoreError = options.ignoreError,
                    ignoreError = _options$ignoreError === undefined ? false : _options$ignoreError;


                return context._runSingleTask(task, options, lastError, lastResult).catch(function (err) {
                    if (err && err.type === context.ERROR_TYPE_NAME) {
                        throw err;
                    }

                    var runNext = function runNext() {
                        taskIndex += 1;
                        if (taskIndex >= context.tasks.length) {
                            return err;
                        }
                        return runSingleTask(err);
                    };

                    // if ignore error then run next task
                    if (ignoreError) {
                        return runNext();
                    }

                    var fork = function fork() {
                        var res = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

                        if ((typeof res === 'undefined' ? 'undefined' : _typeof(res)) !== 'object') {
                            return context.PromiseFunc.reject(err);
                        }

                        if (res.retryOnce) {
                            return runSingleTask(err, res);
                        } else if (res.runNext) {
                            return runNext();
                        }
                        return context.PromiseFunc.reject(err);
                    };

                    if (context.beforeErrorReject) {
                        var ret = context.beforeErrorReject(err, options);

                        if (ret && context._isFunction(ret.then)) {
                            return ret.then(function (res) {
                                return fork(res);
                            }).catch(function (e) {
                                return context.PromiseFunc.reject(e);
                            });
                        }

                        return fork(ret);
                    }

                    return context.PromiseFunc.reject(err);
                }).then(function (res) {
                    taskIndex += 1;
                    if (taskIndex >= context.tasks.length) {
                        return res;
                    }
                    return runSingleTask(null, res);
                });
            }

            return runSingleTask();
        }
    }]);

    return PromiseFlow;
}();

exports.default = PromiseFlow;