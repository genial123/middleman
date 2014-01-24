function Searcher(logger, delay) {
	if ((delay < 1) || isNaN(delay) || ((delay % 1) !== 0)) {
		logger.error('Searcher-delay ('+delay+') not an integer > 0, falling back to default 5 seconds');
		delay = 5;
	}

	this.logger = logger;
	this.waitfor = delay;

	this.queue = [];
	this.waiting = false;
	this.timer = null;
}

Searcher.prototype.__ready = function() {
	var self = this;
	if (!self.queue.length) return self.waiting = false;
	var next = self.queue.shift();

	var again = function(err) {
		if (err) self.logger.info('Searcher returned error: '+err);

		var limit, count, max;
		if (typeof next.interval !== 'undefined') {
			count = ++next.count;
			max = next.attempts;
			limit = (count >= max);
		}
		else {
			count = next.idx+1;
			max = next.starts.length+1;
			limit = (typeof next.starts[next.idx] === 'undefined');
		}

		if (limit) return next.cb.apply(this, [err]);
		var wait = ((typeof next.interval !== 'undefined') ? next.interval : next.starts[next.idx++]);

		self.logger.debug('Scheduled new search '+(count+1)+'/'+max+' in '+wait+' second(s)...');
		setTimeout(function() {
			self.queue.push(next);
			self.__start();
		}, wait*1000);
	};

	var fns = [];
	var prevcb = next.cb;
	for (var i = next.fns.length-1; typeof next.fns[i] !== 'undefined'; i--) {
		var nfn = (function(i, fn, cb) {
			return function(err) {
				var args = Array.prototype.slice.call(arguments, 0);
				var opts = {again: again, cb: cb};
				if (typeof args[1] !== 'undefined')
					for (var y in args[1])
						opts[y] = args[1][y];

				var sarg = [opts];
				if (i > 0) sarg.unshift(err);

				fn.apply(this, sarg);
			};
		})(i, next.fns[i], prevcb);

		fns.unshift(nfn);
		prevcb = nfn;
	}

	prevcb();
	self.__wait();
};

Searcher.prototype.__start = function() {
	if (!this.waiting) {
		this.waiting = true;
		this.__ready();
	}
};

Searcher.prototype.__wait = function() {
	var self = this;
	self.logger.debug('Halting search-queue for '+self.waitfor+' second(s) to avoid flooding');

	clearTimeout(self.timer);
	self.timer = setTimeout(function() {
		self.waiting = false;
		self.__start();
	}, self.waitfor*1000);
};

Searcher.prototype.simple = function(delay, interval, attempts, fns, callback) {
	var self = this;
	var when = (delay ? 'in '+delay+'second(s)...' : 'now!');
	self.logger.debug('Pushing new search (simple) into queue '+when);
	if (Object.prototype.toString.call(fns) != '[object Array]') fns = [fns];

	setTimeout(function() {
		self.queue.push({
			interval: interval,
			attempts: attempts,
			fns: fns,
			cb: callback,
			count: 0
		});

		self.__start();
	}, delay*1000);
};

Searcher.prototype.advanced = function(delay, starts, fns, callback) {
	var self = this;
	var when = (delay ? 'in '+delay+'second(s)...' : 'now!');
	self.logger.debug('Pushing new search (advanced) into queue '+when);
	if (Object.prototype.toString.call(fns) != '[object Array]') fns = [fns];

	setTimeout(function() {
		self.queue.push({
			starts: starts,
			idx: 0,
			fns: fns,
			cb: callback
		});

		self.__start();
	}, delay*1000);
};

module.exports = function(logger, delay) {
	return new Searcher(logger, delay);
};
