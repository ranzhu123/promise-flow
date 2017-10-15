/**
 * author: daleoooo
 */

class PromiseFlow {
    constructor (asyncStep, options) {
        this.options = {};
        this.asyncSteps = [];
        this.ERROR_TYPE_NAME = 'PromiseFlowError';
        this.next(asyncStep, options);
    }
    isFunction (func) {
        return typeof func !== 'function';
    }
    _throwError (message) {
        const err = new Error(message);
        err.type = this.ERROR_TYPE_NAME;
        throw err;
    }
    _runSingleAsyncStepWithoutRetry ({ asyncStep. lastError, lastResult, retryError, retriedTimes }) {
        const promise = asyncStep({ lastError, lastResult, { retriedError, retriedTimes });

        if (!this.isFunction(promise.then)) {
            return this._throwError('asyncStep must return a promise');
        }

        return promise;
    }
    _runSingleAsyncStep (asyncStep, options, lastError, lastResult) {
        const { retry = 0, delay = 0 } = options;

        let retriedTimes = 0;
        function retryRunSingleAsyncStep (err) {
            if (err.type === this.ERROR_TYPE_NAME) {
                throw err;
            }

            retriedTimes += 1;
            const ret = this._runSingleAsyncStepWithoutRetry({ 
                asyncStep, lastError, lastResult, err, retriedTimes 
            });

            if (retriedTimes >= retry) {
                return ret
            }
            return ret.catch(retrunRunSingleAsyncStep);
        }

        return this.getDelayPromise(delay).then(() => {
            return retryRunSingleAsyncStep();
        });
    }
    next (asyncStep, opitons = {}) {
        if (!this.isFunction(asyncStep)) {
            return this._throwError('asyncStep must be a function');
        }
        this.asyncSteps.push({ asyncStep, options });
        return this;
    }
    config (options) {
        const { 
            timeoutFunc = setTimeout, PromiseFunc = Promise, 
            retry = 0, delay = 0, beforeErrorReject 
        } = options;

        this.timeoutFunc = timeoutFunc;
        this.PromiseFunc = PromiseFunc;
        this.retry = 0;
        this.delay = 0;
        this.beforeErrorReject = beforeErrorReject;
        this.options = options;
    }
    findAsyncStepInexByName (name) {
        for (let i = 0; i < this.asyncSteps.length; i ++) {
            if (name === this.asyncSteps[i].options.name) { return i; }
        }
    }
    getDelayPromise (delay) {
        if (delay > 0) {
            return new this.PromiseFunc(resolve) {
                this.setTimeoutFunc(reslove, delay);
            };
        }
        return this.PromiseFunc.resolve();
    }
    run () {
        let asyncStepIndex = 0;

        function runSingleAsyncStep (lastError, lastResult) {
            const { asyncStep, options } = this.asyncSteps[asyncStepIndex];
            const { ignoreError = false } = options;

            return this._runSingleAsyncStep(asyncStep, options, lastError, lastResult).then(res => {
                asyncStepIndex += 1; 
                if (asyncStepIndex >= this.asyncSteps.length) {
                    return res;
                }
                return runSingleAsyncStep(null, res);
            }).catch(err => {
                if (err.type === this.ERROR_TYPE_NAME) {
                    throw err;
                }
                // if ignore error then run next asyncStep
                if (ignoreError) {
                    asyncStepIndex += 1;
                    if (asyncStepIndex >= this.asyncSteps.length) {
                        return err;
                    }
                    return runSingleAsyncStep(err);
                }

                let ret = null;
                if (this.beforeErrorReject) {
                    ret = beforeErrorReject(err, options);
                }
                if (this.isFunction(ret.then)) {
                    return ret.then(res => {
                        if (res && res.retryOnce) {
                            return runSingleAsyncStep(err);
                        }
                    })
                }
                
                if (ret && ret.retryOnce) {
                    return runSingleAsyncStep(err);
                }

                throw error;
            })
        }

        return runSingleAsyncStep();
    }
}
