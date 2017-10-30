/**
 * author: daleoooo
 */

function defaultSetTimeoutFunc (callback, timeout) {
    setTimeout(callback, timeout);
}

export default class PromiseFlow {
    constructor (options = {}) {
        const { 
            setTimeoutFunc = defaultSetTimeoutFunc, PromiseFunc = Promise, 
            retry = 0, delay = 0, beforeErrorReject 
        } = options;

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
    _isFunction (func) {
        return typeof func === 'function';
    }
    _throwError (message) {
        const err = new Error(message);
        err.type = this.ERROR_TYPE_NAME;
        throw err;
    }
    _throwPromiseError (message) {
        const err = new Error(message);
        err.type = this.ERROR_TYPE_NAME;
        return this.PromiseFunc.reject(err);
    }
    _getDelayPromise (delay) {
        return new this.PromiseFunc(resolve => {
            this.setTimeoutFunc(resolve, delay);
        });
    }
    _runSingleTaskWithoutRetry ({ task, lastError, lastResult, retriedError, retriedTimes }) {
        const promise = task(lastError, lastResult, { retriedError, retriedTimes });

        if (!this._isFunction(promise.then)) {
            return this._throwPromiseError('task must return a promise');
        }

        return promise;
    }
    _runSingleTask (task, options, lastError, lastResult) {
        const { retry = 0, delay = 0 } = options;

        const context = this;
        let retriedTimes = 0;
        function retryRunSingleTask (err) {
            if (err && err.type === context.ERROR_TYPE_NAME) {
                return Promise.reject(err);
            }

            const taskPromise = context._runSingleTaskWithoutRetry({ 
                task, lastError, lastResult, err, retriedTimes 
            });

            retriedTimes += 1;
            if (retriedTimes > retry) {
                return taskPromise;
            }
            return taskPromise.catch(retryRunSingleTask);
        }

        if (delay > 0) {
            return this._getDelayPromise(delay).then(() => {
                return retryRunSingleTask();
            });
        }

        return retryRunSingleTask();
    }
    add (task, options = {}) {
        if (!this._isFunction(task)) {
            return this._throwError('task must be a function');
        }
        this.tasks.push({ task, options });
        return this;
    }
    findTaskInexByName (name) {
        for (let i = 0; i < this.tasks.length; i ++) {
            if (name === this.tasks[i].options.name) { return i; }
        }
    }
    run () {
        const context = this;
        let taskIndex = 0;

        function runSingleTask (lastError, lastResult) {
            const { task, options } = context.tasks[taskIndex];
            const { ignoreError = false } = options;

            return context._runSingleTask(task, options, lastError, lastResult).catch(err => {
                if (err && err.type === context.ERROR_TYPE_NAME) {
                    throw err;
                }

                const runNext = () => {
                    taskIndex += 1;
                    if (taskIndex >= context.tasks.length) {
                        return err;
                    }
                    return runSingleTask(err);
                };

                // if ignore error then run next task
                if (ignoreError) {
                    return runNext()
                }

                const fork = (res = {}) => {
                    if (typeof res !== 'object') {
                        return Promise.reject(err);
                    }

                    if (res.retryOnce) {
                        return runSingleTask(err, res);
                    } else if (res.runNext) {
                        return runNext();
                    }
                    return Promise.reject(err);
                }

                if (context.beforeErrorReject) {
                    const ret = context.beforeErrorReject(err, options);

                    if (ret && context._isFunction(ret.then)) {
                        return ret.then(res => {
                            return fork(res);
                        }).catch(e => {
                            return Promise.reject(e);
                        });
                    }

                    return fork(ret);
                }

                return Promise.reject(err);
            }).then(res => {
                taskIndex += 1; 
                if (taskIndex >= context.tasks.length) {
                    return res;
                }
                return runSingleTask(null, res);
            });
        }

        return runSingleTask();
    }
}
