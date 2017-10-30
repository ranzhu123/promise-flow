import assert from 'assert';
import PromiseFlow from '../dist';

function taskGenerator (res) {
    return function () {
        return Promise.resolve(res);
    }
}

describe('Promise Task Flow', function () {
    it('should create an instance', function () {
        const pf = new PromiseFlow();
        assert(pf);
    });

    it('should return "task must be a function"', function () {
        const pf = new PromiseFlow();
        try {
            pf.add(1);
        } catch (e) {
            assert(e.type === pf.ERROR_TYPE_NAME);
            assert(e.message === 'task must be a function');
        }
    });

    it('should return "task must return a promise"', function () {
        const pf = new PromiseFlow();
        return pf.add(() => 1).run().catch(e => {
            assert(e.type === pf.ERROR_TYPE_NAME);
            assert(e.message === 'task must return a promise');
        });
    });

    it('should return "task must return a promise" before retrying', function () {
        const pf = new PromiseFlow();
        return pf.add((err, res, options) => {
            const { retriedTimes } = options;
            assert(retriedTimes < 1);
            return 1;    
        }, { retry: 3 }).run().catch(e => {
            assert(e.type === pf.ERROR_TYPE_NAME);
            assert(e.message === 'task must return a promise');
        });
    });

    it('should run 1 task', function () {
        const pf = new PromiseFlow();
        pf.add(() => {
            return Promise.resolve(true) ;
        });
        return pf.run().then(res => {
            assert(res);
        });
    });

    it('should run 1 task after 1000 ms', function () {
        const pf = new PromiseFlow(); 
        const delay = 1000;

        let finished = false;
        const flow = pf.add((a, b, c) => {
            return Promise.resolve(true);
        }, { delay }).run().then(res => {
            finished = true;
            assert(res);
        });
        
        return new Promise(resolve => {
            setTimeout(resolve, 900);
        }).then(() => {
            if (finished) {
                throw new Error('Promise Flow delay is not work');
            }
            return flow;
        });
    });

    it('should run 1 task and catch err and do not retry', function () {
        const pf = new PromiseFlow({
            beforeErrorReject (err, options) {
                assert(err === true);
                assert(options.name === 'first');
            }
        });

        return pf.add((err, res) => {
            return Promise.reject(true);
        }, { name: 'first' }).run().catch(err => assert(err === true));
    });

    it('should run 1 task and catch err with a promise and do not retry', function () {
        const pf = new PromiseFlow({
            beforeErrorReject (err, options) {
                assert(err === true);
                assert(options.name === 'first');
                return Promise.resolve(true);
            }
        });

        return pf.add((err, res) => {
            return Promise.reject(true);
        }, { name: 'first' }).run().catch(err => assert(err === true));
    });

    it('should run 1 task and catch err and run next', function () {
        let runTimes = 0;
        const pf = new PromiseFlow({
            beforeErrorReject (err, options) {
                assert(err === true);
                assert(options.name === 'first');
                return { runNext: true };
            }
        });

        return pf.add((err, res) => {
            runTimes += 1;
            return Promise.reject(true);
        }, { name: 'first' }).add((err, res) => {
            return Promise.resolve(0);
        }).run().then(res => {
            assert(res === 0);
            assert(runTimes === 1);
        });
    });

    it('should run 1 task and catch err and retry', function () {
        let retriedTimes = 0;
        let runTimes = 0;
        const pf = new PromiseFlow({
            beforeErrorReject (err, options) {
                assert(err === true);
                assert(options.name === 'first');
                if (retriedTimes < 1) {
                    retriedTimes += 1;
                    return { retryOnce: true };
                }
                return false;
            }
        });

        return pf.add((err, res) => {
            runTimes += 1;
            return Promise.reject(true);
        }, { name: 'first' }).run().catch(err => {
            assert(err === true);
            assert(runTimes === 2);
        });
    });

    it('should run 1 task and catch err with promise and retry', function () {
        let retriedTimes = 0;
        let runTimes = 0;
        const pf = new PromiseFlow({
            beforeErrorReject (err, options) {
                assert(err === true);
                assert(options.name === 'first');
                if (retriedTimes < 1) {
                    retriedTimes += 1;
                    return Promise.resolve({ retryOnce: true });
                }
                return false;
            }
        });

        return pf.add((err, res) => {
            runTimes += 1;
            return Promise.reject(true);
        }, { name: 'first' }).run().catch(err => {
            assert(err === true);
            assert(runTimes === 2);
        });
    });

    it('should run 1 task and catch err with promise and get res', function () {
        let retriedTimes = 0;
        let runTimes = 0;
        const pf = new PromiseFlow({
            beforeErrorReject (err, options) {
                assert(err === true);
                assert(options.name === 'first');
                if (retriedTimes < 1) {
                    retriedTimes += 1;
                    return Promise.resolve({ retryOnce: true, retriedTimes });
                }
                return false;
            }
        });

        return pf.add((err, res) => {
            if (runTimes === 1) {
                assert(typeof res === 'object');
                assert(res.retryOnce === true);
                assert(res.retriedTimes === runTimes);
            }
            runTimes += 1;
            return Promise.reject(true);
        }, { name: 'first' }).run().catch(err => {
            assert(err === true);
            assert(runTimes === 2);
        });
    });

    it('should run 1 task and catch err retry 2 times with promise and get res', function () {
        let retriedTimes = 0;
        let runTimes = 0;
        const pf = new PromiseFlow({
            beforeErrorReject (err, options) {
                assert(err === runTimes);
                assert(options.name === 'first');
                if (retriedTimes < 2) {
                    retriedTimes += 1;
                    return Promise.resolve({ retryOnce: true, retriedTimes });
                }
                return false;
            }
        });

        return pf.add((err, res) => {
            if (runTimes && runTimes < 3) {
                assert(typeof res === 'object');
                assert(res.retryOnce === true);
                assert(res.retriedTimes === runTimes);
            }
            runTimes += 1;
            return Promise.reject(runTimes);
        }, { name: 'first' }).run().catch(err => {
            assert(err === runTimes);
            assert(runTimes === 3);
        });
    });

    it('should run 1 task, retrying 3 times and get succeed at 2 times retry', function () {
        const pf = new PromiseFlow();
        const retry = 3;
        pf.add((err, res, options) => {
            const { retriedError, retriedTimes } = options;
            if (retriedTimes === 0) {
                assert(!retriedError);
            }
            if (retriedTimes < 2) {
                return Promise.reject()
            }
            return Promise.resolve(true);
        }, { retry });

        return pf.run().then(res => {
            assert(res);
        });
    });

    it('should run 1 task, retrying 3 times and get succeed at 3 times retry', function () {
        const pf = new PromiseFlow();
        const retry = 3;
        pf.add((err, res, options) => {
            const { retriedError, retriedTimes } = options;
            if (retriedTimes === 0) {
                assert(!retriedError);
            }
            if (retriedTimes < retry) {
                return Promise.reject()
            }
            return Promise.resolve(true);
        }, { retry });

        return pf.run().then(res => {
            assert(res);
        });
    });

    it('should run 1 task, retrying 3 times and get failed', function () {
        const pf = new PromiseFlow();
        const retry = 3;
        pf.add((err, res, options) => {
            const { retriedError, retriedTimes } = options;
            if (retriedTimes === 0) {
                assert(!retriedError);
            }
            return Promise.reject(true)
        }, { retry });

        return pf.run().catch(err => {
            assert(err);
        });
    });

    it('should run 2 task', function () {
        const pf = new PromiseFlow();
        return pf.add(taskGenerator(true)).add((err, res) => {
            assert(!err) ;
            assert(res === true);
            return taskGenerator(false)();
        }).run().then(res => {
            assert(!res); 
        });
    });

    it('should run 1 task and rejected when 1st task throw error', function () {
        const pf = new PromiseFlow();
        let secondTaskRun = false;
        return pf.add((err, res) => {
            return Promise.reject(true);
        }).add((err, res) => {
            secondTaskRun = true;
            return taskGenerator(true)();
        }).run().catch(err => {
            assert(!secondTaskRun);
            assert(err); 
        });
    });

    it('should run 2 task and rejected when 2nd task throw error', function () {
        const pf = new PromiseFlow();
        let secondTaskRun = false;
        return pf.add(taskGenerator(true)).add((err, res) => {
            secondTaskRun = true;
            return Promise.reject(true);
        }).run().catch(err => {
            assert(secondTaskRun);
            assert(err); 
        });
    });

    it('should run 2 task and resolved 1st task ignore error', function () {
        const pf = new PromiseFlow();
        let secondTaskRun = false;
        return pf.add((err, res) => {
            return Promise.reject(true);
        }, { ignoreError: true }).add((err, res) => {
            secondTaskRun = true;
            return taskGenerator(true)();
        }).run().then(res => {
            assert(secondTaskRun);
            assert(res); 
        });
    });

    it('should run 2 task and resolved when 2nd task ignore error', function () {
        const pf = new PromiseFlow();
        let secondTaskRun = false;
        return pf.add(taskGenerator(true)).add((err, res) => {
            secondTaskRun = true;
            return Promise.reject(true);
        }, {ignoreError: true }).run().then(res => {
            assert(secondTaskRun);
            assert(res); 
        });
    });
});
