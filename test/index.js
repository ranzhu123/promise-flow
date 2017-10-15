import assert from 'assert';
import PromiseFlow from '../lib';

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

    it('should run 1 task', function () {
        const pf = new PromiseFlow();
        pf.add(() => {
            return Promise.resolve(true) ;
        });
        return pf.run().then(res => {
            assert(res);
        })
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
        })
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
        })
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
        })
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
        })
    });

    it('should run 2 task', function () {
        const pf = new PromiseFlow();
        return pf.add(taskGenerator(true)).add((err, res) => {
            assert(!err) ;
            assert(res === true);
            return taskGenerator(false)();
        }).run().then(res => {
            assert(!res); 
        })
    })
});
