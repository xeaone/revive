'use strict';

module.exports = function (delay, value) {
    return new Promise(function (resolve) {
        setTimeout(function () {
			resolve(this);
		}, delay, value);
    });
};
